

# Sistema de Gestão de Royalties para Editora

## Resumo do Projeto

Sistema web completo para gestão de royalties de uma editora, com dois painéis principais:
- **Painel Administrativo**: Para a equipe da editora gerenciar autores, livros, vendas e pagamentos
- **Painel do Autor**: Para autores acompanharem seus ganhos de forma transparente

## Arquitetura do Sistema

### Estrutura de Dados

```text
┌──────────────────────────────────────────────────────────────────┐
│                        BANCO DE DADOS                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐    │
│  │  autores    │     │   livros    │     │    comissoes    │    │
│  │─────────────│     │─────────────│     │─────────────────│    │
│  │ id          │◄────┤ autor_id    │     │ livro_id        │───►│
│  │ user_id     │     │ titulo      │◄────┤ percentual      │    │
│  │ nome        │     │ valor_capa  │     │ periodo_pgto    │    │
│  │ cpf_cnpj    │     │ capa_url    │     └─────────────────┘    │
│  │ endereco    │     └─────────────┘                            │
│  │ dados_banco │                                                 │
│  └─────────────┘     ┌─────────────┐     ┌─────────────────┐    │
│                      │   vendas    │     │   pagamentos    │    │
│                      │─────────────│     │─────────────────│    │
│                      │ livro_id    │     │ autor_id        │    │
│                      │ quantidade  │     │ valor_total     │    │
│                      │ vlr_comissao│     │ data_prevista   │    │
│                      │ data_venda  │     │ status          │    │
│                      └─────────────┘     │ comprovante_url │    │
│                                          └─────────────────┘    │
│                                                                  │
│  ┌─────────────────┐     ┌─────────────────────────────────┐    │
│  │   user_roles    │     │          audit_logs             │    │
│  │─────────────────│     │─────────────────────────────────│    │
│  │ user_id         │     │ user_id, acao, tabela, dados    │    │
│  │ role (enum)     │     │ created_at                      │    │
│  └─────────────────┘     └─────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Fluxo de Navegação

```text
                    ┌─────────────────┐
                    │   Login Page    │
                    │  /auth/login    │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     ┌────────────────┐            ┌────────────────┐
     │  ADMIN PANEL   │            │  AUTHOR PANEL  │
     │    /admin      │            │    /autor      │
     └───────┬────────┘            └───────┬────────┘
             │                             │
    ┌────────┼────────┐           ┌────────┼────────┐
    ▼        ▼        ▼           ▼        ▼        ▼
Dashboard  CRUD    Vendas     Dashboard  Livros  Extrato
 │Autores  Pagtos              │Ganhos   │Vendas  │Pgtos
 │Livros                       │KPIs     │        │
```

## Fases de Implementação

### Fase 1: Infraestrutura Base

**Banco de Dados - Tabelas:**

| Tabela | Colunas Principais | RLS |
|--------|-------------------|-----|
| `autores` | id, user_id, nome_completo, email, cpf_cnpj, endereco, dados_bancarios (JSONB) | Admin: full access; Autor: próprio registro |
| `livros` | id, titulo, descricao, capa_url, valor_capa, autor_id | Admin: full; Autor: próprios livros |
| `comissoes` | id, livro_id, percentual, periodo_pagamento (enum) | Admin: full |
| `vendas` | id, livro_id, quantidade, valor_comissao_unitario, valor_comissao_total, data_venda | Admin: full; Autor: via livros |
| `pagamentos` | id, autor_id, valor_total, data_prevista, data_efetivacao, status, comprovante_url | Admin: full; Autor: próprios |
| `audit_logs` | id, user_id, acao, tabela, dados_antigos, dados_novos, created_at | Admin: read only |
| `user_roles` | id, user_id, role (enum: 'admin', 'autor') | Via função has_role |

**Autenticação:**
- Login com email/senha usando Supabase Auth
- Criação de conta de autor pelo admin
- Recuperação de senha ("Esqueci minha senha")
- Roles separadas em tabela `user_roles`

**Estrutura de Pastas:**
```
src/
├── components/
│   ├── admin/           # Componentes do painel admin
│   ├── autor/           # Componentes do painel autor
│   └── ui/              # Componentes UI (shadcn)
├── pages/
│   ├── auth/            # Login, recuperar senha
│   ├── admin/           # Páginas do admin
│   └── autor/           # Páginas do autor
├── hooks/
│   ├── useAuth.tsx
│   ├── useAutores.tsx
│   ├── useLivros.tsx
│   ├── useVendas.tsx
│   └── usePagamentos.tsx
└── lib/
    ├── validators.ts    # Validação CPF/CNPJ
    └── formatters.ts    # Formatação moeda/data
