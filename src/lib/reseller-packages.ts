export type KeyPackage = {
  id: string;
  quantity: number;
  amount: number; // BRL
  label: string;
};

export const KEY_PACKAGES: KeyPackage[] = [
  { id: "p1", quantity: 1, amount: 35, label: "1 Key" },
  { id: "p2", quantity: 2, amount: 60, label: "2 Keys" },
  { id: "p5", quantity: 5, amount: 130, label: "5 Keys" },
  { id: "p10", quantity: 10, amount: 220, label: "10 Keys" },
  { id: "p20", quantity: 20, amount: 400, label: "20 Keys" },
  { id: "p50", quantity: 50, amount: 950, label: "50 Keys" },
  { id: "p100", quantity: 100, amount: 1800, label: "100 Keys" },
  { id: "p200", quantity: 200, amount: 3400, label: "200 Keys" },
];

export function getPackage(id: string): KeyPackage | undefined {
  return KEY_PACKAGES.find((p) => p.id === id);
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}