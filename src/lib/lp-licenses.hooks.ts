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
      mutationFn: (data: Parameters<typeof createFn>[0]["data"]) => createFn({ data }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (data: Parameters<typeof updateFn>[0]["data"]) => updateFn({ data }),
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