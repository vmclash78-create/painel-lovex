# Plan: Otimização de Performance e Redução de Latência

O objetivo é resolver a lentidão relatada pelo usuário, focando em otimizações de cache, redução de redundâncias em loaders/efeitos e melhoria na eficiência das consultas ao banco de dados (Supabase).

## Problemas Identificados
- **Consultas Redundantes:** A troca de banco de dados (LoveX/Lovpro) ou navegação entre abas dispara múltiplos refetchs.
- **Cache Curto:** O `staleTime` padrão em algumas áreas ainda é baixo para dados que não mudam a cada segundo (como lista de revendedores).
- **Processamento no Cliente:** O processamento de grandes listas (filtragem, mapping de nomes de revendedores) está acontecendo em cascata no `useMemo` de componentes, o que pode travar a UI se a lista crescer.
- **Efeitos de Reconciliação:** O `useEffect` que roda `reconcileActivations` no painel de licenças pode ser otimizado para não invalidar o cache desnecessariamente.

## Ações Propostas

### 1. Otimização de Cache e Queries (Global)
- Aumentar `staleTime` global para 5 minutos em dados transacionais (licenças) e 10 minutos para dados cadastrais (revendedores/configurações).
- Garantir que `refetchOnWindowFocus` esteja desativado onde a consistência absoluta em tempo real não é crítica.

### 2. Eficiência no License Service (`src/lib/license-service.tsx`)
- Implementar cache para o mapeamento de IDs de revendedores para nomes, evitando buscar a tabela `resellers` inteira repetidamente.
- Otimizar a função `list()` para ser mais resiliente e performática ao lidar com o banco secundário (LP).

### 3. Otimização do Painel de Licenças (`src/routes/_authenticated/licenses.tsx`)
- Debounce na busca por texto para evitar re-renderizações excessivas enquanto o usuário digita.
- Otimizar o `useEffect` de reconciliação para disparar apenas se necessário.

### 4. Melhoria no Painel de Revenda (`src/routes/r.$token.tsx`)
- Corrigir a duplicação visual detectada no código (seções de "Renovações" e "Keys Expiradas" aparecem duas vezes no JSX).
- Refinar o `staleTime` das consultas públicas de revenda.

### 5. Backend/Server Functions
- Garantir que as `server functions` do banco secundário (LP) utilizem seleções de colunas específicas em vez de `*` quando possível, reduzindo o payload.

## Detalhes Técnicos
- **TanStack Query:** Ajustar `staleTime`, `gcTime` e `refetchInterval`.
- **React:** Uso de `useDeferredValue` para o termo de busca.
- **Supabase:** Otimização de `.select("*")` para `.select("id, name, ...")`.
