

## Diagnóstico

A Edge Function **funcionou** (encontrou 197 contatos), mas **demorou ~2,5 minutos** e o navegador desconectou antes de receber a resposta ("connection closed before message completed"). O problema principal é que a função faz `GET /contatos/{id}` individual para cada pedido sem telefone, o que consome muito tempo.

Além disso, os **IDs dos canais estão incorretos/hardcoded**. A lista real do Bling (conforme a imagem) é diferente.

## Plano de Correção

### 1. Atualizar Edge Function `bling-search-campaign-audience`

- **Remover** as chamadas individuais a `GET /contatos/{id}` — usar apenas os dados que já vêm no campo `contato` do pedido (nome, documento). Isso reduz o tempo de ~2,5 min para ~10 segundos.
- **Buscar lojas dinamicamente** via `GET /Api/v3/lojas` quando o `loja_id` for `"listar"`, retornando a lista de canais disponíveis para o Select da UI.
- Manter a paginação e deduplicação por telefone existentes.

### 2. Atualizar UI `WhatsAppCampaigns.tsx`

- **Remover** o array `BLING_CHANNELS` hardcoded.
- **Carregar dinamicamente** as lojas do Bling via a mesma edge function (com action `"listar_lojas"`), populando o Select com os nomes e IDs reais (E-COMMERCE, PEDIDOS MATRIZ, PEDIDOS PENHA, ECG SHOPEE, etc.).
- Adicionar opção "Todos os Canais" no topo.

### Resultado

- Busca rápida (~10s em vez de 2,5 min) sem timeout
- Canais sempre atualizados com o que existe no Bling

