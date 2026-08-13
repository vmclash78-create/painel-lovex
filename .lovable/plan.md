# Plano de Correção: Ativação de Keys Trial

Ajustar a lógica de ativação para que chaves **Trial** também aguardem o primeiro acesso antes de iniciar a contagem do tempo, permitindo que revendedores gerem chaves sem que o prazo expire antes de o cliente as utilizar.

## Alterações

### 1. Biblioteca de Ativação
- **`src/lib/activation.ts`**: Alterar a função `initialExpiryFromNow` para que chaves `trial` retornem `null` (sem expiração definida) inicialmente, assim como as chaves normais.
- **`src/lib/activation.ts`**: Atualizar `isPendingActivation` para incluir chaves `trial` na lógica de pendência.

### 2. Backend (Supabase Admin)
- **`src/lib/activation.server.ts`**: Modificar a função `reconcile` para incluir chaves com status `trial` no processo de sincronização/ativação após o primeiro acesso.

### 3. API de Revenda
- **`src/routes/api/public/reseller/v1/generate.ts`**: Ajustar o status inicial para `active` em todos os casos (ou respeitar o status informado) e garantir que a expiração inicial seja nula para permitir a ativação posterior via extensão.

### 4. Interface (UI)
- **`src/routes/r.$token.tsx`**: Atualizar tooltips e mensagens de ajuda no Portal de Revenda para refletir que as chaves Trial agora também aguardam o primeiro acesso.
- **`src/routes/_authenticated/licenses.tsx`**: Revisar a lógica de criação e edição no Admin para garantir consistência.

## Verificação
1. Gerar uma chave Trial e verificar se o campo `expires_at` é `null` inicialmente.
2. Simular um acesso (registrando `activated_at` ou `last_active`) e verificar se o processo de reconcile define o `expires_at` somando a duração ao tempo de acesso.
