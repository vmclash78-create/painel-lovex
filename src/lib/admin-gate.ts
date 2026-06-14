// ⚠️ Segurança BÁSICA (client-side). A senha fica no bundle —
// quem inspecionar o JS pode ler. Use só como obstáculo simples.
// Para trocar a senha, edite ADMIN_PASSWORD abaixo.

export const ADMIN_PASSWORD = "troque-esta-senha";

const STORAGE_KEY = "admin_gate_ok";

export function isAdminUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function unlockAdmin(password: string): boolean {
  if (password !== ADMIN_PASSWORD) return false;
  window.localStorage.setItem(STORAGE_KEY, "1");
  return true;
}

export function lockAdmin(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}