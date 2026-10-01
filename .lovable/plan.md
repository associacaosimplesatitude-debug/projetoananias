# Corrigir percentual da meta dos vendedores

## Implementação
- Alterar somente a exibição de “% Meta” no card individual de vendedor em `VendedoresSummaryCards.tsx`.
- Substituir o arredondamento atual por `Math.floor(item.percentAtingimento)`, preservando vendas, comissão, clientes, barra de progresso e demais percentuais.

## Validação
- Confirmar no banco a fórmula `floor(vendas / meta * 100)` com os mesmos canais somados pelo card.
- Verificar a compilação após a alteração.

## Conferência realizada
- O card existe neste projeto e é o bloco “Performance de Vendedores”.
- Gloria Carreiro possui meta mensal de R$ 105.000,00.
- Nos dados atuais do último mês completo disponível, as vendas somadas pelo card são R$ 116.304,83: percentual exato 110,7665%, `floor` 110% e arredondamento comum 111%.
- O exemplo de R$ 104.727,70 sobre R$ 105.000,00 resulta em 99,74%, portanto será exibido como 99%.
