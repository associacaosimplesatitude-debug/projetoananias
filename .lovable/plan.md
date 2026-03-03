

## Plano: Segmentação via Bling (busca direta por canal e data)

### Conceito

Substituir a segmentação atual (que consulta tabelas locais Shopify/MP/B2B) por uma busca direta na API do Bling. O fluxo será:

1. Selecionar o **canal** (loja do Bling) — ex: E-COMMERCE, Shopee, Mercado Livre, Atacado
2. Selecionar o **período** (data inicial e final)
3. Clicar "Buscar Público" → chama o Bling, traz todos os pedidos com dados do contato (nome, telefone, CPF/CNPJ)
4. Deduplicação por telefone, exibe os destinatários para seguir com a campanha

### Implementação

#### 1. Nova Edge Function: `bling-search-campaign-audience`

- Recebe: `{ loja_id, data_inicial, data_final }`
- Pagina `GET /pedidos/vendas?idLoja={loja_id}&dataInicial={data_inicial}&dataFinal={data_final}&limite=100&pagina=N`
- Para cada pedido, extrai o contato (nome, telefone, CPF/CNPJ, email) do campo `contato` do pedido
- Se telefone não vier no pedido, faz `GET /contatos/{contato.id}` para buscar detalhes
- Retorna lista deduplicada de destinatários com: nome, telefone, email, tipo_documento (cpf/cnpj), documento
- Usa token OAuth da tabela `bling_config` com refresh automático (mesma lógica existente)
- Rate limiting de 350ms entre chamadas

#### 2. Atualizar UI: `WhatsAppCampaigns.tsx` — Tela de Segmentação

- Substituir os checkboxes de canais (Shopify/MP/B2B) por um **Select de Canal Bling**:
  - E-COMMERCE (205391854)
  - Shopee (204728077)
  - Mercado Livre (204732507)
  - Atacado (205441191)
  - Todos (sem filtro de loja)
- Manter os campos de data inicial/final
- Remover filtro de tipo de documento (virá direto do Bling)
- Ao clicar "Buscar Público", chama a nova edge function em vez de consultar tabelas locais
- Corrigir o bug de UUID: `cliente_id: null` quando não houver vínculo local (esses destinatários vêm do Bling, não têm cliente_id local)

#### 3. Ajuste na criação de campanha

- O campo `cliente_id` no insert de destinatários será `null` para contatos vindos do Bling
- Os dados de nome/telefone/email já vêm preenchidos diretamente do Bling

### Lojas Bling conhecidas

```text
ID          | Canal
205391854   | E-COMMERCE (Shopify)
204728077   | SHOPEE
204732507   | MERCADO LIVRE
205441191   | ATACADO
```

### Resultado

A segmentação fica simples: escolhe o canal, o período, busca no Bling. Todos os pedidos daquele canal com dados completos do contato (nome, telefone, documento).

