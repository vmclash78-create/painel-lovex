import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase, type License } from "@/integrations/external-supabase/client";
import { generateLicenseKey } from "@/lib/licenses";
import {
  listSecondLicenses,
  createSecondLicense,
  updateSecondLicense,
  revokeSecondLicense,
  deleteSecondLicense,
  generateSecondLicenseKey,
  type SecondLicense,
} from "@/lib/second-licenses.functions";
import { useDb } from "@/contexts/db-context";

export type LicensePatch = Partial<License> & Record<string, unknown>;
export type LicenseInsert = Partial<License> & Record<string, unknown>;

export type LicenseService = {
  id: "main" | "lp";
  queryKey: unknown[];
  keyPrefix: "LX" | "LP";
  generateKey: () => string;
  list: () => Promise<License[]>;
  update: (id: string, patch: LicensePatch) => Promise<void>;
  insert: (data: LicenseInsert) => Promise<void>;
  revoke: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const Ctx = createContext<LicenseService | null>(null);

function mainService(): LicenseService {
  return {
    id: "main",
    queryKey: ["licenses"],
    keyPrefix: "LX",
    generateKey: () => generateLicenseKey(),
    list: async () => {
      // Tenta buscar com todas as colunas; se falhar, tenta sem as novas para manter a funcionalidade básica
      try {
        const { data, error } = await supabase
          .from("licenses")
          .select("id, license_key, user_name, status, expires_at, activated_at, device_id, session_id, max_devices, duration_minutes, created_at, updated_at, reseller_id, sold_by, max_version, customer_phone, daily_prompts_used, last_prompt_date, daily_limit, last_active")
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return (data ?? []) as License[];
      } catch (err: any) {
        console.warn("Falha ao buscar com colunas estendidas, tentando colunas básicas:", err);
        // Fallback para colunas que existiam na v1.0
        const { data, error } = await supabase
          .from("licenses")
          .select("id, license_key, user_name, status, expires_at, activated_at, device_id, session_id, max_devices, duration_minutes, created_at, updated_at, reseller_id, sold_by, max_version, customer_phone")
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return (data ?? []) as License[];
      }
    },
      
      const resellerIds = Array.from(
        new Set(rows.map((r) => r.reseller_id).filter((v): v is string => !!v)),
      );
      
      let nameMap = new Map<string, string>();
      if (resellerIds.length) {
        const { data: rs } = await supabase
          .from("resellers")
          .select("id, name")
          .in("id", resellerIds);
        nameMap = new Map((rs ?? []).map((r) => [r.id, r.name]));
      }

      return rows.map((r) => {
        let seller = r.sold_by && r.sold_by !== "—" ? r.sold_by : null;
        if (!seller && r.reseller_id) {
          seller = nameMap.get(r.reseller_id) || null;
        }
        return {
          ...r,
          sold_by: seller || "Dono",
        };
      });
    },
    update: async (id, patch) => {
      const { error } = await supabase.from("licenses").update(patch).eq("id", id).select();
      if (error) {
        console.error("Update error:", error);
        throw error;
      }
    },
    insert: async (data) => {
      const { error } = await supabase.from("licenses").insert(data);
      if (error) throw error;
    },
    revoke: async (id) => {
      const { error } = await supabase
        .from("licenses")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    remove: async (id) => {
      const { error } = await supabase.from("licenses").delete().eq("id", id);
      if (error) throw error;
    },
  };
}

function useLpService(): LicenseService {
  const listFn = useServerFn(listSecondLicenses);
  const createFn = useServerFn(createSecondLicense);
  const updateFn = useServerFn(updateSecondLicense);
  const revokeFn = useServerFn(revokeSecondLicense);
  const deleteFn = useServerFn(deleteSecondLicense);

  return useMemo<LicenseService>(
    () => ({
      id: "lp",
      queryKey: ["licenses", "lp"],
      keyPrefix: "LP",
      generateKey: () => generateSecondLicenseKey(),
      list: async () => {
        const rows = (await listFn()) as SecondLicense[];
        const resellerIds = Array.from(
          new Set(rows.map((r) => r.reseller_id).filter((v): v is string => !!v)),
        );
        
        let nameMap = new Map<string, string>();
        if (resellerIds.length) {
          const { data: rs } = await supabase
            .from("resellers")
            .select("id, name")
            .in("id", resellerIds);
          nameMap = new Map(
            (rs ?? []).map((r) => [r.id, r.name]),
          );
        }

        return rows.map((r) => {
          let seller = r.sold_by && r.sold_by !== "—" ? r.sold_by : null;
          if (!seller && r.reseller_id) {
            seller = nameMap.get(r.reseller_id) || null;
          }
          return {
            ...r,
            sold_by: seller || "Dono",
          };
        }) as unknown as License[];
      },
      update: async (id, patch) => {
        await updateFn({ data: { id, ...(patch as object) } as never });
      },
      insert: async (data) => {
        await createFn({ data: data as never });
      },
      revoke: async (id) => {
        await revokeFn({ data: { id } });
      },
      remove: async (id) => {
        await deleteFn({ data: { id } });
      },
    }),
    [listFn, createFn, updateFn, revokeFn, deleteFn],
  );
}

export function LicenseServiceProvider({ children }: { children: ReactNode }) {
  const { db } = useDb();
  const lp = useLpService();
  const main = useMemo(mainService, []);
  const svc = db === "lp" ? lp : main;
  return <Ctx.Provider value={svc}>{children}</Ctx.Provider>;
}

export function useLicenseService(): LicenseService {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLicenseService must be used inside <LicenseServiceProvider>");
  return v;
}

/** Optional lookup — returns null outside a provider. Used by shared components. */
export function useOptionalLicenseService(): LicenseService | null {
  return useContext(Ctx);
}