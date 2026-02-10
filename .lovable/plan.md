
# Disparos Automaticos de Email - 6 Novos Gatilhos

## Resumo

Adicionar envio automatico de emails nos seguintes eventos, usando os templates que ja existem no banco:

| Evento | Template | Onde adicionar |
|--------|----------|----------------|
| Nova venda registrada | `royalty_venda` | `bling-sync-royalties-sales` (edge function) |
| Relatorio mensal gerado | `relatorio_mensal` | `src/pages/royalties/Relatorios.tsx` (ao gerar) |
| Resgate aprovado | (novo template `resgate_aprovado`) | `aprovar-resgate` (edge function) |
| Resgate solicitado | (novo template `resgate_solicitado`) | `src/pages/autor/Loja.tsx` |
| Novo contrato cadastrado | (novo template `contrato_novo`) | `src/components/royalties/ContratoDialog.tsx` |
| Pagamento efetuado | `pagamento_realizado` | `src/pages/royalties/Pagamentos.tsx` (handleMarcarPago) |

## Templates a criar no banco

Tres templates precisam ser criados (os outros 3 ja existem):

1. **`resgate_aprovado`** - "Seu resgate foi aprovado!"
2. **`resgate_solicitado`** - "Recebemos sua solicitacao de resgate"
3. **`contrato_novo`** - "Novo contrato cadastrado"

## Alteracoes por arquivo

### 1. Migracao SQL - Inserir 3 novos templates

Inserir os templates `resgate_aprovado`, `resgate_solicitado` e `contrato_novo` na tabela `royalties_email_templates`.

### 2. `supabase/functions/bling-sync-royalties-sales/index.ts`

Apos inserir cada venda com sucesso, chamar `send-royalties-email` com:
- Template: `royalty_venda`
- Dados: nome do livro, quantidade, valor
- tipoEnvio: `automatico`

Nota: como esta funcao processa vendas em lote, os emails serao enviados em background sem bloquear o sync. Agrupar vendas por autor para evitar spam (1 email por autor com resumo).

### 3. `supabase/functions/aprovar-resgate/index.ts`

Apos aprovar com sucesso (apos atualizar status para "aprovado"), chamar `send-royalties-email` com:
- Template: `resgate_aprovado`
- Dados: valor total, numero do pedido Bling, lista de itens
- tipoEnvio: `automatico`

### 4. `src/pages/autor/Loja.tsx`

Apos o insert do resgate (onSuccess do mutation), chamar a edge function com:
- Template: `resgate_solicitado`
- Dados: valor total, quantidade de itens
- tipoEnvio: `automatico`

### 5. `src/components/royalties/ContratoDialog.tsx`

Apos insert de novo contrato (nao no update), chamar a edge function com:
- Template: `contrato_novo`
- Dados: nome do livro, datas
- tipoEnvio: `automatico`

### 6. `src/pages/royalties/Pagamentos.tsx`

Na funcao `handleMarcarPago`, apos atualizar status para "pago", chamar a edge function com:
- Template: `pagamento_realizado`
- Dados: valor, data
- tipoEnvio: `automatico`

Precisa buscar o `autor_id` do pagamento para enviar.

### 7. Relatorio mensal (`src/pages/royalties/Relatorios.tsx`)

Ao gerar/exportar relatorio, disparar email com:
- Template: `relatorio_mensal`
- Dados: mes/ano, link ou resumo
- tipoEnvio: `automatico`

## Notas tecnicas

- Todos os disparos usam `supabase.functions.invoke("send-royalties-email", ...)` com `tipoEnvio: "automatico"`
- Nos edge functions (bling-sync e aprovar-resgate), a chamada e feita via `supabase.functions.invoke` internamente
- Emails sao enviados em background (sem await no frontend) para nao bloquear a UI
- O edge function `send-royalties-email` ja esta preparado para receber `tipoEnvio` e registrar no log
