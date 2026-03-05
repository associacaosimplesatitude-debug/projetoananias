

## Plano: Menu "Implementações" no Admin Geral

### O que será feito

1. **Tabela `system_implementations`** — migração SQL para criar a tabela e inserir 20 registros iniciais com as últimas implementações do sistema.

2. **Nova página `src/pages/admin/Implementacoes.tsx`** — timeline/changelog mostrando título, descrição, data e categoria, ordenado por data decrescente.

3. **Rota no `src/App.tsx`** — adicionar `<Route path="implementacoes" element={<Implementacoes />} />` dentro do bloco `/admin`.

4. **Sidebar no `src/components/admin/AdminLayout.tsx`** — adicionar item "Implementações" com ícone `Rocket` (ou `ListChecks`) na seção "Outros" do sidebar, antes de "Apresentação".

### Tabela

```sql
CREATE TABLE public.system_implementations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'vendas', 'ebd', 'integracao', 'admin', etc.
  implemented_at DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_implementations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read implementations"
ON public.system_implementations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
```

Depois, inserir 20 registros com as implementações recentes (via insert tool).

### Dados iniciais (20 implementações)

| Data | Título |
|------|--------|
| 2026-03-05 | Busca de cliente por nome na Calculadora de Peso |
| 2026-03-05 | Campo de quantidade editável nos itens do carrinho |
| 2026-03-05 | Webhooks atualizados para API Oficial Meta |
| 2026-03-05 | Menu Implementações no painel admin |
| 2026-02-28 | PDV Balcão para vendedores de polo |
| 2026-02-25 | Funil de Vendas para vendedores |
| 2026-02-22 | Sistema de Parcelas (Minhas Parcelas) |
| 2026-02-20 | Gestão de Comissão AlfaMarketing |
| 2026-02-18 | Integração Mercado Pago com propostas |
| 2026-02-15 | Transferência de Clientes entre vendedores |
| 2026-02-12 | Leads de Landing Page (admin e vendedor) |
| 2026-02-10 | Google Ads — Notas Fiscais e Recargas PIX |
| 2026-02-08 | Portal do Autor (Royalties) |
| 2026-02-05 | Sistema de Royalties completo |
| 2026-02-01 | Emails EBD automáticos |
| 2026-01-28 | Pedidos por Marketplace (Amazon, Shopee, ML) |
| 2026-01-25 | Aprovação de Faturamento com integração Bling |
| 2026-01-20 | WhatsApp API Oficial — envio e recebimento |
| 2026-01-15 | Funil Pós-Venda E-commerce |
| 2026-01-10 | Dashboard de Canais de Venda unificado |

### Arquivos alterados

- **Migração SQL**: criar tabela + RLS
- **Insert SQL**: 20 registros iniciais
- **`src/pages/admin/Implementacoes.tsx`**: nova página
- **`src/components/admin/AdminLayout.tsx`**: item no sidebar
- **`src/App.tsx`**: rota `/admin/implementacoes`

