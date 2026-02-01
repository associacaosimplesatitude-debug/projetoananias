
# Plano: Sistema de Troca de Royalties por Produtos

## Visão Geral

Criar um sistema completo onde autores podem usar seu saldo de royalties/comissões pendentes para "comprar" produtos da loja, com descontos personalizados por:
1. **Desconto especial nos próprios livros** (ex: 55% no livro do autor)
2. **Descontos por categoria** (igual ao sistema de representantes)

---

## Arquitetura do Sistema

```text
+----------------------------------+
|     CADASTRO DE AUTOR            |
+----------------------------------+
| - Dados básicos (já existe)      |
| + Desconto nos próprios livros   |
| + Descontos por categoria        |
+----------------------------------+
           |
           v
+----------------------------------+
|   PORTAL DO AUTOR                |
+----------------------------------+
| - Meu Saldo Disponível           |
| - Loja (produtos com desconto)   |
| - Meus Resgates                  |
+----------------------------------+
           |
           v
+----------------------------------+
|   GESTÃO ADMIN                   |
+----------------------------------+
| - Aprovar/Processar resgates     |
| - Histórico de resgates          |
+----------------------------------+
```

---

## Mudanças no Banco de Dados

### 1. Nova Tabela: `royalties_descontos_categoria_autor`

Segue o mesmo padrão da tabela de clientes.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `autor_id` | uuid | FK para royalties_autores |
| `categoria` | text | Categoria Shopify (revistas, biblias, livros, etc.) |
| `percentual_desconto` | numeric | Percentual de desconto (0-100) |
| `created_at` | timestamp | Data de criação |
| `updated_at` | timestamp | Data de atualização |

**Constraint**: UNIQUE(autor_id, categoria)

### 2. Alterar Tabela: `royalties_autores`

Adicionar campo:
- `desconto_livros_proprios` (numeric, default 0) - Desconto especial nos livros do próprio autor

### 3. Nova Tabela: `royalties_resgates`

Armazena os pedidos de resgate de produtos.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `autor_id` | uuid | FK para royalties_autores |
| `data_solicitacao` | timestamp | Data do pedido |
| `status` | enum | pendente, aprovado, enviado, cancelado |
| `valor_total` | numeric | Valor total dos produtos (com desconto) |
| `itens` | jsonb | Array de itens [{produto, quantidade, valor_unitario, desconto_aplicado}] |
| `endereco_entrega` | jsonb | Endereço para envio |
| `observacoes` | text | Observações do admin |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

## Componentes a Criar

### 1. Seção de Descontos no Cadastro do Autor

**Arquivo:** `src/components/royalties/AutorDescontosSection.tsx`

Componente similar ao `DescontosCategoriaSection.tsx`, mas para autores:

```text
+------------------------------------------+
|   Descontos do Autor                     |
+------------------------------------------+
| Desconto nos Próprios Livros: [55___] %  |
|                                          |
| Descontos por Categoria:                 |
| Revistas EBD    [30%]  Bíblias    [25%]  |
| Livros          [40%]  Infantil   [20%]  |
| Perfumes        [15%]  Outros     [10%]  |
|                                          |
|                       [Salvar Descontos] |
+------------------------------------------+
```

### 2. Atualizar AutorDialog

Adicionar a seção de descontos no formulário de cadastro/edição de autor.

### 3. Página: Loja do Autor (Portal)

**Arquivo:** `src/pages/autor/Loja.tsx`

Exibe:
- Saldo disponível para resgate (royalties pendentes)
- Produtos da loja com preços já com desconto
- Carrinho de resgate
- Botão para confirmar resgate

```text
+------------------------------------------+
| LOJA - Trocar Royalties por Produtos     |
+------------------------------------------+
| Saldo Disponível: R$ 1.250,00            |
+------------------------------------------+
| [Produto 1]      [Produto 2]             |
| R$ 50,00 → 27,50 R$ 30,00 → 21,00       |
| 45% OFF          30% OFF                 |
| [Adicionar]      [Adicionar]             |
+------------------------------------------+
| MEU CARRINHO                             |
| - Produto 1 x2 = R$ 55,00                |
| Total: R$ 55,00                          |
| [Confirmar Resgate]                      |
+------------------------------------------+
```

