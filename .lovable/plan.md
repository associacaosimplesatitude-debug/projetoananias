

# Vincular NF-e ao pedido Penha apos criacao

## Situacao atual

- A NF-e para Penha **esta sendo criada e autorizada com sucesso** pelo fallback `bling-generate-nfe`
- O problema e exclusivamente o **vinculo "V" laranja** entre a NF-e e o pedido de venda no Bling
- A heranca simples (que cria o vinculo) nao funciona para Penha porque o Bling nao resolve itens/contato automaticamente para filiais
- O payload completo inclui `idPedidoVenda` mas o Bling **ignora** esse campo quando os itens sao enviados manualmente

## Estrategia: PUT para vincular apos criacao

Adicionar um passo extra no `bling-nfe-simple`: apos o fallback `bling-generate-nfe` criar a NF-e com sucesso, fazer um `PUT /nfe/{nfeId}` com `{ idPedidoVenda: orderId }` para tentar forcar o vinculo. Adicionalmente, tambem modificar o proprio `bling-generate-nfe` para tentar o PUT de vinculacao apos a criacao quando a heranca simples falhou.

## Passos

### 1. Modificar `supabase/functions/bling-nfe-simple/index.ts`

Quando a heranca simples falhar para Penha e o frontend chamar o fallback, o `bling-nfe-simple` atualmente retorna erro e o frontend chama `bling-generate-nfe`. Nao ha como vincular aqui pois o `bling-nfe-simple` nao sabe o ID da NF-e criada pelo fallback.

A solucao e: **mover a logica de payload completo para DENTRO do `bling-nfe-simple`** para Penha, e apos criar a NF-e, tentar um `PUT` para vincular. Assim:

1. Tentar heranca simples (funciona para Matriz)
2. Se falhar e for Penha: construir payload completo minimo (itens + contato do pedido) e criar a NF-e
3. Apos criar com sucesso: fazer `PUT /nfe/{nfeId}` com `{ idPedidoVenda: orderId }` para tentar vincular
4. Enviar para SEFAZ

### 2. Modificar `supabase/functions/bling-generate-nfe/index.ts`

Adicionar apos a criacao da NF-e (quando `usedSimpleInheritance === false`):

```text
// PASSO 1.5: Tentar vincular via PUT
PUT /nfe/{nfeId} com { idPedidoVenda: orderId }
```

Se o PUT aceitar o campo, o vinculo "V" aparecera. Se nao aceitar, nao prejudica nada.

### 3. Deploy das duas funcoes

## Detalhes tecnicos

### Payload completo minimo para Penha no `bling-nfe-simple`

```text
{
  tipo: 1,
  dataOperacao: "YYYY-MM-DD",
  dataEmissao: "YYYY-MM-DD",
  contato: { id, nome, tipoPessoa, numeroDocumento, endereco, indicadorie: 9 },
  itens: [{ codigo, descricao, unidade, quantidade, valor, tipo: "P", origem: 0 }],
  serie: 1,
  naturezaOperacao: { id: 15108893128 },
  loja: { id: 205891152 }
}
```

Os dados sao extraidos do pedido buscado via GET, sem necessidade de logica complexa.

### PUT de vinculacao (tentativa)

```text
PUT https://api.bling.com.br/Api/v3/nfe/{nfeId}
Body: { idPedidoVenda: orderId }
```

Se o Bling aceitar, o vinculo "V" aparece. Se retornar erro ou ignorar, a NF-e ja esta criada e autorizada -- nenhum dano.

## Resultado esperado

- Penha: NF-e criada com payload completo + PUT para vincular -> possivel vinculo "V"
- Matriz: heranca simples continua funcionando -> vinculo "V" garantido
- Se o PUT nao vincular, a nota continua emitida corretamente (so sem o icone "V")
