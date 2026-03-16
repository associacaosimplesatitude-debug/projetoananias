

## Plano: Mover PATCH "Atendido" para fora do bloco situacao === 6

### Problema
O bloco PATCH que move o pedido para "Atendido" está dentro do `if (situacao === 6)` (linha 1274). Quando o polling expira com a NF-e ainda em situação 5 (processando), o PATCH nunca executa — mesmo que a SEFAZ já tenha retornado cStat 100 (autorizada).

### Alterações em `supabase/functions/bling-generate-nfe/index.ts`

**1. Criar variável `nfeAutorizadaSefaz` após extrair cStat do XML (após linha 1143)**

```typescript
const nfeAutorizadaSefaz = xmlInfProtCStat === '100';
```

**2. Remover o bloco PATCH de dentro do `if (situacao === 6)` (linhas 1320-1371)**

O bloco que começa com `// MOVER PEDIDO PARA "ATENDIDO"` e termina no `}` do catch será removido dessa posição.

**3. Inserir o bloco PATCH após o polling terminar (após linha 1485, antes do `return` final)**

O bloco PATCH será colocado logo após a atualização de status "PROCESSANDO" do timeout, e também após o `return` do `situacao === 6`. Para cobrir ambos os cenários:

- Extrair o bloco PATCH para uma posição que execute **após** o loop de polling (após linha 1467)
- A condição será `if (orderId && nfeAutorizadaSefaz)` 
- Ficará antes do `return` de "pendente" (linha 1487)

**Fluxo resultante:**
1. Transmissão → extrai `xmlInfProtCStat`, cria `nfeAutorizadaSefaz = cStat === '100'`
2. Polling loop (4 tentativas)
3. Se `situacao === 6` → salva no banco + **return** (já sai da função)
4. Se `situacao === 4` → rejeitada + **return**
5. Após polling expirar → se `nfeAutorizadaSefaz` → executa PATCH para "Atendido"
6. Return "pendente"

**Nota:** No cenário `situacao === 6`, o PATCH precisa continuar executando. Como esse bloco faz `return`, vou manter uma cópia do PATCH lá dentro OU extrair para uma função helper chamada antes de cada `return`. A abordagem mais limpa: **extrair o PATCH para uma função `moverPedidoAtendido(orderId, accessToken)`** e chamá-la em dois pontos:
- Dentro do `if (situacao === 6)`, antes do return
- Após o polling expirar, com `if (nfeAutorizadaSefaz)`

### Resumo das edições
1. Linha ~1143: adicionar `const nfeAutorizadaSefaz = xmlInfProtCStat === '100';`
2. Linhas 1320-1371: extrair para função `moverPedidoParaAtendido(orderId, accessToken)`
3. Linha ~1319: chamar `await moverPedidoParaAtendido(orderId, accessToken);`
4. Linha ~1486: adicionar `if (orderId && nfeAutorizadaSefaz) { await moverPedidoParaAtendido(orderId, accessToken); }`
5. Redeploy da Edge Function

