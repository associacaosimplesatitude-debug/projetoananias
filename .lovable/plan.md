
Sim — `MP_CLIENT_SECRET` deve ser da House Comunicação (dona do app `972960517601010`), pareada com o `MP_CLIENT_ID`.

## Onde pegar
1. Logar no MP como **House Comunicação** → https://www.mercadopago.com.br/developers/panel/app
2. Abrir o app `972960517601010`
3. Menu lateral → **Credenciais de produção**
4. Copiar **Client Secret** (não confundir com Access Token)

## Próximos passos
1. Atualizo a secret `MP_CLIENT_SECRET` no backend
2. Você refaz a URL de OAuth logado como **Editora Central Gospel**
3. Callback troca code → access_token e grava em `mp_connected_accounts`
4. Me devolve o `collector_id` retornado

## Observação
`Client Secret ≠ Access Token`. São credenciais diferentes no painel. Não precisa mexer em código — só atualizar a secret.

Pode me enviar o Client Secret que disparo a atualização.
