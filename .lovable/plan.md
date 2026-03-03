

## Plano: Área de Criação de Templates WhatsApp com Submissão ao Meta

### Resumo
Criar aba "Templates" no painel WhatsApp para criação, gerenciamento e submissão de templates de mensagem à API Meta para aprovação. Os templates usam variáveis dinâmicas do sistema (nome, produtos, data, valor, etc.) e são enviados ao Meta via Graph API, ficando com status PENDING até aprovação/rejeição.

### 1. Migração — tabela `whatsapp_templates`

```sql
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'MARKETING', -- MARKETING, UTILITY, AUTHENTICATION
  idioma text NOT NULL DEFAULT 'pt_BR',
  corpo text NOT NULL,
  cabecalho_tipo text, -- TEXT, IMAGE, VIDEO, DOCUMENT, null
  cabecalho_texto text,
  rodape text,
  botoes jsonb DEFAULT '[]',
  variaveis_usadas text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'RASCUNHO', -- RASCUNHO, PENDENTE, APROVADO, REJEITADO
  meta_template_id text,
  meta_rejection_reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
-- RLS: authenticated can CRUD
```

### 2. Edge Function `whatsapp-submit-template`
- Recebe template do banco, monta payload no formato da API Meta Message Templates (`POST /v22.0/{WABA_ID}/message_templates`)
- Mapeia variáveis `{{1}}`, `{{2}}` etc. conforme posição no corpo
- Categorias: MARKETING, UTILITY, AUTHENTICATION
- Envia para Meta e salva `meta_template_id` + status `PENDENTE`
- Action `check_status`: consulta status do template no Meta e atualiza (APPROVED → APROVADO, REJECTED → REJEITADO com motivo)

### 3. Componente `WhatsAppTemplateCreator.tsx`
Formulário com:
- **Nome** (snake_case automático)
- **Categoria** (select: Marketing, Utilidade, Autenticação)
- **Idioma** (pt_BR padrão)
- **Corpo** com inserção de variáveis via botões clicáveis:
  - `{{nome_completo}}`, `{{primeiro_nome}}`, `{{produtos_pedido}}`, `{{data_pedido}}`, `{{valor_pedido}}`, `{{categoria_produtos}}`, `{{cpf}}`, `{{cnpj}}`
- **Rodapé** (opcional)
- **Botões** (até 3: Quick Reply ou URL com texto + link)
- **Preview** ao vivo estilo balão WhatsApp (fundo verde claro, substituindo variáveis por dados fictícios)
- Botões: "Salvar Rascunho" e "Enviar para Aprovação Meta"

### 4. Componente `WhatsAppTemplatesList.tsx`
- Tabela: Nome, Categoria, Status (badge colorido), Data
- Ações: Editar (só rascunho), Duplicar, Excluir (só rascunho), Verificar Status (PENDENTE)
- Filtro por status

### 5. Integração no `WhatsAppPanel.tsx`
- Nova aba "Templates" com ícone `FileText` entre "Enviar Mensagem" e "Webhooks"

### 6. Fluxo de status
```text
RASCUNHO → [Enviar p/ Meta] → PENDENTE → [Meta aprova] → APROVADO
                                        → [Meta rejeita] → REJEITADO (com motivo)
```
- Botão "Verificar Status" na lista consulta a API Meta e atualiza o status no banco
- Templates APROVADOS ficam disponíveis para uso no envio de mensagens

### Variáveis → Mapeamento Meta
As variáveis nomeadas (`{{nome_completo}}`) são convertidas para variáveis posicionais (`{{1}}`, `{{2}}`) no momento da submissão ao Meta, com o mapeamento salvo no banco para uso posterior no envio.

### Arquivos a criar/editar
- **Migração**: tabela `whatsapp_templates`
- **Novo**: `src/components/admin/WhatsAppTemplateCreator.tsx`
- **Novo**: `src/components/admin/WhatsAppTemplatesList.tsx`
- **Novo**: `supabase/functions/whatsapp-submit-template/index.ts`
- **Editar**: `src/pages/admin/WhatsAppPanel.tsx` (adicionar aba Templates)

