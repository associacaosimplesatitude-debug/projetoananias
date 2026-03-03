

## Plano: Garantir que mensagens enviadas apareçam nas conversas

### Diagnóstico

Analisando o banco de dados:
- **`whatsapp_conversas`**: última entrada em **20/02** — nenhuma mensagem nova salva desde então
- **`whatsapp_mensagens`**: última entrada em **02/03** — as mensagens enviadas ficam apenas aqui
- **Webhooks Meta**: **zero eventos recebidos desde 03/03** — o webhook Meta não está recebendo callbacks

O chat view já consulta as duas tabelas (`whatsapp_conversas` + `whatsapp_mensagens`) e faz merge, mas há dois problemas:

1. **Inconsistência de formato de telefone entre tabelas** — `whatsapp_conversas` tem "5511947141878" enquanto `whatsapp_mensagens` tem "11947141878". A função `phoneVariants` deveria resolver isso, mas como as duas tabelas são consultadas separadamente, a unificação pode falhar em cenários com formatos inesperados.

2. **Mensagens enviadas via painel não são salvas em `whatsapp_conversas`** — o `send-whatsapp-message` salva APENAS em `whatsapp_mensagens`. Isso cria dependência do merge cross-table funcionar perfeitamente.

### Solução

**Arquivo: `supabase/functions/send-whatsapp-message/index.ts`**

Após enviar com sucesso pela Meta API, além de salvar em `whatsapp_mensagens` (que já faz), também inserir em `whatsapp_conversas` com `role: "assistant"`:

```typescript
// Após o insert em whatsapp_mensagens (já existente)
if (isSuccess) {
  await supabase.from("whatsapp_conversas").insert({
    telefone: formattedPhone,  // formato normalizado com "55"
    role: "assistant",
    content: mensagem,
    imagem_url: imagem_url || null,
  });
}
```

Isso garante que TODA mensagem enviada com sucesso aparece na timeline de `whatsapp_conversas`, eliminando a dependência do merge entre duas tabelas.

**Arquivo: `src/components/admin/WhatsAppChat.tsx`**

Ajustar a query de mensagens para evitar duplicatas: ao carregar mensagens de `whatsapp_conversas` com `role: "assistant"`, não carregar também de `whatsapp_mensagens` se o mesmo conteúdo/timestamp já existir. Solução: filtrar duplicatas por timestamp+content ao fazer o merge.

### Resumo
- 2 arquivos alterados: `send-whatsapp-message/index.ts` e `WhatsAppChat.tsx`
- Sem migração de banco
- Redeploy da edge function

