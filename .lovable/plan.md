

## Plano: Geração automática de links personalizados no envio de campanhas

### O que muda

A Edge Function `whatsapp-send-campaign` será atualizada para, **antes de enviar cada mensagem**, gerar automaticamente o link personalizado do cliente e incluí-lo como variável `{{link_oferta}}` no template.

### Alteração principal: `supabase/functions/whatsapp-send-campaign/index.ts`

**Fluxo atualizado (dentro do loop de destinatários):**

1. **Buscar dados do cliente** no `ebd_clientes` usando `cliente_id` ou `email` do destinatário — para obter `senha_temporaria`, `email_superintendente`, status de desconto (`ebd_descontos_categoria_representante`)
2. **Calcular desconto final** com a lógica existente:
   - Sem desconto → 20%
   - Desconto < 30% → atual + 5%
   - Desconto >= 30% → mantém
3. **Gerar UUID token** e **inserir na `campaign_links`** com todos os dados:
   - `token`, `campaign_id` (= campanha_id da `whatsapp_campanhas`), `customer_name`, `customer_email`, `customer_phone`, `last_order_date`, `last_products`, `last_order_value`, `has_discount`, `discount_percentage`, `final_discount`, `access_email`, `access_password`, `panel_url` (= `https://gestaoebd.com.br/vendedor`)
4. **Montar link**: `https://gestaoebd.com.br/oferta/{token}`
5. **Adicionar `link_oferta`** ao switch de variáveis existente (case `"link_oferta"`: retorna o link gerado)
6. **Após envio confirmado pela Meta** (res.ok), inserir evento `message_sent` em `campaign_events`

### Detalhes técnicos

**Variáveis adicionadas no switch (linha ~112):**
```typescript
case "link_oferta": varValues.push(linkOferta); break;
```

**Busca de desconto** — query em `ebd_descontos_categoria_representante` por `cliente_id` e `categoria = 'revistas'`

**Busca de credenciais** — query em `ebd_clientes` por id ou email para obter `senha_temporaria` e `email_superintendente`

**Evento `message_sent`:**
```typescript
await supabase.from("campaign_events").insert({
  link_id: linkRecord.id,
  campaign_id: campanha_id,
  event_type: "message_sent",
  event_data: { phone, template: templateName },
});
```

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/whatsapp-send-campaign/index.ts` | Toda a lógica de geração de links + evento message_sent |

### O que NÃO muda
- Nenhum arquivo frontend precisa ser alterado
- Nenhuma tabela nova precisa ser criada (já existem `campaign_links` e `campaign_events`)
- O fluxo de criação de campanha no painel permanece igual

