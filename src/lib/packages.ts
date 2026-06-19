export type KeyPackage = {
  id: string;
  quantity: number;
  price: number; // BRL
  label: string;
  highlight?: boolean;
};

export const KEY_PACKAGES: KeyPackage[] = [
  { id: "p1",   quantity: 1,   price: 35,   label: "1 Key" },
  { id: "p2",   quantity: 2,   price: 60,   label: "2 Keys" },
  { id: "p5",   quantity: 5,   price: 130,  label: "5 Keys" },
  { id: "p10",  quantity: 10,  price: 220,  label: "10 Keys", highlight: true },
  { id: "p20",  quantity: 20,  price: 400,  label: "20 Keys" },
  { id: "p50",  quantity: 50,  price: 950,  label: "50 Keys" },
  { id: "p100", quantity: 100, price: 1800, label: "100 Keys" },
  { id: "p200", quantity: 200, price: 3400, label: "200 Keys" },
];

export function findPackage(id: string): KeyPackage | undefined {
  return KEY_PACKAGES.find((p) => p.id === id);
}