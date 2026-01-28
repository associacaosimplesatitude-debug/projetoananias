

# Correção: Passar filtro isLojaPenha no Loop de Retry

## Problema

Quando o pedido da **Bruna (CPF)** foi criado, funcionou porque não houve conflito de numeração. Porém, quando o pedido **CNPJ (Igreja Assembleia)** foi criado, houve conflito e o sistema entrou no loop de retry. **O retry não passa o filtro `isLojaPenha`**, causando:

1. Sistema calcula `019xxx` corretamente
2. Conflito de número → entra no retry
3. Retry chama `getLastNfeNumber(accessToken, serieAtual, false)` **SEM o filtro Penha**
4. Retorna `30552` (maior de TODAS as faixas)
5. Usa `30553` ao invés de continuar na faixa `019xxx`

---

## Solução

Alterar **linha 737** do arquivo `supabase/functions/bling-generate-nfe/index.ts`:

```typescript
// DE:
let baseNumber: number = await getLastNfeNumber(accessToken, serieAtual, false) || 0;

// PARA:
let baseNumber: number = await getLastNfeNumber(accessToken, serieAtual, false, isLojaPenha) || 0;
```

---

## Detalhes Técnicos

| Item | Valor |
|------|-------|
| Arquivo | `supabase/functions/bling-generate-nfe/index.ts` |
| Linha | 737 |
| Alteração | Adicionar `isLojaPenha` como 4º parâmetro |
| Impacto | Corrige retry para manter faixa 019xxx da Penha |

---

## Resultado Esperado

Após a correção, quando houver conflito na faixa 019xxx:
- Retry buscará apenas números < 30000
- Encontrará o maior número na faixa Penha (ex: 19145)
- Tentará 19146, 19147... até encontrar disponível
- NF-es da Penha permanecerão na faixa correta 019xxx

