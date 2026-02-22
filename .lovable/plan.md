
# Corrigir endereço de entrega enviado ao Bling

## Problema identificado

Quando uma proposta e aprovada para faturamento, a funcao `aprovar-faturamento` envia ao Bling o endereco **cadastral do cliente** (tabela `ebd_clientes`) em vez do endereco **de entrega aprovado na proposta** (campo `cliente_endereco` da tabela `vendedor_propostas`).

Exemplo concreto (pedido YAHWEH):
- Endereco na proposta (correto): Rua Guilhermina de Araujo, 110 - CEP 23898-078
- Endereco enviado ao Bling (errado): Rua Firmino Modesto, LT 12 - CEP 23898-039

## Solucao

Alterar a funcao `aprovar-faturamento` para priorizar o endereco salvo na proposta (`proposta.cliente_endereco`), usando o endereco cadastral apenas como fallback.

## Detalhes tecnicos

### Arquivo: `supabase/functions/aprovar-faturamento/index.ts`

Na secao que monta o `endereco_entrega` (linhas 174-182), a logica sera alterada de:

```typescript
// ANTES - sempre usa endereco do cadastro
endereco_entrega: cliente.endereco_rua ? {
  rua: cliente.endereco_rua,
  numero: cliente.endereco_numero || 'S/N',
  complemento: cliente.endereco_complemento || '',
  bairro: cliente.endereco_bairro || '',
  cep: cliente.endereco_cep || '',
  cidade: cliente.endereco_cidade || '',
  estado: cliente.endereco_estado || '',
} : null,
```

Para:

```typescript
// DEPOIS - prioriza endereco da proposta
const endProposta = proposta.cliente_endereco;
endereco_entrega: endProposta?.rua ? {
  rua: endProposta.rua,
  numero: endProposta.numero || 'S/N',
  complemento: endProposta.complemento || '',
  bairro: endProposta.bairro || '',
  cep: endProposta.cep || '',
  cidade: endProposta.cidade || '',
  estado: endProposta.estado || '',
} : cliente.endereco_rua ? {
  rua: cliente.endereco_rua,
  numero: cliente.endereco_numero || 'S/N',
  complemento: cliente.endereco_complemento || '',
  bairro: cliente.endereco_bairro || '',
  cep: cliente.endereco_cep || '',
  cidade: cliente.endereco_cidade || '',
  estado: cliente.endereco_estado || '',
} : null,
```

### Verificacao adicional

Sera adicionado um log para facilitar a depuracao futura:

```typescript
console.log(`[APROVAR-FAT] Endereco entrega - Fonte: ${endProposta?.rua ? 'PROPOSTA' : 'CADASTRO'}`);
```

### Funcoes similares a verificar

A mesma correcao pode ser necessaria em `mp-sync-payment-status` (linha 148), que tambem monta `endereco_entrega` a partir do cadastro do cliente. Sera corrigida no mesmo deploy.

## Impacto

- Todos os novos pedidos faturados passarao a usar o endereco correto da proposta
- Pedidos ja enviados ao Bling (como o da YAHWEH) precisarao de correcao manual diretamente no Bling
- Nenhuma alteracao no banco de dados e necessaria
