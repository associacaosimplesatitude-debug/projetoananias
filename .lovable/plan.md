

# Corrigir Download de Notas Fiscais - Bucket Not Found

## Problema

O `InvoiceUploadModal` salva no campo `pdf_url` a URL publica gerada por `getPublicUrl()`. Como o bucket `google_docs` e privado, essa URL retorna "Bucket not found". O `handleDownload` ja tenta extrair o path e gerar uma signed URL, mas o mais robusto e salvar diretamente o path do arquivo no banco.

## Alteracoes

### 1. `src/components/google/InvoiceUploadModal.tsx`

Na linha 67-68, trocar:

```text
const { data: urlData } = supabase.storage.from('google_docs').getPublicUrl(path);
pdfUrl = urlData.publicUrl;
```

Para salvar apenas o path relativo:

```text
pdfUrl = path;
```

Isso garante que o `pdf_url` no banco contem apenas o caminho do arquivo (ex: `invoices/6403318992/2026-12/dezembro-2025.pdf`), nao a URL publica.

### 2. `src/pages/admin/GoogleNotasFiscais.tsx`

Atualizar `handleDownload` para lidar com ambos os formatos (path antigo com URL publica e path novo direto):

- Se `pdf_url` contem `object/public/google_docs/`, extrair o path via regex (compatibilidade com registros antigos)
- Senao, usar `pdf_url` diretamente como path
- Gerar signed URL com `createSignedUrl(path, 3600)`

## Resumo

- Registros novos: `pdf_url` salvara apenas o path relativo
- Registros antigos: o download continuara funcionando extraindo o path da URL publica
- Ambos os casos usam `createSignedUrl` para gerar URL temporaria autenticada

