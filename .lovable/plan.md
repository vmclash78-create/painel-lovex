# Plano de Implementação: API de Revenda

O objetivo é permitir que revendedores integrem seus próprios sites externos ao painel de revenda, possibilitando a geração automática de chaves (estoque) via API.

## Alterações Propostas

### 1. Banco de Dados (Supabase)
- Criar uma nova tabela `reseller_api_keys` para gerenciar tokens de acesso programático.
- Estrutura: `id`, `reseller_id`, `api_key` (hash), `name`, `created_at`, `last_used_at`.
- Adicionar RLS e permissões adequadas.

### 2. Backend (Server Functions / Routes)
- Criar um novo endpoint público em `src/routes/api/public/reseller/v1/generate.ts`.
- Este endpoint receberá a API Key no cabeçalho `X-Reseller-API-Key`.
- Validará o token e a cota do revendedor.
- Gerará a licença no banco correspondente (LoveX ou LovPro) e retornará a chave gerada.

### 3. Frontend (Painel de Administração)
- Em `src/routes/_authenticated/resellers.tsx`, adicionar uma seção para o Administrador gerar/visualizar API Keys para cada revendedor.

### 4. Frontend (Painel de Revenda)
- Em `src/routes/r.$token.tsx`, adicionar uma nova aba ou seção "Integração API" para que o revendedor possa copiar sua API Key e ver a documentação técnica básica.

## Detalhes Técnicos
- O endpoint da API será: `POST /api/public/reseller/v1/generate`
- Payload esperado:
  ```json
  {
    "type": "lovex" | "lovpro",
    "user_name": "Nome do Cliente",
    "days": 30,
    "max_version": "2.1"
  }
  ```
- Segurança: Uso de `crypto.timingSafeEqual` para validar tokens e rate limiting básico.

## Documentação para o Revendedor
- Criar um arquivo ou componente de UI com exemplos de chamadas `curl` e `javascript` para facilitar a vida do revendedor.
