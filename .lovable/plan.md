

# Limpeza de Registros para Teste: cayk500@gmail.com

## Registros encontrados

- **auth.users**: 1 registro (ID: `1cfcf0fb-4bd7-4df8-8bf5-2c02b28c9efe`)
- **profiles**: 1 registro (mesmo ID)
- **ebd_clientes**: nenhum
- **ebd_shopify_pedidos**: nenhum
- **funil_posv_tracking**: nenhum

## Acoes

1. Deletar o usuario Auth via Edge Function `delete-user` ou diretamente via admin API (isso automaticamente remove o profile por cascade)
2. Confirmar que todos os registros foram removidos

Assim, quando voce fizer a compra no Shopify com esse email, o webhook vai:
- Criar o usuario Auth do zero
- Gerar a senha temporaria
- Atualizar o ebd_clientes
- Inserir no funil pos-venda
- Enviar o WhatsApp da Fase 1

## Secao Tecnica

A limpeza sera feita chamando a Edge Function `delete-user` que ja existe no projeto, passando o `userId: "1cfcf0fb-4bd7-4df8-8bf5-2c02b28c9efe"`. Isso deleta o usuario do auth.users e o cascade remove o profile automaticamente.

