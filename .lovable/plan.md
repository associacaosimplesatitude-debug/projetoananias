## Objetivo

Em `/admin/ebd/revista-licencas` (aba E-commerce/Shopify), o superadmin poderá:
1. Clicar em "Ver como cliente" e abrir a página `/revista/leitura` exatamente como o cliente vê.
2. Visualizar, por email enviado, três status: **Enviado**, **Aberto**, **Clicou no botão**.

---

## 1. Impersonação do leitor

### Nova edge function `revista-admin-impersonate`
- Recebe `{ licenca_id }` (ou `whatsapp`).
- Verifica via JWT (`getUser()`) que o usuário tem role `superadmin` (`has_role`).
- Busca todas as licenças ativas daquele whatsapp em `revista_licencas_shopify` (mesmo SELECT que `revista-validar-otp`).
- Gera token base64 igual ao `revista-validar-otp`:
  `btoa(JSON.stringify({ whatsapp, exp: Date.now()+86400000, licencas: [...revista_id] }))`.
- Retorna `{ token, licencas, versao_preferida }`.
- **Não** atualiza `primeiro_acesso_em` nem `ultimo_acesso_em` (para não poluir métricas do cliente).

### UI no Drawer (`LicencaEditDrawer`) e na linha da tabela
- Botão "Ver como cliente" (ícone `Eye`) ao lado de Reenviar.
- Ao clicar:
  1. Chama a nova função.
  2. Faz `saveRevistaSession(persistRevistaToken(token), licencas)` no localStorage.
  3. Abre `/revista/leitura` em nova aba (`window.open`).
- Toast explicando que a sessão atual do leitor no navegador foi substituída pela do cliente.

---

## 2. Rastreamento de email (enviado / aberto / clicou)

### Instrumentar envios de email para gravar em `ebd_email_logs`
Atualmente o "Reenviar" em `revista-licencas-shopify-admin` envia via Resend sem logar. Também `liberar-presente-cartas-prisao` e `reprocessar-presentes-pendentes` enviam direto.

Em cada um destes envios:
1. Antes de enviar, `INSERT` em `ebd_email_logs` com:
   - `destinatario`, `assunto`, `status='enviado'`, `tipo_envio='revista_acesso'` (ou `'presente_cartas_prisao'`),
   - `cliente_id` quando disponível,
   - `dados_enviados = { licenca_id, revista_id }`.
2. Capturar o `id` do log e:
   - Trocar a URL do botão `Acessar meu material` por:
     `${SUPABASE_URL}/functions/v1/ebd-email-tracker?type=click&logId={id}&url={encoded original}`
   - Injetar no final do HTML o pixel:
     `<img src="${SUPABASE_URL}/functions/v1/ebd-email-tracker?type=open&logId={id}" width="1" height="1" />`
3. Guardar `resend_email_id` retornado pela API do Resend.

A função `ebd-email-tracker` já atualiza `email_aberto`/`data_abertura` e `link_clicado`/`data_clique` — nenhuma alteração nela.

### UI no Drawer — seção "Log de envios → Email"
- Estender a query atual para selecionar também:
  `email_aberto, data_abertura, link_clicado, data_clique, tipo_envio`.
- Filtrar por `destinatario = email` E (opcionalmente) `tipo_envio IN ('revista_acesso','presente_cartas_prisao')`.
- Para cada log mostrar três chips alinhados:
  - ✅ **Enviado** — `created_at`
  - 👁 **Aberto** — `data_abertura` ou "—"
  - 🖱 **Clicou** — `data_clique` ou "—"
- Cores: verde quando preenchido, cinza quando ainda não ocorreu.
- Remover a frase "Emails de acesso à revista não são registrados no log de envios".

---

## Detalhes técnicos

- Tabela `ebd_email_logs` já tem `email_aberto`, `data_abertura`, `link_clicado`, `data_clique`, `resend_email_id`. Nenhuma migration necessária.
- Política RLS atual já permite que `admin`/`gerente_ebd` visualizem todos os logs; basta confirmar que o superadmin também tem permissão (ou adicionar `OR has_role(auth.uid(),'superadmin')`).
- `revista-admin-impersonate` precisa de bloco em `supabase/config.toml` com `verify_jwt = true` (precisamos do usuário autenticado).
- Cliente envia `Authorization` automaticamente via `supabase.functions.invoke`.

---

## Arquivos a alterar/criar

- `supabase/functions/revista-admin-impersonate/index.ts` (novo)
- `supabase/config.toml` (config da nova função)
- `supabase/functions/revista-licencas-shopify-admin/index.ts` (logar email + envolver URL + pixel)
- `supabase/functions/liberar-presente-cartas-prisao/index.ts` (idem)
- `supabase/functions/reprocessar-presentes-pendentes/index.ts` (idem)
- `src/pages/admin/RevistaLicencasAdmin.tsx`
  - Botão "Ver como cliente" no drawer e na linha
  - Query de `emailLogs` retornando campos extras
  - Renderização dos três status (Enviado / Aberto / Clicou)
- Possível ajuste em política RLS de `ebd_email_logs` para incluir `superadmin`.

---

## Fora do escopo
- Tracking de WhatsApp aberto/clicado (Z-API/Meta não fornecem; mantemos como está).
- Logs históricos retroativos: só novos envios passarão a ter status.