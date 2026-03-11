

## Plano: Sistema Completo de Licenças de Revista Virtual (3 Rodadas)

### Rodada 1 — Banco de Dados + Admin

**Migração SQL** — Adicionar colunas faltantes:

- `revista_licencas`: `+revista_aluno_id` (FK revistas_digitais), `+revista_professor_id` (FK revistas_digitais), `+pacote_id` (FK revista_planos), `+chave_pix text`, `+link_pagamento text`, `+qrcode_url text`, `+codigo_pagamento text UNIQUE`
- `revista_licenca_alunos`: `+tipo_revista text DEFAULT 'aluno'`, `+senha_provisoria text DEFAULT 'mudar123'`
- RLS policy anônima em `revista_licencas` para SELECT na página pública (filtrando por `codigo_pagamento`)
- RLS policy anônima em `revista_licenca_alunos` para INSERT pela página pública
- RLS policy anônima em `ebd_clientes` para SELECT (apenas `id, nome_igreja`) pela página pública
- Storage policy anônima para upload no bucket `comprovantes`

**Admin (`RevistaLicencasAdmin.tsx`)** — Expandir dialog:
- Buscar `revistas_digitais` e `revista_planos` para selects
- Campos: SE, Pacote, Revista Aluno, Revista Professor, Plano, Qtd, Início, Expiração
- Gerar `codigo_pagamento` único (8 chars random) ao criar
- `quantidade_usada = 1` (SE já usa 1)
- Mostrar colunas Revista Aluno/Professor na tabela

### Rodada 2 — Painel SE + PIX/QR Code

**Painel SE (`LicencasPanel.tsx`)** — Adicionar:
- 4 cards: Total, Ativos, Pendentes, Disponíveis
- Seção "Minha Chave PIX": input + salvar (grava em `revista_licencas.chave_pix`)
- Após salvar: exibir link `/pagar/{codigo_pagamento}` com botão copiar
- QR Code via `qrcode.react` (já instalado) — gera QR com chave PIX
- Botões "Compartilhar WhatsApp" e "Imprimir QR Code"
- Coluna "Tipo" (Aluno/Professor) na tabela de alunos
- Modal "Adicionar Aluno": campo Tipo Revista (select), senha provisória readonly "mudar123"
- Ao salvar: chamar edge function `create-auth-user-direct` para criar user, gravar `user_id`, enviar WhatsApp com credenciais

### Rodada 3 — Página Pública + Notificações + Ajustes Aluno

**Página pública (`PagamentoRevistaPublico.tsx`)** — Novo componente em `/pagar/:codigo`:
- Busca licença por `codigo_pagamento` (anon, sem auth)
- Busca dados da igreja (nome, logo)
- Exibe: nome da igreja, chave PIX com botão copiar, QR Code PIX
- Formulário: nome, whatsapp, email, senha (min 6), tipo (aluno/professor), upload comprovante
- Ao enviar: cria user via `create-auth-user-direct`, insere em `revista_licenca_alunos`, upload comprovante, incrementa `quantidade_usada`
- Tela de confirmação com timeline
- Rota pública fora do ProtectedRoute em `App.tsx`

**Notificações (`revistaWhatsappNotifications.ts`)**:
- `notificarNovoComprovanteSE()` — quando aluno envia comprovante pela página pública
- Atualizar `notificarAlunoCadastrado()` para incluir email + senha provisória
- Atualizar `notificarAcessoAprovado()` para incluir senha provisória

**Ajustes no aluno (`AlunoRevistaVirtual.tsx`)**:
- Buscar também por `user_id` (não só email) na `revista_licenca_alunos`
- Suportar `tipo_revista` para direcionar à revista correta (aluno vs professor) via `revista_aluno_id` / `revista_professor_id` da licença

---

### Arquivos impactados

| Arquivo | Ação |
|---------|------|
| Migração SQL | ALTER TABLE + novas policies anônimas |
| `src/pages/admin/RevistaLicencasAdmin.tsx` | Expandir dialog, colunas na tabela |
| `src/pages/ebd/aluno/LicencasPanel.tsx` | PIX, QR, 4 cards, tipo revista, auth user |
| `src/pages/ebd/PagamentoRevistaPublico.tsx` | **NOVO** |
| `src/App.tsx` | Rota `/pagar/:codigo` |
| `src/lib/revistaWhatsappNotifications.ts` | Novas funções |
| `src/pages/ebd/aluno/AlunoRevistaVirtual.tsx` | Busca por user_id + tipo_revista |

