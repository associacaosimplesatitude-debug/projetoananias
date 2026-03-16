

## Plano: PUT de vinculação NF-e ↔ Pedido na `bling-generate-nfe`

### Análise

O `nfeId` pode ser obtido por 3 caminhos (criação direta linha 1019, duplicidade linha 1034/1052, fallback linha 978-980 que alimenta o mesmo fluxo). Todos convergem antes da transmissão na linha 1116. O ponto ideal de inserção é **entre a linha 1114 e 1116** — cobre todos os caminhos.

O fallback da linha 970 não extrai `nfeId` diretamente; ele reatribui `createNfeData` que é processado pelo mesmo bloco de análise (linhas 1014-1114). Portanto, **um único bloco** antes da transmissão é suficiente para cobrir ambos os casos.

### Alteração

**Arquivo**: `supabase/functions/bling-generate-nfe/index.ts`

**Inserir entre linhas 1114 e 1116** (após todos os caminhos que definem `nfeId`, antes do PASSO 2 de transmissão):

```typescript
    // =====================================================================
    // PUT para forçar vínculo NF-e ↔ Pedido no Bling
    // =====================================================================
    if (nfeId && orderId) {
      try {
        const linkResponse = await fetch(`https://api.bling.com.br/Api/v3/nfe/${nfeId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idPedidoVenda: orderId }),
        });
        const linkStatus = linkResponse.status;
        console.log(`[BLING-NFE] PUT vínculo NF-e ${nfeId} ↔ Pedido ${orderId}: HTTP ${linkStatus}`);
      } catch (linkError) {
        console.error(`[BLING-NFE] Falha no PUT de vínculo:`, linkError);
        // Não bloqueia o fluxo — NF-e já foi criada
      }
    }
```

### Escopo
- 1 arquivo editado, 1 bloco inserido (cobre todos os caminhos de criação)
- Deploy automático da Edge Function após alteração
- Nenhuma outra lógica alterada

### Nota técnica
Não é necessário duplicar o bloco no fallback da linha 970 porque o fallback reatribui `createNfeData`/`createNfeResp` e o `nfeId` é extraído pelo mesmo fluxo comum (linhas 1014-1114) que converge antes do ponto de inserção.