```

### Fase 2: Painel Administrativo

**2.1 Dashboard Admin (`/admin`)**
- KPIs: Total royalties a pagar (30, 60, 90 dias)
- Gráfico de vendas mensais (últimos 12 meses)
- Top 5 autores com maiores ganhos
- Top 5 livros mais vendidos
- Botões de ação rápida

**2.2 Gestão de Autores (`/admin/autores`)**
- Listagem com busca e paginação
- Formulário de cadastro/edição:
  - Validação matemática de CPF/CNPJ
  - Dados bancários (banco, agência, conta, tipo)
  - Geração automática de conta de acesso
- Página de detalhes do autor com:
  - Todos os seus livros
  - Histórico de vendas
  - Histórico de pagamentos

**2.3 Gestão de Livros (`/admin/livros`)**
- Listagem com miniaturas das capas
- Formulário com:
  - Upload de imagem (bucket `royalties-capas`)
  - Seleção de autor
  - Configuração de comissão (% e período)
  - Preview do cálculo em tempo real

**2.4 Registro de Vendas (`/admin/vendas`)**
- Formulário simples: livro + quantidade + data
- Cálculo automático da comissão
- Listagem com filtros (período, livro, autor)

**2.5 Gestão de Pagamentos (`/admin/pagamentos`)**
- Lista de pagamentos pendentes agrupados por autor
- Marcar como pago + upload de comprovante
- Histórico completo com filtros

### Fase 3: Painel do Autor

**3.1 Dashboard (`/autor`)**
- Saldo atual a receber
- Gráfico de ganhos mensais
- Livros vendidos no mês
- Data do próximo pagamento

**3.2 Meus Livros (`/autor/livros`)**
- Galeria visual com capas
- Detalhes: comissão, vendas, ganhos
- Relatório de vendas por livro

**3.3 Extrato (`/autor/extrato`)**
- Histórico de vendas em tempo real
- Filtros por livro e período
- Exportação (opcional)

**3.4 Meus Pagamentos (`/autor/pagamentos`)**
- Histórico com status
- Download de comprovantes

**3.5 Meus Dados (`/autor/perfil`)**
- Visualizar/editar dados cadastrais
- Atualizar dados bancários (com confirmação de senha)

### Fase 4: Funcionalidades Avançadas

**4.1 Cálculo de Comissões**
```
Valor Comissão = Valor de Capa × (Percentual / 100) × Quantidade
```

**4.2 Agrupamento por Período**
- Vendas agrupadas conforme período configurado (1, 3, 6, 12 meses)
- Data de vencimento calculada automaticamente

**4.3 Relatórios (Excel/PDF)**
- Relatório de vendas
- Relatório de comissões
- Projeção de pagamentos futuros

**4.4 Notificações (opcional)**
- Email ao autor quando livro vendido
- Email ao autor quando pagamento realizado
- Alerta ao admin sobre vencimentos próximos

**4.5 Auditoria**
- Log de todas as alterações
- Quem, quando, o quê foi alterado

## Validações Implementadas

| Campo | Validação |
|-------|-----------|
| CPF | Algoritmo de dígito verificador |
| CNPJ | Algoritmo de dígito verificador |
| Email | Formato válido + único no sistema |
| Dados bancários | Banco, agência e conta obrigatórios |
| Percentual comissão | Entre 0.01 e 100 |
| Quantidade venda | Inteiro positivo |

## Componentes UI (usando shadcn/ui)

- **Formulários**: react-hook-form + zod
- **Tabelas**: DataTable com paginação e busca
- **Gráficos**: Recharts
- **Upload**: Dropzone para imagens
- **Modais**: Dialog para confirmações
- **Toast**: Sonner para notificações

## Segurança

1. **Autenticação**: Supabase Auth com JWT
2. **Autorização**: RLS policies por role
3. **Função has_role**: Security definer para evitar recursão
4. **Criptografia**: Dados sensíveis em JSONB (dados_bancarios)
5. **Auditoria**: Trigger para log de alterações

## Arquivos a Criar

### Banco de Dados (Migrations)
- `create_royalties_tables.sql` - Todas as tabelas
- `create_royalties_rls.sql` - Políticas de segurança
- `create_royalties_functions.sql` - Funções auxiliares
- `create_royalties_triggers.sql` - Triggers de auditoria

### Frontend

**Páginas:**
- `/auth/login` - Login
- `/auth/recuperar-senha` - Recuperação de senha
- `/admin` - Dashboard admin
- `/admin/autores` - Gestão de autores
- `/admin/autores/[id]` - Detalhes do autor
- `/admin/livros` - Gestão de livros
- `/admin/vendas` - Registro de vendas
- `/admin/pagamentos` - Gestão de pagamentos
- `/admin/relatorios` - Relatórios
- `/autor` - Dashboard autor
- `/autor/livros` - Meus livros
- `/autor/extrato` - Extrato de vendas
- `/autor/pagamentos` - Meus pagamentos
- `/autor/perfil` - Meus dados

**Componentes:**
- `AdminLayout.tsx` - Layout do painel admin
- `AutorLayout.tsx` - Layout do painel autor
- `AutorForm.tsx` - Formulário de autor
- `LivroForm.tsx` - Formulário de livro
- `VendaForm.tsx` - Formulário de venda
- `PagamentoDialog.tsx` - Modal de pagamento
- `KPICard.tsx` - Card de KPI
- `VendasChart.tsx` - Gráfico de vendas

**Hooks:**
- `useRoyaltiesAuth.tsx` - Autenticação específica
- `useAutores.tsx` - CRUD autores
- `useLivros.tsx` - CRUD livros
- `useVendas.tsx` - Gestão de vendas
- `usePagamentos.tsx` - Gestão de pagamentos
- `useRelatorios.tsx` - Geração de relatórios

## Estimativa de Implementação

| Fase | Descrição | Complexidade |
|------|-----------|--------------|
| 1 | Infraestrutura (DB + Auth) | Alta |
| 2 | Painel Admin completo | Alta |
| 3 | Painel Autor | Média |
| 4 | Funcionalidades avançadas | Média |

## Observação Importante

Como você escolheu **criar um novo projeto separado**, recomendo:

1. Criar um novo projeto no Lovable
2. Copiar este plano para o novo projeto
3. Implementar fase por fase

Isso mantém o sistema de Gestão EBD isolado e evita conflitos.

