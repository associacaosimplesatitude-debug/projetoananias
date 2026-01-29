

# Correção Definitiva: PDV Balcão com Desconto e Integração Bling

## Objetivo
Corrigir o fluxo do PDV Balcão para aplicar automaticamente 30% de desconto e integrar com Bling, garantindo que todas as NF-es futuras sejam emitidas com o valor correto.

## Modificações

### Arquivo: `src/pages/vendedor/VendedorPDV.tsx`

#### 1. Aplicar desconto de 30% automaticamente

Alterar o cálculo de totais para incluir o desconto padrão de representante:

```typescript
const DESCONTO_REPRESENTANTE = 0.30; // 30%

const subtotal = carrinho.reduce((acc, item) => 
  acc + (item.produto.preco_cheio * item.quantidade), 0);

const valorDesconto = subtotal * DESCONTO_REPRESENTANTE;
const total = subtotal - valorDesconto;
```

#### 2. Exibir preços com desconto no carrinho

Mostrar preço original riscado e preço com desconto aplicado:

```text
+------------------------------------------+
| Revista Adultos - Lição 1                |
| R$ 45,00 → R$ 31,50 (30% off)            |
| Qtd: [ - ] 2 [ + ]  Total: R$ 63,00      |
+------------------------------------------+
```

#### 3. Integrar com edge function `bling-create-order`

Substituir o TODO existente por uma chamada real à edge function:

```typescript
const finalizarVenda = useMutation({
  mutationFn: async () => {
    // 1. Salvar no banco vendas_balcao (já existe)
    const { data: venda, error } = await supabase
      .from("vendas_balcao")
      .insert({
        vendedor_id: vendedor.id,
        polo: "penha",
        cliente_nome: clienteNome,
        cliente_cpf: clienteCpf || null,
        cliente_telefone: clienteTelefone || null,
        itens: itensComDesconto,
        valor_subtotal: subtotal,
        valor_desconto: valorDesconto, // NOVO: salvar desconto
        valor_total: total,
        forma_pagamento: formaPagamento,
        status: "concluida",
      })
      .select()
      .single();

    if (error) throw error;

    // 2. NOVO: Criar pedido no Bling
    const blingResponse = await supabase.functions.invoke('bling-create-order', {
      body: {
        forma_pagamento: 'pagamento_loja',
        forma_pagamento_loja: formaPagamento,
        deposito_origem: 'local',
        cliente_nome: clienteNome,
        cliente_documento: clienteCpf,
        itens: carrinho.map(item => ({
          bling_produto_id: item.produto.bling_produto_id,
          titulo: item.produto.titulo,
          quantidade: item.quantidade,
          preco_cheio: item.produto.preco_cheio,
          valor: item.produto.preco_cheio * (1 - DESCONTO_REPRESENTANTE),
          descontoItem: DESCONTO_REPRESENTANTE * 100, // 30
        })),
        valor_total: total,
        observacoes: `PDV Balcão - ${formaPagamento.toUpperCase()}`,
        venda_balcao_id: venda.id,
      }
    });

    if (blingResponse.error) {
      console.error("Erro Bling:", blingResponse.error);
      // Não bloqueia a venda, apenas loga o erro
    }

    return venda;
  },
  // ...
});
```

#### 4. Atualizar exibição de totais

Mostrar subtotal, desconto e total final:

```text
+------------------------------------------+
| Subtotal:           R$ 760,78            |
| Desconto (30%):    -R$ 228,23            |
| ---------------------------------------- |
| TOTAL:              R$ 532,55            |
+------------------------------------------+
```

## Estrutura de Dados para o Bling

Cada item será enviado com:

| Campo | Valor | Uso no Bling |
|-------|-------|--------------|
| `preco_cheio` | 45.00 | Preço de tabela (referência) |
| `valor` | 31.50 | Preço líquido após desconto |
| `descontoItem` | 30 | Percentual de desconto |

O desconto global será calculado automaticamente pela edge function e aplicado no nível do pedido Bling.

## Fluxo Completo Após Correção

```text
1. Vendedora Gloria abre PDV Balcão
2. Busca e adiciona produtos ao carrinho
3. Sistema exibe preços com 30% de desconto AUTOMATICAMENTE
4. Vendedora preenche dados do cliente
5. Vendedora seleciona forma de pagamento (PIX/Cartão/Dinheiro)
6. Clica em "Finalizar Venda"
7. Sistema salva em vendas_balcao COM valor_desconto
8. Sistema chama bling-create-order
9. Bling cria pedido com desconto correto
10. NF-e é emitida automaticamente com valor R$ 532,55
```

## Resultado Esperado

- Todas as NF-es futuras do PDV Balcão serão emitidas com o valor correto (com 30% de desconto)
- O registro no banco terá `valor_desconto` preenchido para auditoria
- O pedido Bling terá a estrutura correta para emissão de NF-e
- A vendedora não precisa fazer nenhum cálculo manual

