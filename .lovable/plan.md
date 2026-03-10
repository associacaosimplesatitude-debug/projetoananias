

## Plano: Suporte a Botão URL Dinâmica em Templates WhatsApp

### Resumo
Adicionar opção "URL Dinâmica" nos botões de tipo URL do template. Quando marcado, o sufixo do botão será preenchido automaticamente com o token do `campaign_links` no momento do envio.

### 1. Frontend — `src/components/admin/WhatsAppTemplateCreator.tsx`

**Interface `TemplateButton`** (linha 37): adicionar campo opcional `url_dinamica?: boolean`

**UI dos botões** (linhas 454-461): quando `tipo === "URL"`, adicionar:
- Checkbox "URL Dinâmica (sufixo automático)"
- Quando marcado, mostrar campo URL base (read-only hint: "o token será adicionado automaticamente")
- Quando desmarcado, manter comportamento atual (URL completa)

### 2. Edge Function — `supabase/functions/whatsapp-send-campaign/index.ts`

**Após montar o componente `body`** (linhas 215-221), adicionar lógica para botões dinâmicos:

```typescript
// Parse botoes from template
const botoes = typeof template?.botoes === 'string' 
  ? JSON.parse(template.botoes) 
  : (template?.botoes || []);

// Add dynamic URL button component if any button has url_dinamica
botoes.forEach((btn: any, idx: number) => {
  if (btn.tipo === "URL" && btn.url_dinamica && linkOferta) {
    const token = linkOferta.split("/").pop(); // extract token from URL
    components.push({
      type: "button",
      sub_type: "url",
      index: idx,
      parameters: [{ type: "text", text: token }],
    });
  }
});
```

Isso garante que quando o template tem um botão URL dinâmica, o token gerado em `campaign_links` é passado como sufixo do botão, e a Meta monta a URL final `https://gestaoebd.com.br/oferta/{token}`.

### 3. Preview — mesma arquivo do Creator

Atualizar o preview dos botões (linhas 536-546) para mostrar indicação visual quando o botão é URL dinâmica (ex: ícone de link + "URL Dinâmica").

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/admin/WhatsAppTemplateCreator.tsx` | Interface TemplateButton + UI checkbox + preview |
| `supabase/functions/whatsapp-send-campaign/index.ts` | Componente button dinâmico na payload Meta |