### 4. Página: Meus Resgates (Portal)

**Arquivo:** `src/pages/autor/MeusResgates.tsx`

Lista o histórico de resgates com status.

### 5. Página: Gestão de Resgates (Admin)

**Arquivo:** `src/pages/royalties/Resgates.tsx`

Permite ao admin:
- Ver resgates pendentes
- Aprovar/recusar resgates
- Marcar como enviado
- Ver histórico

---

## Lógica de Cálculo de Desconto

```typescript
function calcularDescontoAutor(
  produto: Produto,
  autor: Autor,
  descontosPorCategoria: Record<string, number>
): number {
  // 1. Verificar se é livro do próprio autor
  if (produto.autor_id === autor.id) {
    return autor.desconto_livros_proprios || 0;
  }
  
  // 2. Aplicar desconto por categoria
  const categoria = categorizarProduto(produto.titulo);
  return descontosPorCategoria[categoria] || 0;
}
```

---

## Fluxo de Resgate

1. **Autor acessa a loja** no portal
2. **Vê saldo disponível** (royalties pendentes = não vinculados a pagamento)
3. **Adiciona produtos ao carrinho** (preços já com desconto)
4. **Confirma resgate** (valor <= saldo disponível)
5. **Admin aprova** e cria um registro de débito
6. **Admin marca como enviado** quando o produto for despachado

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/royalties/AutorDescontosSection.tsx` | **Criar** |
| `src/components/royalties/AutorDialog.tsx` | **Modificar** - Adicionar seção de descontos |
| `src/pages/autor/Loja.tsx` | **Criar** |
| `src/pages/autor/MeusResgates.tsx` | **Criar** |
| `src/pages/royalties/Resgates.tsx` | **Criar** |
| `src/components/royalties/RoyaltiesAdminLayout.tsx` | **Modificar** - Adicionar menu "Resgates" |
| `src/components/autor/AutorLayout.tsx` | **Modificar** - Adicionar menu "Loja" e "Meus Resgates" |
| `src/App.tsx` | **Modificar** - Adicionar rotas |

---

## Migração de Banco (SQL)

```sql
-- Adicionar campo de desconto nos próprios livros
ALTER TABLE royalties_autores 
ADD COLUMN desconto_livros_proprios NUMERIC(5,2) DEFAULT 0;

-- Tabela de descontos por categoria para autores
CREATE TABLE royalties_descontos_categoria_autor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id UUID NOT NULL REFERENCES royalties_autores(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  percentual_desconto NUMERIC(5,2) NOT NULL CHECK (percentual_desconto >= 0 AND percentual_desconto <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(autor_id, categoria)
);

-- Tabela de resgates
CREATE TABLE royalties_resgates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id UUID NOT NULL REFERENCES royalties_autores(id),
  data_solicitacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'enviado', 'cancelado')),
  valor_total NUMERIC(10,2) NOT NULL,
  itens JSONB NOT NULL,
  endereco_entrega JSONB,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE royalties_descontos_categoria_autor ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalties_resgates ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Admin full access descontos autor" 
ON royalties_descontos_categoria_autor FOR ALL 
TO authenticated USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admin full access resgates" 
ON royalties_resgates FOR ALL 
TO authenticated USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Autor view own resgates" 
ON royalties_resgates FOR SELECT 
TO authenticated USING (
  autor_id = public.get_autor_id_by_user(auth.uid())
);

CREATE POLICY "Autor insert own resgates" 
ON royalties_resgates FOR INSERT 
TO authenticated WITH CHECK (
  autor_id = public.get_autor_id_by_user(auth.uid())
);
```

---

## Resumo das Entregas

1. **Banco de dados**: 2 novas tabelas + 1 campo novo
2. **Cadastro de Autor**: Seção para configurar descontos
3. **Portal do Autor**: Loja + Meus Resgates
4. **Admin**: Gestão de Resgates
5. **Integração**: Cálculo de descontos específicos por autor
