

# Corrigir Download de Notas Fiscais

## Problema

O bucket de armazenamento `google_docs` esta configurado como **privado**, mas o codigo usa `getPublicUrl()` para gerar a URL do PDF. URLs publicas nao funcionam em buckets privados, resultando em erro ao tentar baixar o arquivo.

## Solucao

Alterar a funcao de download para usar `createSignedUrl()` que gera uma URL temporaria autenticada (valida por 1 hora), compativel com buckets privados.

## Alteracoes

### 1. `src/pages/admin/GoogleNotasFiscais.tsx`

Atualizar a funcao `handleDownload` para:
- Extrair o caminho (path) do arquivo a partir da `pdf_url` armazenada
- Usar `supabase.storage.from('google_docs').createSignedUrl(path, 3600)` para gerar uma URL assinada valida por 1 hora
- Abrir a URL assinada em nova aba
- Mostrar toast de erro caso a geracao da URL falhe

### 2. `src/components/google/InvoiceUploadModal.tsx`

Nenhuma alteracao necessaria no upload -- o upload funciona corretamente. Porem, a URL salva no banco via `getPublicUrl()` nao serve para download direto. Vamos manter a URL salva como referencia do path, e gerar a URL assinada somente no momento do download.

## Detalhes tecnicos

A funcao `handleDownload` passara de:

```text
window.open(invoice.pdf_url, "_blank")
```

Para:

```text
1. Extrair path do pdf_url (ex: "invoices/6403318992/2026-01/janeiro-2026.pdf")
2. Chamar createSignedUrl(path, 3600)
3. Abrir signedUrl em nova aba
```

