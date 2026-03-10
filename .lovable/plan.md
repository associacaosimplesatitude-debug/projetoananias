

## Plano: Forçar Redeploy da Edge Function

### Diagnóstico
Os logs confirmam que a versão em execução da `whatsapp-submit-template` **não contém** a função `uploadImageToMeta`. O payload enviado à Meta mostra:
```
"header_handle":["https://nccyrvfnvjngfyfvgnww.supabase.co/storage/v1/object/public/whatsapp-media/..."]
```
Quando deveria mostrar um handle como `"h:abc123..."`. Nenhum log `[upload-image]` aparece, confirmando que o código atualizado nunca foi executado.

### Solução
Forçar o redeploy da Edge Function `whatsapp-submit-template`. O código já está correto no arquivo — só precisa ser deployado.

### Ação
1. Fazer uma pequena alteração cosmética no arquivo (ex: adicionar um log extra) para garantir que o Lovable faça o deploy automático da versão atualizada com `uploadImageToMeta`.

### Resultado Esperado
Após o redeploy, ao submeter um template com header IMAGE:
1. Logs mostrarão `[upload-image] Downloading image from:...`
2. A imagem será enviada via Resumable Upload API da Meta
3. O `header_handle` conterá um handle válido (`h:...`)
4. Meta aceitará o template

