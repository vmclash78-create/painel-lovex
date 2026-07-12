import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Login temporariamente desabilitado — vai direto ao dashboard.
    throw redirect({ to: "/dashboard" });
  },
});
