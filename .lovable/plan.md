

# Correcao: Criar ebd_clientes para novos compradores

## Problema Critico Encontrado

O bug do fuzzy match foi corrigido, porem existe um **segundo problema**: o auto-provisioning (linha 549) so executa quando `clienteId` nao e null. Para um cliente completamente novo como `cayk500@gmail.com`, nenhuma das 3 buscas (email, CPF/CNPJ, nome) vai encontrar um registro existente, entao `clienteId` permanece `null` e o bloco inteiro e pulado.

```text
Fluxo atual (QUEBRADO para clientes novos):
  Busca email -> nao encontra
  Busca CPF   -> nao encontra  
  Busca nome  -> nao encontra (fix aplicado)
  clienteId = null
  if (customerEmail && clienteId) -> FALSE
  Auto-provisioning PULADO!
```

## Acao

### 1. Adicionar criacao de ebd_clientes para clientes novos

Apos a secao de heranca de vendedor (linha 373) e antes do upsert do pedido (linha 378), adicionar logica para criar um novo registro em `ebd_clientes` quando `clienteId` for null e o pagamento estiver confirmado:

```javascript
// Se nao encontrou cliente existente e pagamento confirmado, criar novo
if (!clienteId && statusPagamento === 'paid' && customerEmail) {
  const customerName = order.customer
    ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
    : null;
  const customerPhone = order.customer?.phone 
    || order.shipping_address?.phone 
    || order.billing_address?.phone 
    || null;

  const { data: newCliente, error: newClienteErr } = await supabase
    .from("ebd_clientes")
    .insert({
      nome_igreja: customerName || customerEmail,
      nome_responsavel: customerName,
      email_superintendente: customerEmail,
      telefone: customerPhone,
      vendedor_id: finalVendedorId,
      is_pos_venda_ecommerce: true,
    })
    .select("id")
    .single();

  if (newClienteErr) {
    console.error("Erro ao criar novo ebd_clientes:", newClienteErr);
  } else {
    clienteId = newCliente.id;
    console.log("Novo ebd_clientes criado:", clienteId);
  }
}
```

### 2. Limpar registro de teste (novamente)

Deletar qualquer pedido que tenha sido criado com `cayk500@gmail.com` durante este ultimo teste.

### 3. Re-deploy da edge function

Deploy da funcao corrigida para que o proximo teste funcione.

## Resultado Esperado

```text
Fluxo corrigido:
  Busca email -> nao encontra
  Busca CPF   -> nao encontra
  Busca nome  -> nao encontra
  clienteId = null
  NOVO: Cria ebd_clientes -> clienteId = uuid
  Upsert pedido com clienteId
  if (customerEmail && clienteId) -> TRUE
  Auto-provisioning EXECUTA!
    -> Cria usuario Auth + senha
    -> Atualiza ebd_clientes com credenciais
    -> Insere no funil (Fase 1)
    -> Envia WhatsApp
```

## Secao Tecnica

- **Arquivo**: `supabase/functions/ebd-shopify-order-webhook/index.ts`
- **Local da insercao**: Entre a linha 373 (fim da heranca de vendedor) e linha 378 (upsert do pedido)
- **Condicao**: `!clienteId && statusPagamento === 'paid' && customerEmail`
- **Tabela**: `ebd_clientes` - INSERT de novo registro
- **Impacto**: Apenas clientes novos que nao existem em nenhuma tabela serao criados. Clientes existentes continuam sendo encontrados pelas buscas por email/CPF/nome
