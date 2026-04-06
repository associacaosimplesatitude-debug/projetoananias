

# Diagnóstico: Por que o livro "teste" não mostra o PDF no celular

## Problemas encontrados

### Problema 1: `pdf_url` está NULL no banco de dados
O livro "teste" foi cadastrado com `leitura_continua: true` e `tipo_conteudo: livro_digital`, porém a coluna `pdf_url` está **NULL**. Também não há arquivo `completo.pdf` no storage.

**Causa raiz**: A função `handleGlobalPdfUpload` no `RevistasDigitais.tsx` faz upload do PDF para o storage (`revistas/{id}/completo.pdf`), mas **nunca atualiza a coluna `pdf_url`** na tabela `revistas_digitais`. O campo fica vazio.

### Problema 2: Nenhuma assinatura foi criada
A tabela `revista_assinaturas` está **vazia**. O componente `AlunoRevistaVirtual.tsx` depende de uma assinatura ativa para carregar o conteúdo. Sem assinatura, o aluno não consegue acessar nenhum livro.

A tela que aparece no celular ("Nenhuma lição disponível no momento") vem de um fluxo onde o aluno pode ter uma licença mas sem assinatura vinculada, e o sistema mostra as lições (que não existem para livros).

### Problema 3 (potencial): O botão "Ler Livro" navega para `/ebd/livro/{id}/ler`, mas sem `pdf_url` e sem arquivo no storage, a tela mostra "Conteúdo ainda não disponível"

## Plano de correção (2 arquivos)

### Correção 1: `RevistasDigitais.tsx` — Salvar `pdf_url` após upload do PDF

Na função `handleGlobalPdfUpload`, após o upload bem-sucedido no storage, obter a URL pública e atualizar a coluna `pdf_url` da revista:

```typescript
// Após upload com sucesso:
const { data: urlData } = supabase.storage.from("revistas").getPublicUrl(path);
await supabase.from("revistas_digitais")
  .update({ pdf_url: urlData.publicUrl })
  .eq("id", revistaId);
```

### Correção 2: `AlunoRevistaVirtual.tsx` — Tratar corretamente o fluxo de licença para livros

Quando o acesso vem via licença (`resolvedRevistaId`), o `select("*")` na linha 103 já traz `leitura_continua`, mas o objeto é montado como `{ revista_id, revista, status }`. Na linha 305, `assinatura.revista` funciona corretamente para o join da assinatura, mas para o fluxo de licença, o objeto `revista` contém todos os campos diretamente.

Verificar que o campo `leitura_continua` é acessado corretamente em ambos os fluxos.

## Resumo dos problemas
1. **PDF não foi salvo no banco** — `handleGlobalPdfUpload` não atualiza `pdf_url`
2. **Sem assinatura** — se o admin não criou uma assinatura em "Assinaturas", o aluno não vê nada
3. Mesmo que a assinatura existisse, o PDF URL estaria null → tela "Conteúdo não disponível"

