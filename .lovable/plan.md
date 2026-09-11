# Corrigir autenticação do download de infográficos

## Alteração
- Editar somente `supabase/functions/download-infografico/index.ts`.
- Importar e usar `verifyRevistaToken()` do módulo compartilhado.
- Remover o decoder local e a validação manual de expiração.
- Manter inalteradas as consultas, validação de licença, URL assinada e respostas de erro.

## Validação
- Confirmar que o arquivo usa o token assinado no formato atual e que tokens inválidos continuam retornando `unauthenticated`.
- Verificar o estado da compilação após a alteração.
