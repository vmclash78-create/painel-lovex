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
    queryKey: ["licenses", "main"],
    keyPrefix: "LX",
    generateKey: () => generateLicenseKey(),
    list: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as License[];
    },
    update: async (id, patch) => {
      const { error } = await supabase.from("licenses").update(patch).eq("id", id);
      if (error) throw error;
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
        return rows as unknown as License[];
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
  const svc = db === "lp" ? lp : useMemo(mainService, []);
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