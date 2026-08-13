export type ClientPlanId = string;

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
    id: "lovex-2x",
    name: "LoveX 2.x",
    price: 95,
    db: "main",
    maxVersion: "2.1",
    description: "Extensão LoveX na versão 2.x (mais nova) por 30 dias.",
    badge: "Principal",
  },
];

export function findClientPlan(id: string): ClientPlan | undefined {
  return CLIENT_PLANS.find((p) => p.id === id);
}

export function planForLicense(input: {
  db: "main" | "lp";
  maxVersion: string | null | undefined;
}): ClientPlan {
  return CLIENT_PLANS[0];
}

export function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}