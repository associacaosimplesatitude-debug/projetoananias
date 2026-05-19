## Objetivo
Fazer os cards **Faturados** e **E-commerce** em `/admin/resumo-diario` voltarem a abrir a lista de pedidos corretamente.

## O que vou implementar
1. **Corrigir a função do backend do drilldown**
   - Ajustar `get_resumo_diario_canal_pedidos(date, text)` para usar os nomes de colunas que realmente existem nas tabelas.
   - Em `ebd_shopify_pedidos`, usar `customer_name` e remover referência a `endereco_nome`, que não existe nessa tabela.
   - Em `ebd_loja_pedidos_cg`, manter o fallback com `customer_name` e `endereco_nome`, porque ali ambos existem.
   - Preservar a deduplicação dos pedidos faturados via `bling_order_id`.

2. **Publicar a correção via migration**
   - Criar uma nova migration substituindo a função atual, sem alterar a tela nem a lógica dos demais canais.

3. **Validar com consulta direta**
   - Testar os canais `faturados` e `ecommerce` para a data de ontem.
   - Confirmar que a função retorna registros e que os totais batem com o resumo exibido na página.

## Diagnóstico encontrado
- O frontend está chamando a RPC corretamente.
- O problema está no backend: a função ativa ainda tenta ler `s.endereco_nome` dentro de `ebd_shopify_pedidos`.
- Essa coluna **não existe** em `ebd_shopify_pedidos`, por isso o modal abre e depois fica sem dados.
- Confirmei também que:
  - `ebd_shopify_pedidos` tem `customer_name`, mas **não** `endereco_nome`
  - `ebd_loja_pedidos_cg` tem `customer_name` **e** `endereco_nome`

## Detalhes técnicos
- Arquivo a criar: nova migration em `supabase/migrations/...sql`
- Função afetada: `public.get_resumo_diario_canal_pedidos(date, text)`
- Escopo: apenas correção do drilldown dos canais `faturados` e `ecommerce`
- Sem mudanças visuais na tela, a menos que a validação mostre necessidade real

## Resultado esperado
Ao clicar em **Faturados** e **E-commerce**, o modal deve listar os pedidos normalmente, como já acontece nos outros canais.