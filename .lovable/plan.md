

## Problema

A listagem de canais chama a edge function `bling-search-campaign-audience` com `action: "listar_lojas"`, que faz scan de até 3 páginas de pedidos na API do Bling para descobrir IDs de lojas. Isso demora ~3-5 segundos com rate limiting, e o browser está dando timeout ("Failed to fetch").

Meu teste direto confirmou que a função **funciona** e retorna 6 lojas — mas o browser desconecta antes.

## Solução

Não há necessidade de chamar a API do Bling para listar lojas — são lojas fixas. Vou **remover a chamada à edge function** e usar a lista hardcoded diretamente no front-end.

### Alterações em `src/components/admin/WhatsAppCampaigns.tsx`

1. **Remover** o `useEffect` que chama `listar_lojas` (linhas 122-142)
2. **Remover** `loadingChannels` state
3. **Inicializar** `blingChannels` diretamente com os dados do `BLING_STORE_NAMES`:

```text
ID          | Nome
205391854   | E-COMMERCE
204728077   | ECG SHOPEE
204732507   | MERCADO LIVRE
205441191   | ATACADO
205797806   | PEDIDOS MATRIZ
205891152   | PEDIDOS PENHA
205882190   | PEDIDOS PERNAMBUCO
```

4. O Select carregará instantaneamente com todos os 7 canais, sem esperar API.

### Edge Function

Manter o `action: "listar_lojas"` na edge function por compatibilidade, mas o front-end não o usará mais.

