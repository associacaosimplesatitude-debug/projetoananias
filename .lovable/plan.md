
Usuário só precisa da URL de conexão. Não há código a alterar — tudo já foi implementado no prompt anterior. A resposta já contém:

1. URL helper para obter o `MP_CLIENT_ID`: `https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/get-mp-client-id`
2. Template da URL de OAuth com `redirect_uri` correto apontando pro `mp-oauth-callback` deployado.
3. Checklist no painel MP (cadastrar Redirect URI + logar com a conta da Editora Central Gospel).
4. Destino pós-callback: `/admin/mp-oauth?success=true&collector_id=...`.

Próximo passo prático: usuário acessa a URL, autoriza com a conta da Editora, e me avisa o `collector_id` retornado. A partir daí o `mp-create-order-and-pay` passa a usar OAuth + `application_fee` automaticamente (sem mais `[MP] modo_legado_sem_split` nos logs).
