## Problema

Você se logou como `elielson@editoracentralgospel.com` (perfil **gerente_ebd**) e clicou no botão verde **"Atendimento"** da sidebar do Admin EBD, mas não apareceu a aba/tela de **Conversas**.

## Causa

O botão "Atendimento" do menu (`AdminEBDLayout.tsx`) leva para a rota `/admin/ebd/atendimento-whatsapp`, e essa página (`src/pages/admin/AtendimentoWhatsApp.tsx`) hoje **só carrega um iframe externo** (`crm.houseassessoria.com.br`) — ela não renderiza o componente de Conversas (`WhatsAppChat`) que foi construído no projeto.

A página de Conversas existe e já está liberada para gerente_ebd, mas só dentro de `/admin/whatsapp` (rota protegida apenas para superadmin via `requireAdmin`). Por isso o gerente nunca enxerga a aba Conversas pelo botão "Atendimento".

## Solução proposta

Substituir o conteúdo da página `/admin/ebd/atendimento-whatsapp` para renderizar o componente `WhatsAppChat` diretamente (mesmo componente usado na aba "Conversas" do `WhatsAppPanel`), em vez do iframe externo.

Assim:
- O botão verde **Atendimento** continua aparecendo no topo da sidebar do Admin EBD (já é exibido para todos os perfis dessa área).
- Ao clicar, o gerente_ebd cai direto na tela de Conversas do WhatsApp do projeto, com a mesma UX que o superadmin tem na aba Conversas.

### Arquivos alterados
- `src/pages/admin/AtendimentoWhatsApp.tsx` — trocar iframe por `<WhatsAppChat scope="admin" />` com cabeçalho "Atendimento WhatsApp".

### Fora do escopo
- Não mexer em rotas, em `ProtectedRoute`, em roles, nem na lógica do `WhatsAppPanel`.
- Não tocar no botão "Atendimento" da sidebar (já está correto).
- Sem alteração de banco, RLS ou Edge Functions.
