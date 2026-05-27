## Problemas + nova funcionalidade

### 1. Infográfico do Pedro não aparece em `/revista/leitura`
Quando a única licença do cliente é do tipo `infografico`, `RevistaLeitura.tsx` não auto-seleciona a revista (linha 324) **e** o grid "Minha Biblioteca" exige `licencas.length > 1` (linha 1517). Resultado: o cliente vê só pontos + "Descubra mais", sem opção de baixar o PDF.

### 2. Status de email não aparece para o Michel
Michel foi criado pelo caminho `action=insert` em `revista-licencas-shopify-admin`, que **não dispara WhatsApp nem email** — só faz INSERT. Só o "Reenviar Credenciais" (ação `resend`) envia e loga em `ebd_email_logs`. Por isso a aba "Email" do drawer fica vazia até o admin clicar manualmente.

### 3. Novo: botão "Ver emails enviados" estilo Resend
O admin quer, dentro do drawer de cada cliente, abrir um painel com a lista completa de emails enviados àquela pessoa e a timeline de eventos (Enviado → Entregue → Aberto → Clicou) — exatamente como aparece no dashboard do Resend.

---

## Plano

### Parte A — Infográfico solo na biblioteca
Em `src/pages/revista/RevistaLeitura.tsx`, alterar o gate do grid (linha 1517) para:
- Renderizar quando `licencas.length > 1` **ou** quando a única licença é `tipo_conteudo === "infografico"`.
- Mantém auto-select para revista comum solo (comportamento atual).
- O card de infográfico já tem o botão "📥 Baixar PDF" que chama `download-infografico` — só precisa ser exibido.

### Parte B — Envio automático na criação manual da licença
Em `supabase/functions/revista-licencas-shopify-admin/index.ts`, dentro do bloco `action === "insert"`:
1. Após o INSERT, reutilizar exatamente o mesmo fluxo do `action === "resend"`:
   - Buscar título da revista vinculada.
   - Enviar WhatsApp via `send-whatsapp-message` (já loga em `whatsapp_mensagens`).
   - Enviar email via Resend com instrumentação já existente:
     - INSERT em `ebd_email_logs` antes (status `enviado`, `tipo_envio='revista_acesso'`, `dados_enviados = { licenca_id, nome_comprador, revista_titulo }`).
     - URL envolvida em `ebd-email-tracker?type=click&logId=…`.
     - Pixel `ebd-email-tracker?type=open&logId=…` no fim do HTML.
     - Salvar `resend_email_id` retornado.
2. Aceitar flag opcional `skip_notifications: true` para casos especiais (default = envia).
3. Falhas de envio **não** revertem o INSERT.

Em `src/pages/admin/RevistaLicencasAdmin.tsx`, depois do sucesso do `insert`, invalidar/refetch `emailLogs` e `whatsappLogs` daquele cliente para o drawer atualizar sozinho.

### Parte C — Modal "Emails enviados" estilo Resend
**Nova edge function:** `revista-emails-cliente`
- Auth: validar JWT + role `superadmin` (igual a `revista-admin-impersonate`).
- Input: `{ email }` (ou `licenca_id` → resolve email).
- Para cada `ebd_email_logs` daquele destinatário (filtrado por `tipo_envio IN ('revista_acesso','revista_otp','presente_cartas_prisao')`):
  - Selecionar: `id, assunto, status, created_at, email_aberto, data_abertura, link_clicado, data_clique, resend_email_id, dados_enviados, tipo_envio`.
  - Se `resend_email_id` existe, fazer `GET https://api.resend.com/emails/{id}` com `RESEND_API_KEY` para enriquecer com `last_event` (= delivered / bounced / complained) e `created_at` oficial.
- Retornar array ordenado desc por `created_at`, com objeto por email contendo a timeline:
  - `enviado` (sempre — `created_at` do log)
  - `entregue` (de `last_event === 'delivered'` no Resend)
  - `aberto` (`data_abertura`)
  - `clicou` (`data_clique`)
- Falha do Resend não derruba o endpoint — só não enriquece aquele item.

**Novo componente:** `src/components/admin/EmailsClienteDialog.tsx`
- `<Dialog>` shadcn, abre via novo botão **"Ver emails enviados"** colocado em `RevistaLicencasAdmin.tsx`:
  - Drawer de licença (logo abaixo do bloco "Acesso do cliente" — ao lado de "Ver como cliente" / "Reenviar").
  - Linhas da tabela (ícone Mail em um botão pequeno na coluna de ações).
- Layout do dialog (visual inspirado no Resend dos prints):
  - Cabeçalho: ícone de envelope + email do destinatário + botão fechar.
  - **Lista** de emails (estilo print 1): para cada email, linha com ícone, destinatário, **badge de status** (Enviado / Entregue / Aberto / Clicou — cor por estado: verde, azul, roxo) , assunto truncado e "X minutos atrás".
  - Clique em uma linha expande para o **detalhe** (estilo print 2):
    - Header: De / Assunto / Para / Resend ID (copiável).
    - "Eventos por e-mail": stepper horizontal Enviado → Entregue → Aberto → Clicou com data/hora em cada um (cinza quando ainda não aconteceu, colorido quando ocorreu).
    - Linha do tempo segue o mapeamento da edge function.
- Loading state com spinner; estado vazio: "Nenhum email registrado para este cliente."
- Tudo usa tokens semânticos do design system (`bg-card`, `text-foreground`, `border`, etc.).

---

## Arquivos a alterar / criar
- `src/pages/revista/RevistaLeitura.tsx` — gate do grid para infográfico solo.
- `supabase/functions/revista-licencas-shopify-admin/index.ts` — disparar email + WhatsApp + tracking no `insert`.
- `src/pages/admin/RevistaLicencasAdmin.tsx` — botão "Ver emails enviados" + refetch após insert.
- `supabase/functions/revista-emails-cliente/index.ts` *(novo)* — lista emails + enriquecimento Resend.
- `src/components/admin/EmailsClienteDialog.tsx` *(novo)* — modal com lista + timeline.

## Detalhes técnicos
- A edge function `revista-emails-cliente` é deployada automaticamente; não exige nova secret (`RESEND_API_KEY` já existe).
- A timeline reúne dois sinais: nosso `ebd_email_logs` (Enviado/Aberto/Clicou via pixel + click wrapper) e o Resend (`last_event` para Entregue/Bounced).
- Histórico retroativo: emails sem `resend_email_id` mostram só Enviado/Aberto/Clicou conforme o que temos no banco — sem "Entregue".

## Fora do escopo
- Webhook do Resend para receber bounces em tempo real (usaríamos `last_event` por enquanto).
- Tracking de abertura/clique em WhatsApp (Meta não fornece).
