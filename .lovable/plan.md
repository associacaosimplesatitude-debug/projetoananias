

## Problema

A página `/admin/ebd/pedidos-igrejas` (`PedidosOnline.tsx`) executa automaticamente a sincronização com o Shopify ao carregar (linhas 237-243). Quando a edge function `ebd-shopify-sync-orders` falha (retorna non-2xx), o toast de erro "Falha ao sincronizar pedidos" aparece imediatamente.

## Correção

Remover o `useEffect` de auto-sync (linhas 236-243) em `src/pages/shopify/PedidosOnline.tsx`. O botão "Sincronizar Pedidos" continuará disponível para sincronização manual quando necessário.

Também remover o state `hasAutoSynced` (linha 145) que não será mais usado.

