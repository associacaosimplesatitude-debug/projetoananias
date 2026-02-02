

# Plano: Menu Royalties no Financeiro e Novo Usuario

## Resumo

Adicionar acesso ao modulo de Royalties para usuarios com role `financeiro` e criar um novo usuario para o setor juridico.

---

## 1. Adicionar Royalties no Menu do Financeiro

### Arquivo: `src/components/admin/AdminEBDLayout.tsx`

Adicionar nova secao "Royalties" no sidebar, visivel apenas para roles `financeiro` e `admin`:

```text
[Financeiro]
├── Aprovacao Faturamento
├── Gestao de Comissoes
└── Royalties (NOVO) → link para /royalties
```

O link direcionara para `/royalties` onde o financeiro tera acesso completo ao painel de royalties.

---

## 2. Liberar Acesso do Financeiro ao Modulo Royalties

### Arquivo: `src/hooks/useRoyaltiesAuth.tsx`

Atualmente o acesso admin ao Royalties e concedido apenas para:
- `admin`
- `gerente_royalties`

Precisamos adicionar `financeiro` a lista:

```typescript
// Antes
const adminAccess = role === 'admin' || role === 'gerente_royalties';

// Depois  
const adminAccess = role === 'admin' || role === 'gerente_royalties' || role === 'financeiro';
```

---

## 3. Atualizar ConditionalNavigation

### Arquivo: `src/components/layout/ConditionalNavigation.tsx`

Garantir que a navegacao principal seja ocultada quando o financeiro acessar rotas de royalties (ja funciona para admin/gerente).

---

## 4. Criar Usuario Financeiro

Usar a edge function `create-auth-user-direct` para criar:

| Campo | Valor |
|-------|-------|
| Email | juridico@centralgospel.com.br |
| Senha | 124578 |
| Nome | Juridico |
| Role | financeiro |

Apos criar o usuario via edge function, sera necessario inserir o role na tabela `user_roles`.

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/hooks/useRoyaltiesAuth.tsx` | Adicionar `financeiro` ao check de acesso |
| `src/components/admin/AdminEBDLayout.tsx` | Adicionar menu Royalties na secao Financeiro |
| `src/components/layout/ConditionalNavigation.tsx` | Verificar navegacao (pode ja estar ok) |
| Banco de dados | Criar usuario + atribuir role financeiro |

---

## Fluxo do Financeiro Apos Implementacao

```text
Login com juridico@centralgospel.com.br
        ↓
Redirect para /admin/ebd/aprovacao-faturamento
        ↓
Sidebar mostra:
├── Aprovacao Faturamento
├── Gestao de Comissoes  
└── Royalties ← NOVO
        ↓
Clique em Royalties
        ↓
Acesso a /royalties com todas funcionalidades
(Dashboard, Autores, Livros, Vendas, Pagamentos, Resgates, etc)
```

