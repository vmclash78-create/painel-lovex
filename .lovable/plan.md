## Objetivo
Fazer o painel LP (quando selecionado no switcher) ter **exatamente** as mesmas funcionalidades do painel Principal — mesma UI, mesmos filtros, mesmas ações — apenas lendo/gravando no banco LP.

## Estado atual
- `/licenses` já troca entre Principal e LP via `useDb()`, mas o LP renderiza um componente separado (`LpLicensesPanel`) com **UI simplificada**: sem editar chave, sem resetar dispositivo, sem contato/WhatsApp, sem versão máxima, sem coluna "Expira em X dias", sem card "Renovações próximas", sem filtro "expiring", sem toolbar/paginação idênticos.
- `MainLicensesPage` usa direto `supabase.from("licenses")` (external client) + hook `licensesQueryOptions`.
- Server functions do LP (`second-licenses.functions.ts`) já cobrem list/create/update/revoke/delete. Falta suportar campos: `max_version`, `customer_phone` — se existirem no schema LP.
- Dashboard já é DB-aware.

## Plano

### 1. Refatorar `MainLicensesPage` em componente genérico
Extrair a UI da página Principal para um componente `LicensesPageView` parametrizado por uma **camada de dados** (`adapter`) com esta interface:
- `useList()` → licenças + loading
- `mutations`: revoke, remove, update (edit), reset device, create
- `keyPrefix` ("LX" | "LP") para `generateKey`
- `invalidate()` para refetch

### 2. Criar dois adapters
- `mainAdapter` → usa `supabase` (external client) direto, como hoje
- `lpAdapter` → usa os `useServerFn(...)` das `second-licenses.functions.ts`

### 3. Trocar renderização em `/licenses`
```tsx
const { db } = useDb();
const adapter = db === "lp" ? useLpAdapter() : useMainAdapter();
return <LicensesPageView adapter={adapter} />;
```
Remover `LpLicensesPanel` (arquivo apagado).

### 4. Ampliar server fns LP para paridade
- `updateSecondLicense`: aceitar `max_version`, `customer_phone` (opcional, ignora se colunas não existirem — try/catch por campo, ou passar direto — deixar o Postgres reclamar só se coluna faltar).
- `createSecondLicense`: idem.
- Adicionar tipo `SecondLicense` com esses campos opcionais.
- **Nota:** o usuário precisará rodar no banco LP o SQL:
  ```sql
  ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS max_version TEXT;
  ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS customer_phone TEXT;
  ```
  Vou avisar isso no fim.

### 5. Dashboard
O dashboard já lê do banco ativo, mas hoje no LP alguns cards ficam ocultos. Manter como está — a solicitação é sobre `/licenses`.

## Arquivos afetados
- `src/routes/_authenticated/licenses.tsx` — extrai view + adapters (`mainAdapter`, chama `LpAdapter`)
- `src/lib/lp-licenses.hooks.ts` — vira o adapter LP (`useLpAdapter`)
- `src/lib/second-licenses.functions.ts` — aceita `max_version` / `customer_phone`
- `src/components/lp-licenses-panel.tsx` — **removido**

## Resultado
Ao trocar Principal ↔ LP no switcher, a página `/licenses` fica visualmente idêntica (mesma tabela, mesmos filtros "Todos/Expirando/Renovações", botões editar/resetar/bloquear/remover, card "Renovações próximas", diálogo Nova/Editar completo com Contato + Versão máxima). Só os dados vêm do banco LP.

## Confirmação
Confirma que devo prosseguir? Se sim, também rodo o `ALTER TABLE` no banco LP via server function temporária ou você prefere rodar manualmente?
