

## Plano: Busca de cliente por nome + campo de quantidade editável nos itens

### Problema
1. O seletor de cliente é um `<Select>` padrão sem busca — com muitos clientes fica difícil encontrar o desejado.
2. A quantidade dos itens no carrinho só pode ser alterada via botões +/-, sem opção de digitar diretamente.

### Solução

**Arquivo: `src/pages/vendedor/VendedorCalculadoraPeso.tsx`**

**1. Cliente com busca (linhas 736-752)**
- Substituir o `<Select>` por um campo `<Input>` de busca + dropdown filtrado (usando `Popover` + lista filtrada), ou usar `cmdk` (já instalado) para um combobox com busca.
- Abordagem: usar `Popover` + `Command` (cmdk) para criar um combobox searchable:
  - O usuário digita o nome do cliente e a lista filtra em tempo real.
  - Ao selecionar, preenche `clienteSelecionado`.
  - Mantém badge de tipo do cliente visível.

**2. Campo de quantidade editável nos itens (linhas 938-945)**
- Substituir o `<span>` estático da quantidade pelo componente `CartQuantityField` que já existe no projeto (`src/components/shopify/CartQuantityField.tsx`).
- Esse componente permite digitar a quantidade diretamente e faz commit no blur/Enter.
- Integrar com `alterarQuantidade` recalculando o delta ou criar um `setQuantidade` direto.

### Mudanças detalhadas

1. Adicionar imports: `Popover`, `PopoverTrigger`, `PopoverContent`, `Command`, `CommandInput`, `CommandList`, `CommandItem`, `CommandEmpty` e `CartQuantityField`.

2. Adicionar estado `clienteSearchOpen` para controlar o popover.

3. Substituir bloco `<Select>` do cliente por combobox com busca usando cmdk.

4. Na seção de itens do carrinho, substituir:
   ```tsx
   <span className="w-6 text-center text-xs">{item.quantity}</span>
   ```
   por:
   ```tsx
   <CartQuantityField value={item.quantity} onCommit={(next) => setQuantidadeDireta(item.variantId, next)} className="w-10 h-6 text-center text-xs px-1 ..." />
   ```

5. Adicionar callback `setQuantidadeDireta(variantId, quantidade)` que seta a quantidade diretamente no carrinho.

