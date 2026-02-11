

# Filtros em Relatorios + Pagamentos Parciais com Saldo

## Resumo

Duas melhorias principais:
1. Adicionar filtros por **Autor** e **Livro** na pagina de Relatorios (`/royalties/relatorios`)
2. Permitir **pagamentos parciais** na pagina de Pagamentos (`/royalties/pagamentos`), com saldo do autor visivel, debito do saldo, e reflexo no extrato do autor e no relatorio

---

## 1. Filtros por Autor e Livro em Relatorios

**Arquivo:** `src/pages/royalties/Relatorios.tsx`

- Adicionar dois novos estados: `filtroAutor` e `filtroLivro`
- Buscar lista de autores (`royalties_autores`) e livros (`royalties_livros`) para popular os selects
- Aplicar filtros na query de vendas/comissoes/pagamentos:
  - Vendas: filtrar por `autor_id` do livro e/ou `livro_id`
  - Comissoes: idem, via join com `royalties_livros`
  - Pagamentos: filtrar por `autor_id`
- Adicionar dois `Select` na area de filtros (grid md:grid-cols-6 ao inves de md:grid-cols-4)

---

## 2. Pagamentos Parciais com Saldo

### 2a. Campo de Valor Editavel no Modal de Pagamento

**Arquivo:** `src/components/royalties/PagamentoDialog.tsx`

Atualmente o `valor_total` e preenchido automaticamente com o total de vendas pendentes e nao pode ser alterado. Mudancas:

- Exibir o **Saldo disponivel** (total de vendas pendentes) de forma clara
- Tornar o campo `valor_total` **editavel**, permitindo pagamento parcial (ex: saldo R$ 2.069,88 mas pagar R$ 1.000,00)
- Validar que o valor informado seja maior que 0 e menor ou igual ao saldo disponivel
- Ao criar pagamento parcial: **nao vincular todas as vendas** ao pagamento. Vincular vendas na ordem cronologica ate cobrir o valor pago. Se o valor parcial nao cobrir uma venda inteira, aquela venda permanece pendente (simplificacao: vincular vendas completas ate onde o valor permitir)

### 2b. Saldo do Autor na Pagina de Pagamentos

**Arquivo:** `src/pages/royalties/Pagamentos.tsx`

- Adicionar cards de resumo por autor no topo (ou mostrar saldo ao lado do nome na tabela)
- Ao clicar "Novo Pagamento" e selecionar autor, o saldo disponivel ja aparece no modal (ja acontece parcialmente)

### 2c. Saldo e Total Pago no Relatorio

**Arquivo:** `src/pages/royalties/Relatorios.tsx`

- No relatorio de vendas, adicionar colunas ou cards mostrando:
  - **Total Apurado** (royalties total)
  - **Total Pago** (pagamentos efetivados)
  - **Saldo Pendente** (apurado - pago)
- Quando filtrado por autor, mostrar esses valores especificos do autor

### 2d. Reflexo no Extrato do Autor

**Arquivo:** `src/pages/autor/Extrato.tsx` e `src/pages/autor/MeusPagamentos.tsx`

Essas paginas ja mostram vendas com status "Pago" vs "Pendente" baseado no `pagamento_id`. Com pagamentos parciais, o comportamento ja funciona corretamente pois:
- Vendas vinculadas a um pagamento ficam como "Pago"
- Vendas nao vinculadas ficam como "Pendente"
- O card "A Faturar" em MeusPagamentos ja calcula vendas sem `pagamento_id`

Nenhuma alteracao necessaria nessas paginas -- elas ja refletem o saldo corretamente.

---

## Detalhes Tecnicos

### Relatorios.tsx - Filtros

```text
Novos estados:
  filtroAutor: string (default "todos")
  filtroLivro: string (default "todos")

Novas queries:
  - royalties_autores (id, nome_completo) para popular select
  - royalties_livros (id, titulo) para popular select (filtrado por autor se selecionado)

Aplicacao dos filtros na queryFn principal:
  - vendas: filtrar livroIds por autor_id e/ou livro_id especifico
  - comissoes: idem
  - pagamentos: .eq("autor_id", filtroAutor) quando != "todos"
```

### PagamentoDialog.tsx - Pagamento Parcial

```text
Mudancas:
1. Mostrar "Saldo disponivel: R$ X.XXX,XX" em destaque
2. Campo valor_total editavel (Input type number) pre-preenchido com total
3. Validacao: valor > 0 && valor <= saldoDisponivel
4. Na criacao: vincular vendas ordenadas por data ate cobrir valor_total
   - Loop pelas vendas pendentes somando valor_comissao_total
   - Vincular vendas completas ate o valor pago ser atingido
   - Vendas restantes ficam sem pagamento_id
```

### Relatorios.tsx - Cards de Saldo

```text
Quando tipo = "vendas":
  - Buscar pagamentos pagos no periodo para calcular "Total Pago"
  - Card 1: Total Vendas (qtd)
  - Card 2: Total Royalties Apurado
  - Card 3: Total Pago / Saldo Pendente
```

### Nenhuma alteracao de banco de dados necessaria
A estrutura atual ja suporta pagamentos parciais -- o campo `valor_total` em `royalties_pagamentos` aceita qualquer valor, e o vinculo com vendas e feito via `pagamento_id` em `royalties_vendas`.

