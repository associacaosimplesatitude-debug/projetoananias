
# Plano: Corrigir Numeração de NF-e para Loja Penha

## Diagnóstico

O problema está na função `bling-generate-nfe` que **sempre** usa a configuração do Bling da Matriz RJ (`bling_config`) para gerar NF-e, mesmo quando o pedido é da Loja Penha.

### Situação Atual
| Loja | Configuração Bling | Série NF-e | Numeração |
|------|-------------------|------------|-----------|
| Matriz RJ | `bling_config` | 1 | 030xxx |
| Polo Penha | `bling_config_penha` | 1 | 019xxx |

### Problema
A função detecta corretamente que o pedido é da Loja Penha (`isLojaPenha = true`), mas continua usando o token da Matriz RJ para gerar a NF-e. Como a série 1 da Matriz RJ está em outro numerador (030xxx), a nota fica errada.

### Código Problemático (linha 249-256)
```javascript
// Usar integração RJ (todas as vendas presenciais usam bling_config RJ)
const tableName = 'bling_config';  // ❌ SEMPRE usa RJ
```

---

## Solução

### Passo 1: Verificar Primeiro o Pedido no Bling

Antes de selecionar qual configuração usar, precisamos buscar o pedido para saber se é da Loja Penha. Isso requer uma pequena reestruturação do fluxo:

1. Usar `bling_config` (Matriz) para buscar informações do pedido
2. Verificar se `pedido.loja.id === LOJA_PENHA_ID`
3. Se for Penha, trocar para `bling_config_penha` antes de gerar a NF-e

### Passo 2: Corrigir a Função `bling-generate-nfe`

Modificar a lógica para:

```javascript
// PASSO 0: Buscar pedido para detectar loja
// (primeiro com config RJ para leitura)
...
const isLojaPenha = pedido?.loja?.id === LOJA_PENHA_ID;

// PASSO 0.5: Se for Penha, trocar para config da Penha
let tableName = 'bling_config';
if (isLojaPenha) {
  tableName = 'bling_config_penha';
  console.log('[BLING-NFE] ✓ Detectado pedido PENHA - usando bling_config_penha');
}

// Buscar config apropriada
const { data: blingConfig } = await supabase
  .from(tableName)
  .select('*')
  .single();
```

### Passo 3: Garantir que `bling_config_penha` está configurada

A tabela `bling_config_penha` está vazia! Precisa ser preenchida através do callback de OAuth:

```
URL de Callback: /functions/v1/bling-callback-penha
```

Já existem secrets configuradas:
- `BLING_CLIENT_ID_PENHA` ✓
- `BLING_CLIENT_SECRET_PENHA` ✓

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/bling-generate-nfe/index.ts` | Detectar loja do pedido ANTES de selecionar config, e usar `bling_config_penha` quando for Loja Penha |

## Fluxo Corrigido

```text
1. Recebe bling_order_id
2. Busca pedido usando config RJ (para leitura)
3. Detecta se pedido.loja.id === LOJA_PENHA_ID
4. Se sim: usa bling_config_penha para gerar NF-e
5. Se não: usa bling_config (RJ) normalmente
6. Gera NF-e com numeração correta da respectiva conta
```

## Resultado Esperado

- Pedidos da Matriz RJ: NF-e com numeração 030xxx (série 1 da conta RJ)
- Pedidos da Loja Penha: NF-e com numeração 019xxx (série 1 da conta Penha)

## Pré-requisito

Antes de testar, é necessário verificar se `bling_config_penha` tem tokens válidos. Se estiver vazia, será necessário fazer a autenticação OAuth pelo endpoint:
```
/functions/v1/bling-callback-penha
```

---

## Detalhes Técnicos da Implementação

### Estrutura da Correção

A correção principal envolve mover a detecção de loja para **antes** da seleção de configuração do Bling:

1. Fazer uma consulta inicial ao pedido usando config padrão (RJ)
2. Verificar se é pedido Penha
3. Trocar para config Penha se necessário
4. Prosseguir com a geração da NF-e

### Tratamento de Erro

Se `bling_config_penha` estiver vazia ou com token expirado, o sistema deve:
1. Logar aviso claro
2. Retornar erro amigável: "Configuração do Bling para Loja Penha não encontrada. Por favor, reconecte o Bling da Penha."
