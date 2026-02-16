

# Correção do Bug de Match por Nome + Limpeza Completa

## Problema Identificado

Existe um **bug critico** no fuzzy match por nome no webhook (linha 343-348 do `ebd-shopify-order-webhook/index.ts`):

```javascript
customerName.includes(c.nome_superintendente?.toLowerCase() || '')
```

Quando `nome_superintendente` é `null`, isso vira `customerName.includes('')` que **SEMPRE retorna true** em JavaScript. Isso faz com que o primeiro cliente da lista com vendedor seja selecionado incorretamente. Por isso "Cayk Soares" foi vinculado a "ADVEC SAO JOAO DE MERITI".

## Acoes

### 1. Corrigir o bug do fuzzy match

Alterar a logica de match por nome para verificar se os valores nao sao vazios antes de comparar:

```javascript
const matchingCliente = clientes.find(c => {
  const nomeIgreja = c.nome_igreja?.toLowerCase()?.trim();
  const nomeSuperintendente = c.nome_superintendente?.toLowerCase()?.trim();
  
  return (
    (nomeIgreja && nomeIgreja.length > 2 && (
      nomeIgreja.includes(customerName) || customerName.includes(nomeIgreja)
    )) ||
    (nomeSuperintendente && nomeSuperintendente.length > 2 && (
      nomeSuperintendente.includes(customerName) || customerName.includes(nomeSuperintendente)
    ))
  );
});
```

### 2. Limpar todos os registros do teste

- Deletar o pedido #2593 de `ebd_shopify_pedidos` (email `cayk500@gmail.com`)
- Confirmar que `auth.users`, `profiles`, `ebd_clientes` e `funil_posv_tracking` estao limpos

### 3. Re-deploy da edge function

Apos corrigir o bug, fazer deploy da funcao para que o proximo pedido funcione corretamente.

## Resultado Esperado

Com o bug corrigido e a base limpa, o proximo pedido com `cayk500@gmail.com`:
- **NAO** vai fazer match incorreto com clientes existentes
- Vai criar um novo registro em `ebd_clientes`
- Vai criar o usuario Auth com senha temporaria
- Vai inserir no funil pos-venda (Fase 1)
- Vai enviar a mensagem WhatsApp de boas-vindas

## Secao Tecnica

- **Arquivo**: `supabase/functions/ebd-shopify-order-webhook/index.ts` (linhas 343-348)
- **Bug**: `String.prototype.includes('')` sempre retorna `true` em JavaScript
- **Fix**: Adicionar validacao de comprimento minimo (> 2 caracteres) antes do `includes()`
- **Tabela afetada**: `ebd_shopify_pedidos` - deletar registro com `customer_email = 'cayk500@gmail.com'`

