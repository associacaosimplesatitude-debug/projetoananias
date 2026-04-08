

## Registrar envios de OTP nos logs

### Problema identificado

A edge function `revista-solicitar-otp` envia o código OTP via WhatsApp (Meta API) e opcionalmente por email (Resend), mas **não registra nenhum dos dois envios** na tabela `whatsapp_mensagens`. Isso impede o suporte de verificar se o OTP foi realmente enviado.

No caso da Nathalia: ela solicitou OTP **5 vezes hoje** (nenhum usado), a Meta retornou status 200 para todos, mas sem log no painel é impossível diagnosticar. O email de fallback também não foi registrado.

### Plano

**Arquivo a alterar:** `supabase/functions/revista-solicitar-otp/index.ts`

Após o envio bem-sucedido via Meta API (linha ~186), inserir registro em `whatsapp_mensagens`:

```
tipo_mensagem: "revista_otp"
telefone_destino: metaPhone (com 55)
nome_destino: nome_comprador da licença
mensagem: "Código OTP enviado (template acesso_revista_otp)"
status: "enviado" ou "erro" conforme resposta da Meta
erro_detalhes: JSON do erro se falhou
payload_enviado: body do request à Meta
resposta_recebida: response da Meta
```

Após o envio do email de fallback (linha ~233), inserir registro separado:

```
tipo_mensagem: "revista_otp_email"
telefone_destino: numeroLimpo
nome_destino: nome_comprador
mensagem: "Código OTP enviado por email para {email}"
status: "enviado" ou "erro"
erro_detalhes: mensagem de erro se falhou
```

Isso permite que o drawer de licenças no admin já mostre esses registros automaticamente (a query por `telefone_destino` já existe).

### Resultado esperado

- Cada solicitação de OTP aparece no "Log de Envios" do drawer do cliente
- Visibilidade clara de quantas vezes o cliente tentou, se foi WhatsApp ou email, e se houve erro
- Facilita diagnóstico de reclamações como a da Nathalia

