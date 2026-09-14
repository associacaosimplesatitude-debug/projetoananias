# Registrar permissão pública do resumo diário

## Alteração
- Criar uma única migration contendo exatamente o `GRANT EXECUTE` da função `public.get_resumo_diario_publico(date)` para o papel público anônimo.
- Não alterar a função, a página, rotas ou permissões de outras funções.

## Validação
- Confirmar que a migration foi registrada no histórico do projeto e que a permissão continua ativa sem mudança de comportamento.
