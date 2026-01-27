
# Plano: Corrigir Numeração de NF-e para Pagamento na Loja (Penha)

## Diagnóstico Completo

### Por que o Faturamento funciona?
O fluxo de **Faturamento B2B** (`aprovar-faturamento` → `bling-create-order`) funciona corretamente porque:
1. Usa **um único token Bling** (da tabela `bling_config` - RJ)
2. Apenas muda o **`loja.id`** no payload para `205891152` (Polo Penha)
3. A NF-e é gerada pelo próprio Bling no momento da venda, usando a série correta da loja

### Por que "Pagar na Loja" está errado?
O fluxo de **Pagar na Loja** (`bling-generate-nfe`) falha porque:
1. Tenta usar uma **tabela separada** `bling_config_penha` (linhas 331-381)
2. Esta tabela está **vazia** (não há OAuth configurado)
3. Como `bling_config_penha` está vazia, a função retorna erro ou usa RJ como fallback
4. A NF-e é gerada com a conta RJ, usando série errada (030xxx)

### Solução
Modificar `bling-generate-nfe` para usar a **mesma lógica do faturamento**:
- Usar sempre o token de `bling_config` (RJ)
- Ao detectar pedido da Loja Penha, usar a **série e natureza específicas** (já configuradas)
- NÃO tentar buscar `bling_config_penha` (remover essa lógica)

---

## Alterações Necessárias

### Arquivo: `supabase/functions/bling-generate-nfe/index.ts`

#### Mudança 1: Remover lógica de `bling_config_penha` (linhas 324-388)
Substituir todo o bloco de seleção de config por uso direto de `bling_config`:

**Antes (problemático):**
```javascript
if (isLojaPenha) {
  tableName = 'bling_config_penha';
  // ... busca config separada
}
```

**Depois (corrigido):**
```javascript
// SEMPRE usar bling_config (RJ) - é uma única conta com múltiplas filiais
const tableName = 'bling_config';
blingConfig = blingConfigRJ;
accessToken = accessTokenRJ;
console.log(`[BLING-NFE] Usando token UNIFICADO (mesma conta Bling para todas as filiais)`);
```

#### Mudança 2: Manter lógica de série e natureza por filial
A lógica atual de usar série e natureza específicas para Penha (linhas 446-600+) **permanece**:
- `SERIE_PENHA_PJ = 1` (para CNPJ)
- `SERIE_PENHA_PF = 15` (para CPF)
- `NATUREZA_PENHA_PF_ID` e `NATUREZA_PENHA_PJ_ID`

#### Mudança 3: Verificar que a loja já está no pedido
O pedido já tem `loja.id = 205891152` (Penha) porque foi criado pelo `bling-create-order` corretamente. A NF-e deve herdar essa loja.

---

## Fluxo Corrigido

```text
1. Recebe bling_order_id (pedido criado pelo bling-create-order)
2. Busca config do bling_config (RJ) - TOKEN ÚNICO
3. Busca pedido no Bling via API
4. Detecta loja.id do pedido:
   - Se loja.id === 205891152 (Penha):
     - Usa série específica (1 para PJ, 15 para PF)
     - Usa natureza específica (PENHA - Venda)
   - Se outra loja:
     - Usa série padrão RJ
5. Monta payload NF-e com série/natureza corretas
6. Cria NF-e via POST /nfe (mesmo token funciona para todas as filiais)
7. NF-e sai com numeração correta da filial
```

---

## Resultado Esperado

| Cenário | Loja | Série | Numeração |
|---------|------|-------|-----------|
| Faturamento B2B (Penha) | POLO PENHA (205891152) | 1 | 019xxx ✓ |
| Pagar na Loja (Penha) | POLO PENHA (205891152) | 1 | 019xxx ✓ |
| Faturamento B2B (RJ) | FATURADOS (205797806) | 1 | 030xxx ✓ |
| Pagamento Online (RJ) | FATURADOS (205797806) | 1 | 030xxx ✓ |

---

## Resumo Técnico

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/bling-generate-nfe/index.ts` | Remover bloco que tenta usar `bling_config_penha` (linhas 331-388). Usar sempre `bling_config` como fonte de token. Manter lógica de série/natureza por filial. |

O token do Bling é único para toda a conta. O que diferencia as filiais é:
1. O `loja.id` no payload do pedido (já correto)
2. A `serie` da NF-e (a ser corrigido)
3. A `naturezaOperacao.id` da NF-e (já implementado)

A correção remove a dependência de uma configuração OAuth separada que nunca existirá, usando a mesma arquitetura que já funciona no fluxo de faturamento.
