

# 4 Ajustes: Toggle de envio automatico, senha padrao, URLs corretas

## 1. Botao Liga/Desliga para envio automatico de WhatsApp

Adicionar uma configuracao `whatsapp_auto_envio_ativo` na tabela `system_settings` e um botao toggle na pagina WhatsApp (/admin/ebd/whatsapp) na aba de Credenciais.

- Quando desligado, tanto o `funil-posv-cron` quanto o envio automatico no `ebd-shopify-order-webhook` verificam essa flag antes de enviar qualquer mensagem.
- O toggle sera um Switch com label claro "Envio Automatico de WhatsApp" na aba Credenciais.

## 2. Senha padrao fixa: `mudar123`

Substituir a geracao aleatoria de senha (`generateTempPassword(8)`) por uma senha fixa `mudar123` no arquivo `ebd-shopify-order-webhook/index.ts`.

- Linha 592: trocar `const tempPassword = generateTempPassword(8);` por `const tempPassword = "mudar123";`

## 3. Corrigir URL do painel nas mensagens

Substituir TODAS as ocorrencias de `https://gestaoebd.lovable.app` por `https://gestaoebd.com.br` nos seguintes arquivos:

- `supabase/functions/whatsapp-link-tracker/index.ts` (linha 3: PANEL_URL)
- `supabase/functions/funil-posv-cron/index.ts` (linha 10: PANEL_URL, linha 186: URL hardcoded)
- `supabase/functions/ebd-email-cron/index.ts` (linhas 109-110)
- `supabase/functions/send-ebd-email/index.ts` (linhas 83-84)

E corrigir o redirect do `whatsapp-link-tracker` para apontar para `/login/ebd` em vez de `/ebd/painel` como destino padrao.

## 4. Corrigir link do tracker nas mensagens do webhook

No `ebd-shopify-order-webhook/index.ts` (linha 719-720), o link tracker usa a URL crua do Supabase. O redirect `r=/ebd/painel` precisa mudar para `r=/login/ebd` para que ao clicar o cliente va para a pagina de login correta em `gestaoebd.com.br/login/ebd`.

Tambem no `funil-posv-cron/index.ts`, todos os `r=/ebd/painel` e `r=/ebd/escala` devem apontar para caminhos relativos corretos que o link-tracker redirecionara para `gestaoebd.com.br`.

## Secao Tecnica

### Arquivos alterados:

**Edge Functions (backend):**
- `supabase/functions/ebd-shopify-order-webhook/index.ts`:
  - Linha 592: senha fixa `mudar123`
  - Linha 700+: verificar flag `whatsapp_auto_envio_ativo` antes de enviar
  - Linha 720: `r=/ebd/painel` → `r=/login/ebd`
- `supabase/functions/whatsapp-link-tracker/index.ts`:
  - Linha 3: `PANEL_URL` → `https://gestaoebd.com.br`
- `supabase/functions/funil-posv-cron/index.ts`:
  - Linha 10: `PANEL_URL` → `https://gestaoebd.com.br`
  - Linha 186: URL hardcoded → usar `PANEL_URL`
  - Inicio: verificar flag `whatsapp_auto_envio_ativo`, se desligado retorna sem processar
- `supabase/functions/ebd-email-cron/index.ts`:
  - Linhas 109-110: URLs → `https://gestaoebd.com.br/login/ebd` e `.../vendedor/catalogo`
- `supabase/functions/send-ebd-email/index.ts`:
  - Linhas 83-84: mesma correcao de URLs

**Frontend:**
- `src/pages/admin/WhatsAppPanel.tsx`:
  - Adicionar Switch toggle na aba Credenciais para ligar/desligar envio automatico
  - Ler e salvar a key `whatsapp_auto_envio_ativo` em `system_settings`

**Banco de dados:**
- Inserir registro inicial: `INSERT INTO system_settings (key, value) VALUES ('whatsapp_auto_envio_ativo', 'true')` (ligado por padrao)

