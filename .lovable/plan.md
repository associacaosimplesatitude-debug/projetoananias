
Objetivo
- Garantir que a NF-e gerada automaticamente herde o valor líquido do pedido (com desconto), mesmo quando o Bling ignora o campo de desconto global no payload do POST /nfe.

Diagnóstico confirmado (com evidência)
- Para o pedido/cliente “ADVEC SARACURUNA”, o backend gerou a NF-e com o payload contendo:
  - itens[0].valor = 10
  - desconto = { valor: 4, unidade: "REAL" }
- Mesmo assim, você confirmou que o total da NF-e no Bling ficou “cheio” (10,00), indicando que o Bling está ignorando (ou não aplicando) esse campo “desconto” no endpoint de criação da NF-e para esse cenário.

Hipótese técnica mais provável
- O endpoint de criação da NF-e do Bling (v3) não aplica desconto global via campo `desconto` (ou espera esse desconto em outro lugar/estrutura).
- Como resultado, mesmo enviando `nfePayload.desconto`, a NF-e fica com total igual à soma dos itens.

Estratégia de correção (robusta)
- Manter a leitura do desconto do pedido (campo `pedido.desconto` e fallback totalProdutos - total) como já foi feito.
- Trocar o modo de aplicação do desconto na NF-e para “valor líquido nos itens” quando detectarmos que o desconto global não está sendo aplicado:
  1) Calcular o total bruto dos itens (somatório item.valor * qtd).
  2) Calcular o total líquido esperado (preferência: `pedido.total` quando existir e for numérico; fallback: bruto - descontoGlobal).
  3) Distribuir o desconto global proporcionalmente entre os itens e ajustar `itensNfe[].valor` (preço unitário) para que a soma final bata com o total líquido esperado.
  4) Nessa modalidade, NÃO enviar `nfePayload.desconto` (para evitar risco de desconto em duplicidade caso o Bling passe a aplicar no futuro).
  5) Garantir arredondamento em 2 casas decimais e “ajuste do último item” para eliminar diferença de centavos.

Validação automática (sem você precisar criar novo pedido)
- Adicionar diagnóstico no próprio `bling-generate-nfe` após a criação da NF-e, lendo o detalhe da NF-e (GET /nfe/{id}) e registrando no log:
  - totais do XML (quando houver) e/ou campos de totalização disponíveis no retorno (ex.: vProd, vDesc, vNF).
- Se o diagnóstico indicar que o total da NF-e ficou igual ao total bruto (isto é, desconto não aplicado), o fluxo passa a:
  - Cancelar/excluir a NF-e recém-criada se ela ainda estiver em rascunho (dependendo do que a API permitir; se não permitir, pelo menos retornar erro orientando a excluir manualmente a NF-e duplicada)
  - Recriar imediatamente a NF-e usando o modo “itens líquidos” descrito acima
  - Prosseguir com envio/polling normalmente

Observações importantes (para não quebrar operações)
- Evitar “duplo desconto”: nunca enviar simultaneamente itens líquidos + `nfePayload.desconto`.
- Lidar com múltiplos itens: distribuição proporcional do desconto e ajuste final de centavos no último item.
- Lidar com itens com quantidade > 1: aplicar desconto no total do item e recalcular valor unitário.
- Lidar com casos sem `pedido.total`: usar (totalProdutos - desconto) como referência.
- Manter logs claros com:
  - totalBrutoItens
  - descontoGlobalDetectado
  - totalLiquidoEsperado
  - totalLiquidoCalculadoPelosItens
  - diferença final em centavos

Arquivos a alterar
- supabase/functions/bling-generate-nfe/index.ts
  - Implementar:
    - extração/diagnóstico de totais na NF-e retornada (XML e/ou campos do retorno)
    - modo de geração “itens líquidos” com rateio do desconto
    - fallback automático: se Bling ignorar desconto global, recriar NF-e com itens líquidos

Sequência de implementação (passo a passo)
1) Instrumentação de validação:
   - Após criar a NF-e, chamar GET /nfe/{id} e extrair:
     - do XML: vProd, vDesc, vNF (quando disponível)
     - caso XML não exista, logar campos numéricos de totalização disponíveis no JSON.
   - Logar “expected vs actual”:
     - esperado: totalLiquidoEsperado (do pedido)
     - atual: total da NF-e (do XML/JSON)
2) Implementar cálculo do total líquido esperado:
   - Preferir `pedido.total` quando numérico e > 0
   - Caso contrário, usar (totalBrutoItens - descontoGlobal)
3) Implementar “rateio de desconto”:
   - Somar total bruto por item = valor * quantidade
   - Para cada item:
     - parte do desconto = descontoGlobal * (itemTotalBruto / totalBrutoItens)
     - itemTotalLiquido = itemTotalBruto - parte do desconto
     - valorUnitLiquido = round2(itemTotalLiquido / quantidade)
   - Ajustar o último item para corrigir diferenças por arredondamento:
     - diferença = totalLiquidoEsperado - somaLiquidaCalculada
     - aplicar diferença no último item (unitário) respeitando 2 casas
4) Montar nfePayload em modo “itens líquidos”:
   - itens: usar os valores unitários líquidos
   - remover `nfePayload.desconto`
   - (opcional) adicionar observação/infocomplementar indicando “Desconto aplicado no valor unitário dos itens para refletir total líquido do pedido” (apenas se for útil operacionalmente)
5) Fallback automático:
   - Se a NF-e criada em modo normal (com desconto global) resultar em total cheio:
     - tentar cancelar/excluir via API (se endpoint existir/funcionar em rascunho)
     - recriar com itens líquidos
6) Teste prático sem novo pedido (reprocessar caso existente):
   - Rodar o `bling-generate-nfe` novamente para um pedido recente com desconto onde a NF-e saiu cheia
   - Confirmar em log:
     - Detecção do problema (total cheio)
     - Recriação com itens líquidos
     - Total final batendo com o pedido
   - Você valida visualmente no Bling o total final da NF-e

Critérios de aceite
- Para pedidos com desconto global (ex.: 10,00 bruto e desconto 4,00), a NF-e deve aparecer com total 6,00 no Bling.
- Logs devem mostrar claramente:
  - desconto detectado
  - total líquido esperado
  - total final da NF-e após criação
  - quando acionou fallback “itens líquidos”
- Não deve haver casos de “duplo desconto”.

Riscos e mitigação
- Risco: não existir endpoint de cancelamento/exclusão de NF-e em rascunho pela API.
  - Mitigação: retornar erro informando que a NF-e anterior precisa ser removida manualmente e não prosseguir com envio; em seguida, orientar reprocesso para recriar corretamente.
- Risco: diferenças de centavos em múltiplos itens.
  - Mitigação: ajuste do último item e logs de diferença.

Nota adicional (fora do escopo principal, mas apareceu nos logs do app)
- Há erros 406/PGRST116 ao consultar “role” do usuário (user_roles retornando 0 linhas com `.single()`).
- Isso não impacta a NF-e, mas pode gerar ruído/instabilidade em outras telas; podemos corrigir depois ajustando as queries para `.maybeSingle()` ou usando `.select(...).limit(1)` sem coerção.
