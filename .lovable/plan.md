

# Sistema de Gestão de Royalties - Implementação no Projeto Atual

## Visão Geral

Implementar o módulo de Royalties dentro do projeto existente, usando a mesma estrutura de:
- Layouts com Sidebar (como `AdminLayout`, `VendedorLayout`, `EBDLayout`)
- Sistema de roles existente (`app_role` enum)
- Padrões de hooks, componentes e autenticação já estabelecidos

## Arquitetura Proposta

### Estrutura de Rotas

```text
/royalties                     → Dashboard Admin (role: admin/gerente_royalties)
/royalties/autores             → Gestão de Autores
/royalties/autores/:id         → Detalhes do Autor
/royalties/livros              → Gestão de Livros
/royalties/vendas              → Registro de Vendas
/royalties/pagamentos          → Gestão de Pagamentos
/royalties/relatorios          → Relatórios

/autor                         → Dashboard do Autor (role: autor)
/autor/livros                  → Meus Livros
/autor/extrato                 → Extrato de Vendas
/autor/pagamentos              → Meus Pagamentos
/autor/perfil                  → Meus Dados
```

### Banco de Dados (Novas Tabelas)

| Tabela | Colunas Principais |
|--------|-------------------|
| `royalties_autores` | id, user_id, nome_completo, email, cpf_cnpj, endereco, dados_bancarios (JSONB), created_at, updated_at |
| `royalties_livros` | id, titulo, descricao, capa_url, valor_capa, autor_id (FK), created_at, updated_at |
| `royalties_comissoes` | id, livro_id (FK), percentual, periodo_pagamento (enum), created_at |
| `royalties_vendas` | id, livro_id (FK), quantidade, valor_comissao_unitario, valor_comissao_total, data_venda, created_at |
| `royalties_pagamentos` | id, autor_id (FK), valor_total, data_prevista, data_efetivacao, status (enum), comprovante_url, created_at, updated_at |
| `royalties_audit_logs` | id, user_id, acao, tabela, dados_antigos, dados_novos, created_at |

### Enums Necessários

```sql
-- Adicionar ao app_role existente
ALTER TYPE public.app_role ADD VALUE 'autor';
ALTER TYPE public.app_role ADD VALUE 'gerente_royalties';

-- Novos enums
CREATE TYPE public.royalties_periodo_pagamento AS ENUM ('1_mes', '3_meses', '6_meses', '1_ano');
CREATE TYPE public.royalties_pagamento_status AS ENUM ('pendente', 'pago', 'cancelado');
```

### RLS Policies

**Regras de Acesso:**
- Admin/Gerente Royalties: acesso total a todas as tabelas
- Autor: acesso apenas aos próprios dados (autores, livros, vendas, pagamentos)

```sql
-- Função helper
CREATE FUNCTION public.has_royalties_access(_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin', 'gerente_royalties')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Autor pode ver apenas seu próprio registro
CREATE POLICY "autor_own_data" ON public.royalties_autores
  FOR SELECT USING (
    user_id = auth.uid() OR has_royalties_access(auth.uid())
  );
```

## Fases de Implementação

### Fase 1: Infraestrutura (Database + Auth)

**1.1 Migração do Banco de Dados:**
- Criar todas as tabelas do módulo royalties
- Adicionar novos valores ao enum `app_role`
- Criar enums específicos do módulo
- Configurar RLS policies
- Criar storage bucket `royalties-capas`

**1.2 Funções Helper:**
- `has_royalties_access(user_id)` - verifica se tem acesso admin
- `is_royalties_autor(user_id)` - verifica se é autor
- `get_autor_id_by_user(user_id)` - retorna o autor_id do usuário

### Fase 2: Layouts e Navegação

**2.1 RoyaltiesAdminLayout:**
- Sidebar com menu:
  - Dashboard
  - Autores
  - Livros
  - Vendas
  - Pagamentos
  - Relatórios
- Header com UserProfileDropdown

**2.2 AutorLayout:**
- Sidebar com menu:
  - Dashboard
  - Meus Livros
  - Extrato
  - Pagamentos
  - Perfil

**2.3 Rotas no App.tsx:**
- Adicionar grupo de rotas `/royalties/*` com RoyaltiesAdminLayout
- Adicionar grupo de rotas `/autor/*` com AutorLayout
- Proteger rotas com verificação de role

