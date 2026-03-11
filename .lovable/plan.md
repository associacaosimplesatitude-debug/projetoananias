

## Plano: Sistema de Licenças, Acesso por Igreja e Proteção de Dispositivo

Este é um sistema grande. Vou dividir em **3 fases** para manter cada entrega funcional e testável.

---

### FASE 1 — Banco de Dados + Painel do SE + Admin Editora

**Migração SQL — 4 tabelas novas:**

```text
revista_planos
├── id, nome, quantidade_licencas, preco_trimestral/semestral/anual, ativo

revista_licencas
├── id, superintendente_id (→ ebd_clientes), revista_id (→ revistas_digitais)
├── plano, quantidade_total, quantidade_usada, status, inicio_em, expira_em

revista_licenca_alunos
├── id, licenca_id, superintendente_id, aluno_nome/telefone/email/turma
├── status (pendente|aguardando_aprovacao|ativo|bloqueado|expirado)
├── comprovante_url, device_token, device_info, user_id (→ auth.users)
├── troca_dispositivo_solicitada, aprovado_em, aprovado_por

revista_acessos_bloqueados
├── id, aluno_id, device_token_tentativa, device_info_tentativa, ip_address
```

- RLS: SE vê apenas seus alunos; admin vê tudo; aluno vê apenas seu registro
- Storage: bucket `comprovantes` para uploads de comprovantes

**Painel do SE** (`/ebd/revista-virtual/licencas`):
- Card resumo com barra de uso (licenças usadas/total)
- Botão "+ Adicionar Aluno" (modal com nome, telefone, email, turma)
- Botão "Importar CSV" (preview + validação + importação)
- Tabela de alunos com status visual e ações (aprovar, rejeitar, revogar, liberar troca)
- Modal para ver comprovante

**Admin Editora** (`/admin/revista-licencas`):
- Tabela de todas as licenças ativas com SE, alunos, receita
- Botão para adicionar licença manualmente
- Filtros por status, plano, expiração

### FASE 2 — Fluxo do Aluno + Cadastro Público

**Cadastro via link da igreja** (`/cadastro/revista/{codigo_igreja}`):
- Formulário: nome, telefone, email, turma + upload comprovante
- Após envio: tela "Aguarde aprovação do Superintendente"

**Tela do aluno aguardando aprovação:**
- Timeline visual: Cadastro → Comprovante → Aguardando SE → Acesso
- Integrar no `AlunoRevistaVirtual.tsx` verificando `revista_licenca_alunos`

### FASE 3 — Proteção de Dispositivo + WhatsApp

**Device fingerprint** (`src/lib/deviceFingerprint.ts`):
- Gera hash combinando: userAgent, canvas fingerprint, timezone, language
- No acesso à revista: verifica device_token salvo vs atual
- Se diferente: tela de bloqueio com botão "Solicitar Troca"

**Tela de dispositivo bloqueado:**
- Ícone cadeado, mensagem, botão solicitar troca, botão WhatsApp suporte

**Notificações WhatsApp** (usa edge function existente `send-whatsapp-message`):
- 5 mensagens automáticas nos eventos: cadastro, comprovante recebido, aprovação, troca aprovada, revogação

---

### Arquivos criados/alterados

| Arquivo | Ação |
|---------|------|
| Migração SQL | 4 tabelas + RLS + bucket |
| `src/pages/ebd/aluno/LicencasPanel.tsx` | Painel SE (novo) |
| `src/pages/ebd/CadastroRevistaPublico.tsx` | Cadastro aluno público (novo) |
| `src/pages/admin/RevistaLicencasAdmin.tsx` | Admin editora (novo) |
| `src/pages/ebd/aluno/AlunoRevistaVirtual.tsx` | Integrar verificação de licença |
| `src/pages/ebd/aluno/DeviceBloqueado.tsx` | Tela bloqueio dispositivo (novo) |
| `src/lib/deviceFingerprint.ts` | Gerador de fingerprint (novo) |
| `src/App.tsx` | Novas rotas |

### Proposta de execução

Dado o tamanho, sugiro **implementar a Fase 1 primeiro** (tabelas + painel SE + admin), testar, e depois seguir com Fases 2 e 3. Deseja que eu comece pela Fase 1?

