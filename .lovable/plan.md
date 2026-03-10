

## Plano: Botão "Corrigir CNPJ" abre modal de edição do cliente

### Problema
No painel do vendedor, o banner de documento inválido não tem ação direta para corrigir o CNPJ. O botão "Editar" abre o modal da proposta, não o cadastro do cliente.

### Solução
Adicionar um botão "Corrigir CNPJ" no banner de documento inválido que abre o `CadastrarClienteDialog` com o cliente pré-carregado para edição. O vendedor corrige apenas o documento e salva.

### Mudanças

**Arquivo: `src/pages/vendedor/VendedorPedidosPage.tsx`**

1. Importar `CadastrarClienteDialog`
2. Adicionar estados para controlar o dialog de edição do cliente:
   - `clienteParaCorrigir` — dados do cliente para editar
   - `showCorrigirClienteDialog` — controle de visibilidade
3. Criar função `handleCorrigirDocumento(proposta)` que busca os dados do cliente via `proposta.cliente_id` na tabela `ebd_clientes` e abre o `CadastrarClienteDialog` com `clienteParaEditar`
4. No banner de documento inválido (linhas 631-638), adicionar botão "Corrigir CNPJ/CPF" que chama `handleCorrigirDocumento`
5. Renderizar o `CadastrarClienteDialog` no final do componente com `clienteParaEditar={clienteParaCorrigir}` e `onSuccess` que faz refetch das propostas