### Fase 3: Painel Administrativo

**3.1 Dashboard (`/royalties`):**
- KPIs:
  - Total de Royalties a Pagar (30, 60, 90 dias)
  - Total de Autores Ativos
  - Total de Livros Cadastrados
  - Vendas do Mês
- Gráfico de Vendas Mensais (últimos 12 meses)
- Top 5 Autores com Maiores Ganhos
- Top 5 Livros Mais Vendidos
- Botões de ação rápida

**3.2 Gestão de Autores (`/royalties/autores`):**
- Tabela com busca, filtros e paginação
- Botão "Novo Autor" → Dialog com formulário
- Formulário:
  - Nome Completo, Email, CPF/CNPJ (com validação matemática)
  - Endereço (CEP, Logradouro, Número, Bairro, Cidade, UF)
  - Dados Bancários (Banco, Agência, Conta, Tipo)
  - Checkbox "Criar conta de acesso" → gera user no Supabase Auth
- Ao criar autor com conta: enviar email de boas-vindas

**3.3 Detalhes do Autor (`/royalties/autores/:id`):**
- Dados cadastrais
- Lista de livros do autor
- Histórico de vendas
- Histórico de pagamentos
- Resumo financeiro (total recebido, a receber)

**3.4 Gestão de Livros (`/royalties/livros`):**
- Galeria/Tabela com miniaturas das capas
- Formulário:
  - Título, Descrição
  - Upload de Capa (dropzone → bucket `royalties-capas`)
  - Seleção de Autor
  - Valor de Capa
  - Comissão: Percentual + Período
  - Preview em tempo real: "Comissão por unidade: R$ X,XX"

**3.5 Registro de Vendas (`/royalties/vendas`):**
- Formulário simples:
  - Seleção de Livro (combobox com busca)
  - Quantidade
  - Data da Venda
- Cálculo automático exibido antes de salvar:
  - "Valor unitário: R$ XX,XX"
  - "Comissão unitária: R$ X,XX"
  - "Total da comissão: R$ XX,XX"
- Tabela de vendas com filtros (período, livro, autor)

**3.6 Gestão de Pagamentos (`/royalties/pagamentos`):**
- Lista de pagamentos pendentes agrupados por autor
- Botão "Registrar Pagamento" → Dialog:
  - Seleção de vendas a incluir
  - Valor total calculado
  - Upload de comprovante (PDF)
- Marcar como "Pago" com data e comprovante
- Histórico com filtros

**3.7 Relatórios (`/royalties/relatorios`):**
- Relatório de Vendas (por período, livro, autor)
- Relatório de Comissões
- Projeção de Pagamentos Futuros
- Exportar para Excel/PDF

### Fase 4: Painel do Autor

**4.1 Dashboard (`/autor`):**
- Saldo Atual a Receber
- Gráfico de Ganhos Mensais (12 meses)
- Livros Vendidos no Mês
- Próximo Pagamento (data e valor)
- Atalhos rápidos

**4.2 Meus Livros (`/autor/livros`):**
- Galeria visual com capas
- Card por livro: título, comissão (%), vendas totais, ganhos totais
- Clique → modal com relatório de vendas do livro

**4.3 Extrato (`/autor/extrato`):**
- Tabela com todas as vendas
- Colunas: Data, Livro, Quantidade, Valor Comissão
- Filtros por livro e período

**4.4 Meus Pagamentos (`/autor/pagamentos`):**
- Histórico de pagamentos
- Status (Pendente, Pago, Cancelado)
- Botão para baixar comprovante

**4.5 Meus Dados (`/autor/perfil`):**
- Visualizar/editar dados cadastrais
- Atualizar dados bancários (requer confirmação de senha)
- Alterar senha

### Fase 5: Funcionalidades Avançadas

**5.1 Cálculo de Comissões:**
```
Valor Comissão = Valor de Capa × (Percentual / 100) × Quantidade
```

**5.2 Agrupamento por Período:**
- Agrupar vendas conforme período configurado
- Calcular data de vencimento automaticamente:
  - 1 mês: fim do mês seguinte
  - 3 meses: fim do trimestre seguinte
  - 6 meses: fim do semestre seguinte
  - 1 ano: fim do ano seguinte

