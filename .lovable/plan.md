

# Limpeza Completa: cayk500@gmail.com

## O que precisa ser deletado

| Tabela | Registro | Status |
|--------|----------|--------|
| auth.users | Nenhum | Ja limpo |
| profiles | Nenhum | Ja limpo |
| ebd_clientes | Nenhum com esse email | Ja limpo |
| funil_posv_tracking | Nenhum | Ja limpo |
| **ebd_shopify_pedidos** | `fcbcd403-0eec-4c10-907b-08cede02cee9` | **DELETAR** |

## Acao

1. Deletar o pedido `fcbcd403-0eec-4c10-907b-08cede02cee9` da tabela `ebd_shopify_pedidos`
2. Confirmar que nao resta nenhum registro associado a `cayk500@gmail.com` em nenhuma tabela

## Resultado esperado

Quando voce fizer a proxima compra no Shopify com `cayk500@gmail.com`, o webhook vai executar o fluxo completo:
- Criar usuario Auth com senha temporaria
- Criar/atualizar registro em `ebd_clientes`
- Inserir no funil pos-venda (Fase 1)
- Enviar mensagem WhatsApp de boas-vindas

## Secao Tecnica

Sera executado um DELETE na tabela `ebd_shopify_pedidos` filtrando pelo ID do pedido. Nenhum outro registro precisa ser removido pois as demais tabelas ja estao limpas.

