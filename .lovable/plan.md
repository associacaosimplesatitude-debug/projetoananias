
# Plano: Corrigir Geração de NF-e para Loja Penha (PDV)

## Diagnóstico dos Logs

A análise dos logs do pedido "Bruna Soares" revelou **dois problemas críticos**:

### Problema 1: Rate Limit 429
```
⚠️ Erro ao buscar página 1 (status: 429)
```
A API do Bling retornou **Too Many Requests** ao buscar NF-es da série 15. Como a busca falhou, o sistema definiu `numero = 1` (primeira NF-e da série).

### Problema 2: Bling IGNORA o Campo `serie` do Payload
| Enviado no Payload | Resposta do Bling |
|--------------------|-------------------|
| `"serie": 15` | `"serie": "1"` |

O Bling **ignorou** a série 15 enviada e usou série 1. Isso acontece porque a **Natureza de Operação** (`id: 15108893128`) provavelmente está configurada internamente no Bling para usar a série padrão da loja (série 1).

### Resultado
- NF-e criada com série 1, número 026991 (sequência da série 1 da Penha)
- Deveria ser série 15, número 019xxx

---

## Causa Raiz

A API do Bling v3 tem um comportamento onde:
1. Se a Natureza de Operação estiver configurada com uma série específica, ela sobrescreve o campo `serie` do payload
2. O campo `serie` no payload é tratado apenas como "sugestão" quando a Natureza tem configuração própria

### Verificação Necessária no Bling
Na conta Bling, verificar a configuração de:
- **Natureza de Operação "PENHA - Venda de mercadoria - PF"** (ID: 15108893128)
- Campo "Série padrão" dentro dessa natureza

Se a série padrão estiver como 1, precisa mudar para 15.

---

## Solução Proposta

### Opção A: Corrigir no Bling (Recomendado)
1. Acessar o Bling → Cadastros → Naturezas de Operação
2. Editar "PENHA - Venda de mercadoria - PF" (ID 15108893128)
3. Configurar **Série padrão = 15**
4. Salvar

Isso fará o Bling usar série 15 automaticamente quando essa natureza for usada.

### Opção B: Ajuste no Código (Fallback)
Se não for possível alterar no Bling, adicionar retry com delay para evitar erro 429 e usar a série configurada na loja:

1. Adicionar tratamento de rate limit (429) com delay e retry
2. Garantir que o payload envie a série correta

---

## Alterações no Código (Para Rate Limit)

### Arquivo: `supabase/functions/bling-generate-nfe/index.ts`

Modificar a função `getLastNfeNumber` para tratar erro 429 com retry:

```javascript
// Se receber 429 (Rate Limit), aguardar 2s e tentar novamente
if (!resp.ok) {
  if (resp.status === 429) {
    console.log(`[BLING-NFE] ⚠️ Rate limit (429) - aguardando 2s antes de retry...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Decrementar página para tentar novamente
    continue;
  }
  console.log(`[BLING-NFE] ⚠️ Erro ao buscar página ${pagina} (status: ${resp.status})`);
  break;
}
```

### Adicionar limite de retries para evitar loop infinito
```javascript
let retryCount = 0;
const MAX_RETRIES_429 = 3;
// ...
if (resp.status === 429 && retryCount < MAX_RETRIES_429) {
  retryCount++;
  await new Promise(resolve => setTimeout(resolve, 2000));
  continue;
}
```

---

## Resumo das Ações

| Ação | Tipo | Prioridade |
|------|------|------------|
| Verificar série padrão na Natureza de Operação Penha no Bling | Configuração Bling | ALTA |
| Se série = 1, alterar para 15 | Configuração Bling | ALTA |
| Adicionar retry para erro 429 no código | Código | MÉDIA |

---

## Detalhes Técnicos

### IDs Relevantes
- Natureza PF Penha: `15108893128`
- Natureza PJ Penha: `15108893188`
- Loja Penha ID: `205891152`
- Série esperada PF: `15`
- Série esperada PJ: `1`

### Fluxo Atual
```text
1. Detecta Loja Penha (ID 205891152) ✓
2. Define série 15 para PF ✓
3. Define natureza 15108893128 ✓
4. Busca último número série 15 → ERRO 429 → numero = 1 ✗
5. Envia payload com serie=15
6. Bling ignora e usa serie=1 (da natureza) ✗
7. NF-e criada com série 1, numero 026991 ✗
```

### Fluxo Corrigido
```text
1. Detecta Loja Penha (ID 205891152) ✓
2. Define série 15 para PF ✓
3. Define natureza 15108893128 (configurada com série 15 no Bling) ✓
4. Busca último número série 15 → Retry se 429 → encontra 019xxx ✓
5. Envia payload com serie=15
6. Bling usa série 15 (da natureza corrigida) ✓
7. NF-e criada com série 15, numero 019xxx ✓
```

---

## Próximos Passos

1. **VOCÊ precisa verificar no Bling** a configuração da Natureza "PENHA - Venda de mercadoria - PF" (ID 15108893128) e confirmar qual série está configurada
2. Se a série estiver como 1, alterar para 15
3. Após ajuste no Bling, implementarei o retry para erro 429 no código

**Me confirme qual série está configurada na Natureza de Operação PF da Penha no Bling.**
