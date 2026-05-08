# Detalhes do Cliente nos Cards do Kanban de Retenção

## Objetivo
Em `/admin/ebd/retencao`, permitir visualizar os dados completos do cliente diretamente a partir de cada card do Kanban, com destaque para o **telefone** (hoje só existe o ícone do WhatsApp, sem mostrar o número).

## O que será feito

### 1. Novo botão "Detalhes" em cada card
Em `src/components/admin/retencao/RetencaoKanban.tsx`, adicionar um botão com ícone de informação (`Info` do lucide-react) ao lado dos botões de WhatsApp/Email/Registrar. Ao clicar, abre um Dialog com os dados completos.

### 2. Novo componente `ClienteDetalhesDialog`
Arquivo: `src/components/admin/retencao/ClienteDetalhesDialog.tsx`

Conteúdo do dialog:
- **Cabeçalho**: nome da igreja
- **Contato** (com botão de copiar ao lado de cada item):
  - Telefone (formatado: `(XX) XXXXX-XXXX`) + link WhatsApp
  - E-mail + link mailto
- **Comercial**:
  - Canal da última compra
  - Vendedor responsável
  - Valor total de compras
  - Valor da última compra
  - Dias sem comprar
- **Endereço/Igreja** (carregado sob demanda da tabela `ebd_clientes`):
  - Cidade, UF, CEP, endereço, CNPJ, responsável
- **Histórico de retenção**:
  - Último resultado e data do último contato
  - Status do presente (interesse respondido / acesso liberado), reaproveitando os mesmos dados já consultados em `EbdRetencao.tsx`

### 3. Busca dos dados extras
Quando o dialog abrir, fazer um `useQuery` pontual no `ebd_clientes` por `cliente_id` para trazer os campos que não vêm no RPC do dashboard (endereço, CNPJ, etc.). Sem alterações no RPC `get_retencao_dashboard`.

### 4. Acessibilidade e UX
- Telefone exibido em texto grande e selecionável (resolve o pedido principal)
- Botão "Copiar" usando `navigator.clipboard` + `toast.success("Copiado")`
- Dialog responsivo, com `max-w-lg`

## Arquivos afetados
- `src/components/admin/retencao/RetencaoKanban.tsx` — adicionar botão "Detalhes" e estado para abrir o dialog
- `src/components/admin/retencao/ClienteDetalhesDialog.tsx` — **novo arquivo**

## Fora de escopo
- Não altera RPC, schema, ou regras de negócio
- Não altera o layout das colunas do Kanban
- Não altera permissões (segue as do `/admin/ebd/retencao`)
