## Objetivo

Aplicar o novo visual (sidebar dark + dashboard com cards/sparklines + seletor de banco) e criar as rotas novas listadas no menu, reutilizando os dados que já vêm dos dois bancos (Principal e LP). Nenhum número mock — só o que já temos.

## Nova estrutura de rotas

```text
/dashboard              (reformado)
/keys                   (Todas as Keys — hoje é /licenses; vira /keys e mostra o banco selecionado)
/keys/new               (Criar Key)
/keys/expiring          (Expirando — filtra ≤7d)
/keys/revoked           (Revogadas)
/resellers              (mantida, novo visual)
/logs                   (histórico: reseller_key_transactions + reseller_purchases)
/settings               (dados do admin logado + logout + info de conexão)
/second-panel           → substituída pelo seletor de banco (removida do menu)
```

`/licenses` fica como redirect para `/keys` para não quebrar links antigos.

## Seletor de banco (Principal ↔ LP)

- Contexto global `DbContext` guardando `"main" | "lp"` em `localStorage`.
- Componente `DbSwitcher` no topo direito (igual ao mock).
- Todas as telas de keys leem/escrevem no banco ativo:
  - `main` → cliente `external-supabase` já existente
  - `lp` → server functions `second-licenses.functions.ts` já existentes
- Um único hook `useKeysApi()` devolve `list/create/update/delete/revoke` baseado no banco ativo. Assim eu não duplico UI.

## Layout / sidebar

- Novo `AppSidebar` com grupos **KEYS**, **REVENDEDORES**, **SISTEMA**, badge de expirando no item "Expirando".
- Cabeçalho fixo com título da página + `DbSwitcher` + sino + avatar.
- Rodapé da sidebar com avatar do admin (nome vem do e-mail do Supabase).
- Uso de `SidebarProvider` do shadcn com `collapsible="icon"`.

## Dashboard

Cards (dados reais do banco ativo):
- **Total de keys** — `licenses.length`
- **Expirando em 7 dias** — filtro `expires_at ≤ now+7d && status==active`
- **Revendedores** — `resellers.length` (só no banco Principal; no LP oculto)
- **Receita total** — soma de `reseller_purchases` com `status=paid`

Sparklines: mini-gráfico (recharts) mostrando keys criadas por dia nos últimos 14 dias — derivado de `created_at`. Sem dado sintético.

Percentuais "este mês": comparo count do mês atual vs mês anterior (mesma tabela).

Lista **Keys próximas de expirar**: top 5 por `expires_at` ascendente entre as ativas com expiração ≤7d, com barra circular de progresso baseada em `(now - activated_at) / (expires_at - activated_at)`.

## Novas telas

- **/keys/new** — form já existente, extraído do modal atual em `/licenses`, agora como página.
- **/keys/expiring** — lista filtrada (≤7d).
- **/keys/revoked** — lista filtrada `status=revoked`.
- **/logs** — timeline com `reseller_key_transactions` (créditos/consumos) + `reseller_purchases` (pagamentos PIX).
- **/settings** — mostra e-mail do admin, botão sair, indicador de qual banco está ativo, versão do painel.

## Design tokens

Tema dark neon (roxo/ciano). Atualizo `src/styles.css` (@theme) para adicionar `--color-neon-purple`, `--color-neon-cyan`, `--color-neon-lime`, `--gradient-*` e ajusto `--sidebar-*`. Nada de classes `bg-black`/`text-white` — só tokens.

Paleta base:
- background `oklch(0.13 0.02 275)` (roxo bem escuro)
- sidebar `oklch(0.11 0.02 275)`
- accent principal `oklch(0.72 0.22 305)` (roxo neon)
- accents secundários: ciano `oklch(0.78 0.15 200)`, lime `oklch(0.85 0.20 145)`, orange `oklch(0.75 0.18 55)`

## Arquivos a criar

- `src/components/app-sidebar.tsx`
- `src/components/db-switcher.tsx`
- `src/components/dashboard/stat-card.tsx` (com sparkline)
- `src/components/dashboard/expiring-list.tsx`
- `src/contexts/db-context.tsx`
- `src/hooks/use-keys-api.ts`
- `src/routes/_authenticated/keys.tsx` (index — todas as keys)
- `src/routes/_authenticated/keys.new.tsx`
- `src/routes/_authenticated/keys.expiring.tsx`
- `src/routes/_authenticated/keys.revoked.tsx`
- `src/routes/_authenticated/logs.tsx`
- `src/routes/_authenticated/settings.tsx`
- `src/routes/_authenticated/licenses.tsx` → vira redirect para `/keys`

## Arquivos a alterar

- `src/styles.css` — tokens do novo tema + sidebar
- `src/routes/_authenticated/route.tsx` — envolver com `SidebarProvider` + `DbProvider`, novo header
- `src/routes/_authenticated/dashboard.tsx` — reescrito
- `src/routes/_authenticated/resellers.tsx` — só ajustes de estilo pros cards/tabela

## O que fica igual

- Toda a lógica de auth, server functions, webhooks e RLS. Nenhuma mudança de schema.
- Painel público de revenda `/r/:token` fica como está (visual próprio pro cliente final).

## Validação

Após implementar: `tsgo` para typecheck, abrir `/dashboard` no preview e conferir os 4 cards, seletor de banco, e navegação entre as novas rotas.