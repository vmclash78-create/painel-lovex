import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSecondLicenses,
  createSecondLicense,
  updateSecondLicense,
  revokeSecondLicense,
  deleteSecondLicense,
  type SecondLicense,
} from "@/lib/second-licenses.functions";

type CreateInput = {
  license_key: string;
  user_name?: string;
  status?: "active" | "trial" | "expired" | "revoked" | "paused" | "inactive";
  expires_at?: string | null;
  max_devices?: number;
  duration_minutes?: number | null;
  reseller_id?: string | null;
  sold_by?: string | null;
};

type UpdateInput = {
  id: string;
  license_key?: string;
  status?: "active" | "trial" | "expired" | "revoked" | "paused" | "inactive";
  expires_at?: string | null;
  user_name?: string;
  max_devices?: number;
  device_id?: string | null;
  activated_at?: string | null;
  session_id?: string | null;
  is_active?: boolean;
};

// Query options for LP licenses (all rows).
// Uses the server fn directly; auth headers are attached client-side.
export const lpLicensesQueryOptions = queryOptions({
  queryKey: ["lp-licenses"],
  queryFn: () => listSecondLicenses(),
});

export function computeLpStatus(l: SecondLicense): string {
  if (l.status === "revoked") return "revoked";
  if (l.expires_at && new Date(l.expires_at) < new Date()) return "expired";
  return l.status ?? "active";
}

export function useLpMutations() {
  const qc = useQueryClient();
  const createFn = useServerFn(createSecondLicense);
  const updateFn = useServerFn(updateSecondLicense);
  const revokeFn = useServerFn(revokeSecondLicense);
  const deleteFn = useServerFn(deleteSecondLicense);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["lp-licenses"] });

  return {
    create: useMutation({
      mutationFn: (data: CreateInput) => createFn({ data }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (data: UpdateInput) => updateFn({ data }),
      onSuccess: invalidate,
    }),
    revoke: useMutation({
      mutationFn: (id: string) => revokeFn({ data: { id } }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteFn({ data: { id } }),
      onSuccess: invalidate,
    }),
  };
}