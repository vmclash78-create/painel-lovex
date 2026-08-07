import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  KeyRound,
  PlusCircle,
  Clock,
  Ban,
  Users,
  ScrollText,
  Settings,
  Sparkles,
  Megaphone,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { licensesQueryOptions, computeStatus } from "@/lib/licenses";
import { lpLicensesQueryOptions, computeLpStatus } from "@/lib/lp-licenses.hooks";
import { useDb } from "@/contexts/db-context";

type Item = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  search?: Record<string, string>;
  badgeKey?: "expiring";
};

const keys: Item[] = [
  { label: "Todas as Keys", to: "/licenses", icon: KeyRound },
  { label: "Criar Key", to: "/licenses", icon: PlusCircle, search: { open: "new" } },
  { label: "Expirando", to: "/licenses", icon: Clock, search: { filter: "expiring" }, badgeKey: "expiring" },
  { label: "Revogadas", to: "/licenses", icon: Ban, search: { status: "revoked" } },
];

const resellers: Item[] = [
  { label: "Revendedores", to: "/resellers", icon: Users },
];

const system: Item[] = [
  { label: "Atualizações", to: "/updates", icon: Megaphone },
  { label: "Logs", to: "/logs", icon: ScrollText },
  { label: "Configurações", to: "/settings", icon: Settings },
];

function useExpiringCount(): number {
  const { db } = useDb();
  const main = useQuery({ ...licensesQueryOptions, enabled: db === "main" });
  const lp = useQuery({ ...lpLicensesQueryOptions, enabled: db === "lp" });
  const data = db === "lp" ? lp.data : main.data;
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return 0;
  const soon = Date.now() + 7 * 86_400_000;
  return (rows as Array<{ expires_at: string | null; status: string | null }>).filter((l) => {
    if (!l.expires_at) return false;
    const s = db === "lp"
      ? computeLpStatus(l as Parameters<typeof computeLpStatus>[0])
      : computeStatus(l as Parameters<typeof computeStatus>[0]);
    if (s !== "active") return false;
    const t = new Date(l.expires_at).getTime();
    return !Number.isNaN(t) && t <= soon && t >= Date.now();
  }).length;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { db } = useDb();
  const location = useRouterState({ select: (s) => s.location });
  const currentPath = location.pathname;
  const currentSearch = (location.search ?? {}) as Record<string, string | undefined>;
  const expiringCount = useExpiringCount();

  const isActive = (item: Item) => {
    if (currentPath !== item.to) return false;
    if (!item.search) {
      // Plain link is only "active" when no filter search params are present.
      return !currentSearch.filter && !currentSearch.status && !currentSearch.open;
    }
    return Object.entries(item.search).every(([k, v]) => currentSearch[k] === v);
  };

  const renderGroup = (label: string, items: Item[]) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isActive(item);
            return (
              <SidebarMenuItem key={`${item.to}-${item.label}`}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                  <Link
                    to={item.to}
                    search={item.search ?? {}}
                    className="gap-2"
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
                {item.badgeKey === "expiring" && expiringCount > 0 && !collapsed ? (
                  <SidebarMenuBadge className="bg-neon-orange/15 text-neon-orange">
                    {expiringCount}
                  </SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  const { isMobile } = useSidebar();
  
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border" onPointerDown={(e) => isMobile && e.stopPropagation()}>
      <SidebarHeader className="border-b border-sidebar-border/60 py-4">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-neon">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-bold tracking-tight">{db === "lp" ? "LovePro" : "LoveX"}</div>
              <div className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Control Panel
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={currentPath === "/dashboard"} tooltip="Dashboard">
                  <Link to="/dashboard" className="gap-2">
                    <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {renderGroup("Keys", keys)}
        {renderGroup("Revendedores", resellers)}
        {renderGroup("Sistema", system)}
      </SidebarContent>
      <SidebarFooter>
        <UserFooter collapsed={collapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}

function UserFooter({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/30 px-2 py-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neon-purple to-neon-pink text-xs font-bold text-primary-foreground">
        VT
      </span>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-xs font-semibold">Administrador</div>
          <div className="truncate text-[10px] text-muted-foreground">Sessão ativa</div>
        </div>
      )}
    </div>
  );
}