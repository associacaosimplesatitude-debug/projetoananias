

# Funil Primeira Compra no WhatsApp + Links corrigidos + Mensagens com botoes de acao

## 1. Funil Primeira Compra no painel WhatsApp

Adicionar uma nova aba "Funil Primeira Compra" em `/admin/ebd/whatsapp` com visualizacao das 5 fases do funil pos-venda, mostrando quantidade de clientes em cada fase e cores distintas.

**Fases e cores:**
- Fase 1 - Boas-vindas enviada (azul)
- Fase 2 - Lembrete de Login (laranja)
- Fase 3 - Onboarding/Pesquisa (amarelo)
- Fase 4 - Configuracao de Escala (verde-claro)
- Fase 5 - Ativo/Concluido (verde)

Os dados virao diretamente da tabela `funil_posv_tracking` agrupados por `fase_atual`. Ao clicar em cada fase, exibe a lista de clientes naquela etapa.

**Arquivo:** `src/pages/admin/WhatsAppPanel.tsx` - nova aba "Funil" no TabsList.

---

## 2. Corrigir URLs do link tracker

O `TRACKER_BASE_URL` no `funil-posv-cron` e o `TRACKER_BASE` no `ebd-shopify-order-webhook` ainda usam a URL crua do Supabase (`https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/whatsapp-link-tracker`).

**Solucao:** Substituir por um link direto para o painel `https://gestaoebd.com.br/login/ebd` em vez de usar o tracker intermediario. Ou manter o tracker mas com URL amigavel via redirect no dominio principal.

Como o tracker precisa registrar cliques no banco, a melhor abordagem e manter o tracker mas nas mensagens mostrar apenas a URL amigavel `https://gestaoebd.com.br/login/ebd` e fazer o tracking por outro mecanismo (ex: detectar login no banco). Isso elimina URLs estranhas nas mensagens.

**Arquivos:**
- `supabase/functions/ebd-shopify-order-webhook/index.ts` (linha 719-720): trocar `TRACKER_BASE` por URL direta
- `supabase/functions/funil-posv-cron/index.ts` (linha 9 e todas as construcoes de `trackLink`): trocar por URL direta

---

## 3. Redesenhar mensagens do funil com botoes de acao (Z-API)

### Mensagem Fase 1 - Duas mensagens interativas

**Mensagem 1 - Confirmacao de compra (com detalhes do produto):**
Usar endpoint `/send-button-actions` da Z-API para enviar texto com botoes.

```
Ola [nome]! Obrigado por sua compra na Central Gospel! 

Pedido #[numero_pedido]
[lista de produtos com nome e valor]
Frete: R$ [frete]
Total: R$ [total]

Seu pedido esta sendo preparado! Deseja receber seus dados de acesso para acompanhar a entrega?
```

Botao: "Quero acompanhar meu pedido" (tipo URL -> https://gestaoebd.com.br/login/ebd)

**Para incluir detalhes do produto na mensagem**, sera necessario adicionar `line_items` ao payload do Shopify webhook (ja vem por padrao no webhook do Shopify, so precisa tipar na interface e usar).

### Estrutura Z-API send-button-actions

```json
{
  "phone": "5511999999999",
  "message": "Texto da mensagem...",
  "title": "Central Gospel - Pedido Confirmado",
  "footer": "gestaoebd.com.br",
  "buttonActions": [
    {
      "id": "1",
      "type": "URL",
      "url": "https://gestaoebd.com.br/login/ebd",
      "label": "Acompanhar Pedido"
    }
  ]
}
```

### Fases subsequentes do funil

Todas as mensagens do `funil-posv-cron` tambem serao convertidas para usar `/send-button-actions` com botoes de URL em vez de texto puro com links.

---

## Secao Tecnica

### Interface ShopifyOrder (webhook)
Adicionar `line_items` a interface:
```typescript
line_items: Array<{
  title: string;
  quantity: number;
  price: string;
  variant_title?: string;
}>;
```

### Arquivos alterados:

**`supabase/functions/ebd-shopify-order-webhook/index.ts`:**
- Adicionar `line_items` na interface `ShopifyOrder`
- Linha 719: remover `TRACKER_BASE`, usar URL direta
- Linhas 722-726: reescrever mensagem Fase 1 com detalhes do produto (nome, quantidade, valor, frete, total)
- Linhas 729-735: trocar de `send-text` para `send-button-actions` com payload de botoes
- Mudar referencia de "Painel EBD" para "Central Gospel" na mensagem

**`supabase/functions/funil-posv-cron/index.ts`:**
- Linha 9: remover `TRACKER_BASE_URL`
- Todas as construcoes de mensagem: trocar de `send-text` para `send-button-actions`
- Remover links crus, usar botoes de acao
- Funcao `sendWhatsAppMessage`: aceitar parametro opcional de `buttonActions` e escolher endpoint dinamicamente

**`src/pages/admin/WhatsAppPanel.tsx`:**
- Adicionar aba "Funil" no TabsList
- Criar componente de visualizacao do funil com barras coloridas (similar ao VendedorFunil)
- Query na tabela `funil_posv_tracking` agrupada por `fase_atual`
- Ao clicar na fase, expandir lista de clientes com nome, telefone e status do WhatsApp

### Funcao auxiliar para send-button-actions

Criar funcao reutilizavel no `funil-posv-cron`:
```typescript
async function sendWhatsAppWithButtons(
  instanceId, zapiToken, clientToken,
  telefone, message, title, footer,
  buttonActions, nome, tipoMensagem, supabase
)
```
Que usa `/send-button-actions` quando ha botoes, ou `/send-text` como fallback.

