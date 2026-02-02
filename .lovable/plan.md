

# Plano: Aprovar Resgate e Enviar ao Bling

## Objetivo
Criar um fluxo de aprovacao de resgates de autores que:
1. Ao aprovar um resgate pendente, cria automaticamente um pedido no Bling
2. Atualiza o status do resgate para "aprovado" com os dados do Bling
3. O fluxo sera similar ao "Aprovar Faturamento" ja existente para pedidos B2B

---

## Entendimento do Fluxo Atual

### Resgate Atual
```text
Autor solicita resgate → status="pendente"
              ↓
Admin ve em /royalties/resgates
              ↓
Clica "Aprovar" → atualiza status para "aprovado" (sem Bling)
              ↓
Admin marca manualmente como "enviado"
```

### Novo Fluxo Proposto
```text
Autor solicita resgate → status="pendente"
              ↓
Admin ve em /royalties/resgates
              ↓
Clica "Aprovar Resgate"
              ↓
[Backend] Edge Function "aprovar-resgate":
  1. Buscar dados do autor (nome, email, endereco)
  2. Criar pedido no Bling (via bling-create-order)
  3. Atualizar resgate com bling_order_id + status="aprovado"
              ↓
Admin ve status atualizado + numero do pedido Bling
```

---

## Modificacoes Necessarias

### 1. Migracao de Banco de Dados

Adicionar campos para vincular o resgate ao Bling:

```sql
-- Adicionar campos do Bling na tabela de resgates
ALTER TABLE royalties_resgates 
ADD COLUMN IF NOT EXISTS bling_order_id TEXT,
ADD COLUMN IF NOT EXISTS bling_order_number TEXT;
```

### 2. Nova Edge Function: aprovar-resgate

**Arquivo**: `supabase/functions/aprovar-resgate/index.ts`

**Responsabilidades**:
- Receber `resgate_id` e validar status="pendente"
- Buscar dados completos do autor (endereco, email)
- Montar itens no formato do Bling (SKU obrigatorio)
- Chamar `bling-create-order` para criar pedido
- Atualizar resgate com dados do Bling e status="aprovado"

**Consideracoes**:
- Usar o mesmo fluxo de criacao de pedido no Bling usado pelo B2B
- O resgate nao gera boleto (autor ja "pagou" com royalties)
- Forma de pagamento: "Conta a receber" (saldo do autor)
- Precisa mapear produtos Shopify → SKU Bling (pode ser desafiador)

### 3. Atualizar Pagina de Resgates (Admin)

**Arquivo**: `src/pages/royalties/Resgates.tsx`

**Modificacoes**:
- Alterar botao "Aprovar" para chamar edge function `aprovar-resgate`
- Exibir numero do pedido Bling quando aprovado
- Mostrar loading durante processamento
- Exibir erro claro se falhar

---

## Desafio: SKU dos Produtos

Para criar pedidos no Bling, precisamos do SKU (codigo) de cada produto. Os resgates salvam `produto_id` do Shopify (ex: `gid://shopify/Product/7377348558982`), mas o Bling precisa do SKU.

**Opcoes**:

| Opcao | Descricao | Complexidade |
|-------|-----------|--------------|
| A | Buscar SKU na Shopify antes de criar no Bling | Alta (nova chamada API) |
| B | Salvar SKU no carrinho ao criar resgate | Media (modificar loja) |
| C | Criar pedido no Bling sem itens (apenas observacoes) | Baixa (menos integrado) |

**Recomendacao**: Opcao B - Modificar a loja do autor para salvar o SKU de cada item junto com os dados ja salvos. Isso evita chamadas extras a API e mantem consistencia.

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/aprovar-resgate/index.ts` | Criar (nova edge function) |
| `src/pages/royalties/Resgates.tsx` | Modificar (chamar edge function) |
| `src/pages/autor/Loja.tsx` | Modificar (salvar SKU nos itens) |
| Migracao SQL | Criar (adicionar colunas bling_order_id/number) |

---

## Estrutura da Edge Function

```text
aprovar-resgate
├── 1. Validar resgate (status=pendente)
├── 2. Buscar autor (nome, email, endereco)
├── 3. Montar itens para Bling
│   └── Usar SKU salvo no resgate
├── 4. Chamar bling-create-order
│   ├── Forma pagamento: "Cortesia/Permuta"
│   ├── Observacao: "Resgate Royalties - Autor [nome]"
│   └── Sem geracao de contas a receber
├── 5. Atualizar resgate
│   ├── status = "aprovado"
│   ├── bling_order_id = resposta
│   └── bling_order_number = resposta
└── 6. Retornar sucesso
```

---

## Resumo das Entregas

1. **Migracao SQL**: Adicionar campos Bling na tabela resgates
2. **Edge Function**: `aprovar-resgate` para processar aprovacao atomica
3. **Loja do Autor**: Salvar SKU dos itens ao criar resgate
4. **Pagina Resgates**: Chamar edge function e exibir resultado

---

## Detalhes Tecnicos

### Dependencias
- Reutiliza `bling-create-order` ja existente
- Usa `supabase.functions.invoke` para chamar edge function

### Seguranca
- Edge function usa `SUPABASE_SERVICE_ROLE_KEY`
- Apenas admin pode aprovar (RLS + verificacao no frontend)

### Tratamento de Erros
- Se Bling falhar, nao atualiza status
- Exibe mensagem clara para o admin
- Log detalhado na edge function

