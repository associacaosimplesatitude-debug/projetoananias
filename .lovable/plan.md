
# Corrigir Comissoes Zero e Auto-Recalcular Apos Sync

## Problema Identificado
Os registros de vendas sincronizados mostram `valor_comissao_total = 0.00` porque foram inseridos por uma sincronizacao anterior quando os percentuais de comissao nao estavam configurados. A sincronizacao atual nao atualiza registros existentes (apenas insere novos). O botao "Recalcular Comissoes" corrige os valores, mas nao e chamado automaticamente.

## Evidencia
- Banco de dados (SQL direto): `valor_comissao_total = 2.32` (apos recalculo)
- API REST (frontend): `valor_comissao_total = 0.00` (antes do recalculo)
- Livros possuem comissoes configuradas (10%, 12%, 15%)
- Sync reportou "0 new records (9 already exist)" - nenhum dado alterado

## Solucao
Modificar o `BlingSyncButton.tsx` para chamar automaticamente a funcao `recalcular_royalties_pendentes` apos cada sincronizacao bem-sucedida. Isso garante que todos os registros pendentes tenham comissoes corretas, inclusive os antigos.

## Alteracoes

### 1. `src/components/royalties/BlingSyncButton.tsx`
- Apos o loop de sincronizacao concluir com sucesso, chamar `supabase.rpc('recalcular_royalties_pendentes')` automaticamente
- Incluir resultado do recalculo na mensagem de sucesso (ex: "X registros recalculados")
- Manter o `onSyncComplete()` apos o recalculo para atualizar a tela

### 2. Fluxo atualizado
1. Sync processa NFes em lotes
2. Apos todos os lotes, chama `recalcular_royalties_pendentes`
3. Exibe toast com resultados da sync + recalculo
4. Invalida queries para atualizar a tela

## Detalhes Tecnicos

### Codigo a adicionar no `runSync` (apos o loop while)
```text
// Apos o loop de sync, recalcular comissoes
const { data: recalcData } = await supabase.rpc('recalcular_royalties_pendentes');
// recalcData retorna { count, antes, depois }
```

### Toast atualizado
```text
`${totalProcessed} NF-es processadas. ${totalQuantidade} livros encontrados. Comissoes recalculadas.`
```

## Resultado esperado
- Comissoes nunca ficam em R$ 0,00 apos uma sincronizacao
- Cards de resumo atualizam automaticamente com valores corretos
- Historico mostra os valores de comissao corretos imediatamente
