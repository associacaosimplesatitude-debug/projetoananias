
# Plano: Dar Acesso "Pagar na Loja" ao Vendedor Antonio

## Contexto
A vendedora Gloria (`glorinha21carreiro@gmail.com`) trabalha na Loja Penha e possui acesso especial ao modal "Pagar na Loja", que permite:
- Venda presencial com PIX, Dinheiro ou Maquininha
- Acesso ao menu "PDV Balcao" no painel do vendedor

O vendedor Antonio (`antonio.goulart@editoracentralgospel.com`) também trabalhara na Loja Penha e precisa do mesmo acesso.

## Abordagem Escolhida
Adicionar um campo `polo` na tabela `vendedores` para identificar vendedores de loja/polo de forma escalavel. Isso evita verificacoes hardcoded e facilita adicionar novos vendedores de loja no futuro.

---

## Etapas de Implementacao

### 1. Adicionar campo `polo` na tabela `vendedores`
Criar uma migracao para adicionar o campo `polo` (TEXT, nullable) que indica em qual polo/loja o vendedor trabalha.

```sql
-- Adicionar campo polo na tabela vendedores
ALTER TABLE public.vendedores ADD COLUMN polo TEXT NULL;

-- Atualizar vendedores da Loja Penha
UPDATE public.vendedores 
SET polo = 'penha' 
WHERE email IN ('glorinha21carreiro@gmail.com', 'antonio.goulart@editoracentralgospel.com');
```

### 2. Atualizar VendedorLayout.tsx
Alterar a verificacao de `isPolo` para usar o novo campo:

**De:**
```typescript
const isPolo = vendedor?.email === 'glorinha21carreiro@gmail.com';
```

**Para:**
```typescript
const isPolo = !!vendedor?.polo;
```

### 3. Atualizar ShopifyPedidos.tsx
Alterar a prop `showPagarNaLoja` para usar o novo campo:

**De:**
```typescript
showPagarNaLoja={vendedor?.email?.toLowerCase().includes('glorinha') || false}
```

**Para:**
```typescript
showPagarNaLoja={!!vendedor?.polo}
```

### 4. Atualizar tipos TypeScript
O hook `useVendedor` ja retorna todos os campos da tabela vendedores, entao o campo `polo` estara disponivel automaticamente apos a migracao (o Supabase regenera os tipos).

---

## Arquivos a Modificar
1. `supabase/migrations/[nova].sql` - Adicionar campo e dados
2. `src/components/vendedor/VendedorLayout.tsx` - Linha 73
3. `src/pages/shopify/ShopifyPedidos.tsx` - Linha 1523

---

## Secao Tecnica

### Estrutura do Campo `polo`
- Tipo: TEXT (nullable)
- Valores possiveis: `penha`, `pernambuco`, `matriz`, ou NULL (vendedor externo)
- Vendedores com polo nao-nulo terao acesso a funcionalidades de loja

### Impacto
- Nenhuma alteracao em RLS (campo informativo)
- A edge function `bling-create-order` ja possui o Antonio no mapeamento de IDs
- O modal "Pagar na Loja" ja mostra a label "Loja Penha" corretamente
