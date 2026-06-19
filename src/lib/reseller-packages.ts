export type KeyPackage = {
  id: string;
  name: string;
  quantity: number;
  amount: number;
};

export const KEY_PACKAGES: KeyPackage[] = [
  { id: "p1", name: "Pacote 1", quantity: 1, amount: 35 },
  { id: "p2", name: "Pacote 2", quantity: 2, amount: 60 },
  { id: "p3", name: "Pacote 3", quantity: 5, amount: 130 },
  { id: "p4", name: "Pacote 4", quantity: 10, amount: 220 },
  { id: "p5", name: "Pacote 5", quantity: 20, amount: 400 },
  { id: "p6", name: "Pacote 6", quantity: 50, amount: 950 },
  { id: "p7", name: "Pacote 7", quantity: 100, amount: 1800 },
  { id: "p8", name: "Pacote 8", quantity: 200, amount: 3400 },
];

export function getPackage(id: string): KeyPackage | undefined {
  return KEY_PACKAGES.find((p) => p.id === id);
}