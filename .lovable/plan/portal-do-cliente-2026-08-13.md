# Portal do Cliente

Área pública onde o cliente final acessa com a própria key, vê novidades da extensão, renova, troca de plano ou compra uma key nova. Pagamento sempre cai na sua conta (Pix MP).

## Fluxo

```text
/cliente                        -> tela com input "digite sua key"
/cliente/$licenseKey            -> painel do cliente

Painel:
  ├─ Status da key (dias restantes, plano atual, versão máx)
  ├─ Novidades / changelog da extensão
  ├─ Renovar (mantém a key, adiciona 30 dias no plano escolhido)
  ├─ Trocar de plano (mantém a key, muda max_version e adiciona 30 dias)
  └─ Comprar nova key (gera outra key para o mesmo cliente)
```

## Planos disponíveis

| ID          | Nome                 | Preço  | max_version | Banco |
|-------------|----------------------|--------|-------------|-------|
| `lovepro`   | LovePro              | R$ 50  | (LP)        | LP    |
| `lovex-19`  | LoveX 1.9            | R$ 80  | `1.9`       | LoveX |
| `lovex-2x`  | LoveX 2.x (promo)    | R$ 90  | `2.1`       | LoveX |

Regras:
- Renovar = mesmo plano da key atual, +30 dias.
- Trocar de plano = muda `max_version` (LoveX) OU exige nova key se pular entre LoveX ↔ LovePro (bancos diferentes).
- Comprar nova = cria key no banco do plano escolhido, +30 dias.

## Backend (banco)

Migration na cloud principal para o changelog (as tabelas `licenses` e `reseller_purchases` já existem nos dois bancos):

```sql
public.extension_updates (
  version text, title text, body text, published_at, is_lovepro bool
)
```

RLS: `SELECT` liberado para `anon`, escrita apenas `service_role`.

Reaproveita a tabela `reseller_purchases` (nos dois bancos externos) marcando `package_name = 'CLIENT_RENEWAL:<licenseId>'` ou `'CLIENT_NEW:<plan>'` e `reseller_id = NULL`. O webhook MP já credita — vou estender pra, quando a compra for de cliente, criar/renovar a licença em vez de creditar keys.

## Server routes novas (`src/routes/api/public/client/`)

- `GET  /api/public/client/lookup?key=...` — busca a licença nos dois bancos, retorna plano, dias, versão.
- `POST /api/public/client/create-payment` — body `{ licenseKey?, action: 'renew'|'switch'|'new', planId }` → gera Pix (usa mesma lógica de MP).
- Reaproveita `/api/public/mp/status` já existente.
- Estende `/api/public/mp/webhook.ts`: se `external_reference` for de cliente, aplica a mudança na licença certa.

## Frontend

- `src/routes/cliente.index.tsx` — form: digite sua key.
- `src/routes/cliente.$key.tsx` — painel do cliente (dark neon, mesmo estilo do portal de revenda).
  - Card status (dias, plano, versão máx, botão WhatsApp com dono).
  - Aba **Novidades** — lista `extension_updates` filtrada pelo banco da key.
  - Aba **Renovar / Trocar plano** — 3 cards de plano com preço, botão gera Pix (QR + copia e cola + polling status).
  - Aba **Comprar nova key** — mesmos 3 cards, gera key nova depois do pagamento.
- Nova rota admin `src/routes/_authenticated/updates.tsx` + item na sidebar — CRUD do changelog (título, versão, corpo em markdown simples, banco).

## Detalhes técnicos

- Autenticação do cliente: só a `licenseKey` na URL — não expõe telefone completo (mascarado) nem `session_id`.
- Pix: mesmo endpoint MP existente, `external_reference` = id da compra local; webhook decide `credit_reseller_keys` (revenda) vs `apply_client_action` (cliente) baseado no `package_name`.
- Trocar plano entre bancos diferentes (LoveX ↔ LovePro): bloqueia com aviso "isso gera key nova, use a aba Comprar" — key não migra entre bancos.
- Renovação estende `expires_at` a partir do maior entre `now()` e `expires_at` atual (não perde dias se renovar cedo).

## Escopo desta entrega

1. Migration `extension_updates` no banco Cloud.
2. Server routes: `lookup`, `create-payment` (cliente), webhook estendido.
3. Rotas frontend: `/cliente`, `/cliente/$key`, `/updates` admin.
4. Item "Atualizações" na sidebar admin.
5. Reuso total do estilo neon existente e dos componentes de QR/polling já feitos em `BuyKeysDialog`.

Sem mexer em: painel de revenda, dashboard, lógica de licenças da revenda, cores.