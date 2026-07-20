export type ClientPlanId = "lovepro" | "lovex-19" | "lovex-2x";

export type ClientPlan = {
  id: ClientPlanId;
  name: string;
  price: number;
  /** Where the license lives / is created. */
  db: "main" | "lp";
  /** For LoveX plans — sets max_version on the license. */
  maxVersion?: string;
  description: string;
  badge?: string;
};

export const CLIENT_PLANS: ClientPlan[] = [
  {
    id: "lovepro",
    name: "LovePro",
    price: 50,
    db: "lp",
    description: "Acesso completo à extensão LovePro por 30 dias.",
  },
  {
    id: "lovex-19",
    name: "LoveX 1.9",
    price: 80,
    db: "main",
    maxVersion: "1.9",
    description: "Extensão LoveX na versão 1.9.x por 30 dias.",
  },
  {
    id: "lovex-2x",
    name: "LoveX 2.x",
    price: 90,
    db: "main",
    maxVersion: "2.1",
    description: "Extensão LoveX na versão 2.x (mais nova) por 30 dias.",
    badge: "Promoção",
  },
];

export function findClientPlan(id: string): ClientPlan | undefined {
  return CLIENT_PLANS.find((p) => p.id === id);
}

export function planForLicense(input: {
  db: "main" | "lp";
  maxVersion: string | null | undefined;
}): ClientPlan {
  if (input.db === "lp") return CLIENT_PLANS[0];
  const v = (input.maxVersion ?? "").trim();
  if (v.startsWith("2")) return CLIENT_PLANS[2];
  return CLIENT_PLANS[1];
}

export function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}