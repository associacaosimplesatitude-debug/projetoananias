
# Adicionar Lista de Transportadoras no Modal de Frete

## Resumo
Substituir o campo de texto livre "Nome da Transportadora" por um dropdown (Select) com as transportadoras pre-definidas, mantendo tambem a opcao de digitar outra transportadora caso necessario.

## Transportadoras da lista
1. R3 EXPRESS
2. BRASPRESS
3. KR TRANSPORTES
4. VIA PAJUCARA
5. CAMILO DOS SANTOS
6. M2000 TRANSPORTES
7. BOMFIM CARGAS
8. L AUTO
9. PROGRESSO LOGISTICA
10. TRANSPO EXPRESS
11. MOVVI TRANSPORTES

## O que sera alterado

### 1. `src/components/vendedor/AdicionarFreteOrcamentoDialog.tsx`
- Substituir o `<Input>` de transportadora por um `<Select>` com as opcoes listadas acima
- Adicionar uma opcao "Outra..." que, ao ser selecionada, exibe um campo de texto para digitar o nome manualmente
- O valor selecionado sera salvo no campo `transportadora_nome` do banco (ja existente)

### 2. Proposta e Bling
- Nenhuma alteracao necessaria: o campo `transportadora_nome` ja e passado para a proposta (via `frete_transportadora`) e para o Bling (campo `transporte.transportador.nome`). O fluxo existente ja funciona corretamente com qualquer nome de transportadora.

## Detalhes Tecnicos
- Usar o componente `Select` do Radix UI ja disponivel no projeto
- Lista de transportadoras definida como constante no componente
- Quando "Outra..." for selecionada, mostrar um Input adicional para digitacao livre
- O estado `transportadora` continua armazenando o nome final (seja da lista ou digitado)
