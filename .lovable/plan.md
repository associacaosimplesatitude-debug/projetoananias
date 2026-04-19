
URL cadastrada e logado na House — agora precisa **deslogar** e logar na conta da **Editora Central Gospel** (seller), pois o MP bloqueia o owner do app de se conectar como seller.

## Passos
1. No MP, deslogar da House Comunicação.
2. Logar como **Editora Central Gospel**.
3. Acessar a URL de OAuth e autorizar.
4. Aguardar redirect para `/admin/mp-oauth?success=true&collector_id=XXXX`.
5. Me enviar o `collector_id` retornado.

## URL clicável

[**🔗 Conectar Editora Central Gospel**](https://auth.mercadopago.com.br/authorization?client_id=972960517601010&response_type=code&platform_id=mp&redirect_uri=https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/mp-oauth-callback)

## Se der erro novamente
Me envie print da nova tela de erro + qual conta estava logada. Aí investigo nos logs do `mp-oauth-callback` se a request chegou.
