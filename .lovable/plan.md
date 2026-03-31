

# Replace email sending with direct Resend API in webhook

## What's wrong
Lines 1074-1087 in `ebd-shopify-order-webhook/index.ts` send the welcome email via `send-ebd-email` edge function, which expects `clienteId` + `templateCode`. The current code passes `to`, `subject`, `html` — an incompatible format. This likely results in silent failures.

## Fix
Replace lines 1074-1087 with a direct Resend API call, matching the pattern already used in `revista-solicitar-otp`.

### Code change (lines 1074-1087)

Replace the `send-ebd-email` fetch block with:

```typescript
if (emailComprador) {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      const urlAcessoEmail = 'https://revistas.centralgospel.com.br/revista/acesso';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Central Gospel <noreply@centralgospel.com.br>',
          to: [emailComprador],
          subject: `Sua ${tituloRevista} está pronta!`,
          html: `<div style="font-family:Arial,sans-serif;...">
            <!-- Full branded HTML with access button, 
                 WhatsApp instructions, order number -->
          </div>`
        })
      });
      console.log('Email de boas-vindas enviado para:', emailComprador);
    }
  } catch (emailErr) {
    console.error('Erro ao enviar email de boas-vindas:', emailErr);
  }
}
```

The HTML will include: greeting with buyer name, magazine title, CTA button linking to `revistas.centralgospel.com.br/revista/acesso`, WhatsApp login instructions, and order number footer.

## Secret status
`RESEND_API_KEY` is already configured in the project secrets. No action needed.

## File changed
- `supabase/functions/ebd-shopify-order-webhook/index.ts` — lines 1074-1087 only

