
# Correção: Herança simples enriquecida para Penha

## Problema real

A herança simples pura (`{ idPedidoVenda: orderId }`) funciona para Matriz (configuração padrão do Bling), mas falha para Penha com erro "A nota deve ter ao menos um item". Isso acontece porque o Bling não consegue resolver automaticamente a configuração fiscal de filiais (série, natureza de operação, loja) ao usar apenas o ID do pedido.

O fallback `bling-generate-nfe` cria a NF-e com payload completo (e inclui `idPedidoVenda`), mas esse método **não** gera o vínculo "V" laranja - apenas a herança pura faz isso.

## Solução

Modificar `bling-nfe-simple` para:

1. **Buscar os dados do pedido** no Bling antes de criar a NF-e (GET no pedido)
2. **Detectar se é Penha** (pelo ID da loja: 205891152)
3. **Enriquecer o payload de herança** com os campos fiscais necessários para Penha:
   - `serie: 1`
   - `naturezaOperacao: { id: ... }` (PF ou PJ conforme o documento do contato)
   - `loja: { id: 205891152 }`
4. Para pedidos não-Penha, manter a herança pura (`{ idPedidoVenda }`)

## Detalhes técnicos

### Arquivo: `supabase/functions/bling-nfe-simple/index.ts`

Adicionar antes da criação da NF-e:

```typescript
// Constantes fiscais Penha
const LOJA_PENHA_ID = 205891152;
const SERIE_PENHA = 1;
const NATUREZA_PENHA_PF_ID = 15108893128;
const NATUREZA_PENHA_PJ_ID = 15108893188;

// Buscar dados do pedido para detectar loja
const orderRes = await fetch(
  `https://api.bling.com.br/Api/v3/pedidos/vendas/${bling_order_id}`,
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
const orderData = await orderRes.json();
const pedido = orderData?.data;

const isLojaPenha = pedido?.loja?.id === LOJA_PENHA_ID;

// Montar payload
let nfePayload: any = { idPedidoVenda: bling_order_id };

if (isLojaPenha) {
  const doc = pedido?.contato?.numeroDocumento?.replace(/\D/g, '') || '';
  const tipoPessoa = doc.length > 11 ? 'J' : 'F';
  // PJ sem IE usa natureza PF (mesmo truque fiscal do bling-generate-nfe)
  const naturezaId = tipoPessoa === 'J' 
    ? NATUREZA_PENHA_PF_ID  // truque fiscal: PJ sem IE usa PF
    : NATUREZA_PENHA_PF_ID;
  
  nfePayload.serie = SERIE_PENHA;
  nfePayload.naturezaOperacao = { id: naturezaId };
  nfePayload.loja = { id: LOJA_PENHA_ID };
}
```

Isso mantém o `idPedidoVenda` (que cria o vínculo "V") mas adiciona os campos fiscais que o Bling precisa para processar corretamente pedidos de filiais.

### Deploy

Redeploy automático da função `bling-nfe-simple` após a correção.

### Resultado esperado

- Pedidos Penha: herança enriquecida com serie/natureza/loja -> NF-e criada COM vínculo "V"
- Pedidos Matriz: herança pura (sem alteração) -> continua funcionando
- Se falhar, o fallback `bling-generate-nfe` continua disponível
