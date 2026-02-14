
# Adicionar Opcao de Faturamento na Calculadora de Peso

## Problema
Atualmente, ao criar uma proposta a partir de um orcamento na calculadora de peso (`/vendedor/calculadora-peso`), o sistema sempre cria a proposta com `pode_faturar: false`, direcionando o cliente exclusivamente para o Mercado Pago. Nao existe a opcao do vendedor escolher entre faturamento B2B ou pagamento padrao, como ja acontece no fluxo do catalogo (`VendedorCatalogo`).

## Solucao
Adicionar o dialogo `FaturamentoModeDialog` no fluxo de criacao de proposta da calculadora de peso. Quando o vendedor clicar em "Gerar Proposta" e o cliente tiver `pode_faturar = true`, o sistema exibira o modal perguntando se deseja faturar (B2B) ou usar pagamento padrao. A escolha sera salva na proposta.

## Alteracoes

### 1. `src/pages/vendedor/VendedorCalculadoraPeso.tsx`

**Novos estados:**
- `showFaturamentoModal` - controlar abertura do modal
- `orcamentoParaFaturamento` - armazenar qual orcamento esta sendo processado

**Novo fluxo no `handleCriarProposta`:**
1. Buscar dados do cliente incluindo `pode_faturar`
2. Se `pode_faturar === true`: abrir `FaturamentoModeDialog` e aguardar escolha do vendedor
3. Se `pode_faturar === false`: prosseguir normalmente (pagamento padrao via MP)

**Funcoes de callback do modal:**
- `handleSelectFaturamento`: criar proposta com `pode_faturar: true` e `prazo_faturamento_selecionado: '30/60/90'`
- `handleSelectPadrao`: criar proposta com `pode_faturar: false`

**No insert da proposta:**
- Adicionar os campos `pode_faturar` e `prazo_faturamento_selecionado` de acordo com a escolha

**Importar e renderizar:**
- Importar `FaturamentoModeDialog` de `@/components/vendedor/FaturamentoModeDialog`
- Renderizar o componente no JSX com os estados e callbacks

### 2. Impacto nos fluxos existentes
- Nenhuma alteracao necessaria nas demais paginas
- O campo `pode_faturar` ja existe na tabela `vendedor_propostas`
- O fluxo de aprovacao financeira ja trata propostas com `pode_faturar: true` corretamente
- A pagina de pedidos (`VendedorPedidosPage`) ja exibe o badge B2B e botoes corretos baseado em `pode_faturar`

### 3. Resumo do fluxo
```text
Vendedor clica "Gerar Proposta"
         |
   Cliente pode faturar?
    /              \
  SIM              NAO
   |                |
Abre modal       Cria proposta
de escolha       pode_faturar=false
   |                |
Faturar / Padrao    |
   |       |        |
B2B(true)  false    |
   \       |       /
    Cria proposta
         |
   Exibe link
```
