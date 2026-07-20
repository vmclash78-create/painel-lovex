import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erro desconhecido.";
}

function isAuthError(error: unknown): boolean {
  const text = getErrorText(error).toLowerCase();
  const status = typeof error === "object" && error !== null && "status" in error
    ? String((error as { status?: unknown }).status)
    : "";
  const statusCode = typeof error === "object" && error !== null && "statusCode" in error
    ? String((error as { statusCode?: unknown }).statusCode)
    : "";
  return status === "401" || statusCode === "401" || text.includes("unauthorized") || text.includes("jwt");
}

function isStaleChunkError(error: unknown): boolean {
  const text = getErrorText(error).toLowerCase();
  return (
    text.includes("failed to fetch dynamically imported module") ||
    text.includes("importing a module script failed") ||
    text.includes("loading chunk") ||
    text.includes("chunkloaderror")
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isAuthError(error)) {
      try {
        window.localStorage.removeItem("external-sb-auth");
      } catch {
        /* ignore */
      }
      window.location.replace("/auth");
      return;
    }

    if (isStaleChunkError(error)) {
      const key = `lovex:asset-reload:${window.location.pathname}`;
      if (!window.sessionStorage.getItem(key)) {
        window.sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }
  }, [error]);

  const errorText = getErrorText(error);
  const staleAsset = isStaleChunkError(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não consegui abrir esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {staleAsset
            ? "O navegador ainda estava com uma versão antiga do painel. Recarregue para buscar a versão nova."
            : "Algo falhou ao carregar esta tela. Tente recarregar ou volte para o início."}
        </p>
        <pre className="mt-4 max-h-28 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-left text-[11px] text-muted-foreground">
          {errorText}
        </pre>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                try {
                  window.sessionStorage.removeItem(`lovex:asset-reload:${window.location.pathname}`);
                } catch {
                  /* ignore */
                }
              }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Linux Lovable" },
      { name: "description", content: "Nova Creation is a web application for managing dashboards and licenses." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Linux Lovable" },
      { property: "og:description", content: "Nova Creation is a web application for managing dashboards and licenses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Linux Lovable" },
      { name: "twitter:description", content: "Nova Creation is a web application for managing dashboards and licenses." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a9714854-2530-4890-9841-1d96e09e9110/id-preview-d524df28--941b8e21-c711-4c43-83f1-b269ccd31d5f.lovable.app-1781462901280.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a9714854-2530-4890-9841-1d96e09e9110/id-preview-d524df28--941b8e21-c711-4c43-83f1-b269ccd31d5f.lovable.app-1781462901280.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
