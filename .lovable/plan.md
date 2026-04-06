

# Diagnóstico e Correção: 3 mensagens WhatsApp duplicadas + template antigo

## Diagnóstico

Analisei os logs do webhook e do banco de dados. Encontrei **3 problemas graves**:

### Problema 1: Função NÃO foi implantada
O código no repositório tem as correções (supressão do funil_fase1, idempotência, template v2), mas a **função em produção ainda é a versão antiga**. Evidências:
- Os logs mostram 2x `funil_fase1_auto` enviados (status "erro") para um pedido digital — se a supressão estivesse ativa, não tentaria enviar
- Não existe NENHUM registro na tabela `whatsapp_mensagens` com `tipo_mensagem = 'revista_acesso_liberado'` — se a idempotência estivesse ativa, haveria registros
- As mensagens recebidas usam o template antigo (sem botão) — o código novo usa `revista_acesso_liberado_v2`

### Problema 2: Race condition na idempotência
Mesmo com o código novo, há uma falha: quando o Shopify envia 3 webhooks simultaneamente, todas as 3 execuções consultam `whatsapp_mensagens` ao mesmo tempo, não encontram registro, e todas enviam a mensagem. O INSERT acontece DEPOIS do envio, então não protege contra execuções paralelas.

### Problema 3: Pedido criou 2 clientes duplicados
Os logs mostram 2 `funil_fase1_auto` para cliente_ids DIFERENTES (`f77038cd...` e `2447be70...`) — o Shopify disparou o webhook 2+ vezes simultaneamente, criando clientes duplicados.

## Plano de Correção

### 1. Corrigir race condition com verificação atômica
Antes de enviar o WhatsApp `revista_acesso_liberado`, fazer um INSERT com um campo único (shopify_order_id + sku + tipo_mensagem) usando `ON CONFLICT DO NOTHING`. Se o insert retornar 0 rows, significa que outra execução já reservou o envio — pular. Isso substitui o SELECT + INSERT atual que tem a race condition.

Concretamente:
- Inserir registro "placeholder" com `status: 'processando'` ANTES de enviar
- Se o insert falhar por conflito, pular o envio
- Após enviar, atualizar o status para `enviado` ou `erro`

Isso requer criar uma migração com UNIQUE constraint na tabela `whatsapp_mensagens` para `(tipo_mensagem, telefone_destino, payload hash)` ou usar uma tabela de lock separada.

**Alternativa mais simples**: usar a tabela `revista_licencas_shopify` que já tem UNIQUE constraint em `(shopify_order_id, whatsapp, revista_id)` como gate — se o upsert com `ignoreDuplicates: true` retornar sem inserir (já existia), pular o WhatsApp.

### 2. Mover checagem de digital order para fora do bloco de auto-provisioning
A variável `isDigitalOrder` é calculada dentro do bloco `if (!clienteCheck.superintendente_user_id)`. Numa segunda execução do webhook (quando o user já existe), esse bloco inteiro é pulado, então `isDigitalOrder` permanece `false` e o funil_fase1 seria enviado. Mover a checagem de SKUs digitais para ANTES do bloco de auto-provisioning.

### 3. Reimplantar a Edge Function
Após as correções de código, garantir que a função seja implantada.

## Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/ebd-shopify-order-webhook/index.ts` | Mover `isDigitalOrder` para antes do auto-provisioning; substituir idempotência SELECT→INSERT por INSERT atômico com conflict check; manter template v2 |
| Migração SQL | Adicionar constraint UNIQUE ou índice parcial para prevenir duplicatas em `whatsapp_mensagens` |

## Resumo das mudanças no código

1. **Linha ~788**: Mover a extração de SKUs e checagem de `ebd_produto_revista_mapping` para ANTES da linha 668 (início do auto-provisioning), tornando `isDigitalOrder` disponível em todo o fluxo
2. **Linha ~1088-1100**: Substituir o padrão SELECT→INSERT por INSERT atômico:
   ```
   INSERT INTO whatsapp_mensagens (..., status='processando')
   ON CONFLICT DO NOTHING
   RETURNING id
   ```
   Se não retornar `id`, pular envio (outra execução já reservou)
3. **Migração**: Criar índice UNIQUE parcial em `whatsapp_mensagens(tipo_mensagem, telefone_destino)` filtrado por campos do payload, ou usar uma tabela auxiliar `whatsapp_envio_locks(order_id, sku, tipo)` com UNIQUE constraint

