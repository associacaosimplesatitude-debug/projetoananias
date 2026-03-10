

## Diagnóstico

Analisei os logs da Edge Function e identifiquei **dois problemas**:

1. **Botão URL (RESOLVIDO na última tentativa)** — o payload mais recente já tem `url` e `example` corretos no botão
2. **Header IMAGE (erro atual)** — Meta exige que imagens de header sejam enviadas via **Resumable Upload API** para obter um `handle`. Estamos passando uma URL direta, que não é aceita como `header_handle`

O erro atual é: *"Modelos com o tipo de cabeçalho IMAGE precisam de um exemplo/modelo, mas não foi fornecido"* — Meta rejeita a URL pública como `header_handle`.

## Plano de Correção

### Arquivo: `supabase/functions/whatsapp-submit-template/index.ts`

**Adicionar função de upload de imagem para Meta** antes do `Deno.serve`:
- Baixar a imagem da URL do storage
- Fazer upload via Meta Resumable Upload API (`POST /app/uploads` → `POST upload_url`)
- Retornar o `h:` handle válido

**Alterar a montagem do header IMAGE** (linhas 122-128):
- Antes de montar o componente, chamar a função de upload
- Usar o handle retornado no `header_handle`

```typescript
// 1. Upload image to Meta
async function uploadImageToMeta(imageUrl: string, accessToken: string): Promise<string> {
  // Download image
  const imgRes = await fetch(imageUrl);
  const imgBlob = await imgRes.blob();
  
  // Create upload session
  const sessionRes = await fetch(
    `https://graph.facebook.com/v22.0/app/uploads?file_type=${imgBlob.type}&file_length=${imgBlob.size}&access_token=${accessToken}`,
    { method: "POST" }
  );
  const sessionData = await sessionRes.json();
  
  // Upload file
  const uploadRes = await fetch(sessionData.uri, {
    method: "POST",
    headers: {
      "Authorization": `OAuth ${accessToken}`,
      "file_offset": "0",
      "Content-Type": imgBlob.type,
    },
    body: imgBlob,
  });
  const uploadData = await uploadRes.json();
  return uploadData.h; // the handle
}

// 2. No header IMAGE, usar:
const handle = await uploadImageToMeta(template.cabecalho_midia_url, accessToken);
components.push({
  type: "HEADER",
  format: "IMAGE", 
  example: { header_handle: [handle] },
});
```

### Resultado
O template será enviado com o handle de imagem válido da Meta, resolvendo o erro "Invalid parameter" no header IMAGE.

