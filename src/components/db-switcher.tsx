import { useQueryClient } from "@tanstack/react-query";
import { Database, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDb, type DbId } from "@/contexts/db-context";

type Db = { id: DbId; label: string; description: string };

const DBS: Db[] = [
  { id: "main", label: "Principal", description: "Banco oficial do sistema" },
  { id: "lp", label: "LP", description: "Banco isolado da LP — dados separados" },
];

export function DbSwitcher() {
  const { db, setDb } = useDb();
  const qc = useQueryClient();
  const active = DBS.find((d) => d.id === db) ?? DBS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground shadow-soft transition hover:bg-card hover:border-primary/40">
        <Database className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground">Banco atual:</span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-neon-lime shadow-[0_0_8px_var(--neon-lime)]"
          />
          {active.label}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {DBS.map((db) => {
          const isActive = db.id === active.id;
          return (
            <DropdownMenuItem
              key={db.id}
              onSelect={() => {
                if (isActive) return;
                setDb(db.id);
                qc.invalidateQueries();
                toast.success(`Banco ativo: ${db.label}`);
              }}
              className="flex items-start gap-2 py-2"
            >
              <Database className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-sm font-medium">{db.label}</div>
                <div className="text-[11px] text-muted-foreground">{db.description}</div>
              </div>
              {isActive ? <Check className="h-4 w-4 text-neon-lime" aria-hidden /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}