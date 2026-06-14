import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Sempre passa pela tela de login. Se já estiver autenticado,
    // /auth redireciona automaticamente para /dashboard.
    throw redirect({ to: "/auth" });
  },
});