**5.3 Auditoria:**
- Trigger para registrar todas as alterações em `royalties_audit_logs`
- Log: user_id, ação, tabela, dados_antigos, dados_novos, timestamp

**5.4 Validações:**
- CPF: algoritmo de dígito verificador (reutilizar do projeto)
- CNPJ: algoritmo de dígito verificador
- Email: único por autor
- Dados bancários: banco, agência e conta obrigatórios

## Arquivos a Criar

### Database (via migration tool)
- Tabelas, enums, policies, functions, triggers, storage bucket

### Layouts
- `src/components/royalties/RoyaltiesAdminLayout.tsx`
- `src/components/royalties/AutorLayout.tsx`
- `src/components/royalties/RoyaltiesProtectedRoute.tsx`

### Páginas Admin
- `src/pages/royalties/Dashboard.tsx`
- `src/pages/royalties/Autores.tsx`
- `src/pages/royalties/AutorDetalhes.tsx`
- `src/pages/royalties/Livros.tsx`
- `src/pages/royalties/Vendas.tsx`
- `src/pages/royalties/Pagamentos.tsx`
- `src/pages/royalties/Relatorios.tsx`

### Páginas Autor
- `src/pages/autor/Dashboard.tsx`
- `src/pages/autor/MeusLivros.tsx`
- `src/pages/autor/Extrato.tsx`
- `src/pages/autor/MeusPagamentos.tsx`
- `src/pages/autor/Perfil.tsx`

### Componentes
- `src/components/royalties/AutorForm.tsx`
- `src/components/royalties/LivroForm.tsx`
- `src/components/royalties/VendaForm.tsx`
- `src/components/royalties/PagamentoDialog.tsx`
- `src/components/royalties/KPICard.tsx`
- `src/components/royalties/VendasChart.tsx`
- `src/components/royalties/TopAutoresCard.tsx`
- `src/components/royalties/TopLivrosCard.tsx`

### Hooks
- `src/hooks/useRoyaltiesAuth.tsx`
- `src/hooks/useAutores.tsx`
- `src/hooks/useLivros.tsx`
- `src/hooks/useVendas.tsx`
- `src/hooks/usePagamentos.tsx`

### Utilitários
- `src/lib/royaltiesValidators.ts` (CPF/CNPJ, email)
- `src/lib/royaltiesCalculations.ts` (cálculos de comissão)

## Detalhes Técnicos

### Validação de CPF/CNPJ
Reutilizar a lógica existente em `CheckoutShopifyMP.tsx` e extrair para `royaltiesValidators.ts`:

```typescript
// src/lib/royaltiesValidators.ts
export const validateCPF = (cpf: string): boolean => { ... };
export const validateCNPJ = (cnpj: string): boolean => { ... };
export const validateCPFOrCNPJ = (value: string): boolean => { ... };
```

### Edge Function (criar autor com conta)
```typescript
// supabase/functions/create-autor-user/index.ts
// Criar usuário no Auth + registro em royalties_autores + role 'autor'
```

### Componentes UI (reutilizar do projeto)
- Dialog, Form, Input, Select, Button (shadcn/ui)
- DataTable com paginação
- Recharts para gráficos
- Dropzone para upload de imagens
- Toast (Sonner) para notificações

## Sequência de Implementação

1. **Fase 1A**: Migração DB (tabelas, enums, policies)
2. **Fase 1B**: Storage bucket + edge function para criar autor
3. **Fase 2**: Layouts + rotas no App.tsx
4. **Fase 3A**: Dashboard admin + Gestão de Autores
5. **Fase 3B**: Gestão de Livros + Vendas
6. **Fase 3C**: Gestão de Pagamentos + Relatórios
7. **Fase 4**: Painel completo do Autor
8. **Fase 5**: Auditoria e refinamentos

## Integração com Projeto Existente

### Menu Admin Geral
Adicionar link "Royalties" no `AdminLayout.tsx`:
```typescript
{ to: "/royalties", icon: BookOpenText, label: "Royalties" }
```

### Redirecionamento por Role
No `DashboardRedirect.tsx`, adicionar:
```typescript
if (role === 'autor') return <Navigate to="/autor" />;
if (role === 'gerente_royalties') return <Navigate to="/royalties" />;
```

### Autenticação
Reutilizar `useAuth` existente, apenas adicionar verificações de role específicas no `useRoyaltiesAuth`.

