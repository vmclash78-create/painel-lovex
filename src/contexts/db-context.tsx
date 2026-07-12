import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type DbId = "main" | "lp";

type Ctx = {
  db: DbId;
  setDb: (db: DbId) => void;
};

const DbCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "lovex.active-db";

export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDbState] = useState<DbId>("main");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "main" || saved === "lp") setDbState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setDb = (next: DbId) => {
    setDbState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  return <DbCtx.Provider value={{ db, setDb }}>{children}</DbCtx.Provider>;
}

export function useDb(): Ctx {
  const v = useContext(DbCtx);
  if (!v) throw new Error("useDb must be used inside <DbProvider>");
  return v;
}