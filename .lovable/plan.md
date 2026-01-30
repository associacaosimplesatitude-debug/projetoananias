
# Correção Urgente: Landing Page do Livro Redirecionando para EBD

## Diagnóstico

A página `/livro/cativeiro-babilonico` está redirecionando para a landing page da Gestão EBD porque:

1. **As alterações não foram publicadas** - A rota `/livro/:slug` foi adicionada recentemente mas ainda não está no ambiente de produção (`gestaoebd.com.br`)
2. **A rota está corretamente configurada** no código (App.tsx linha 196) como rota pública, fora do `ProtectedRoute`

## URLs Disponíveis

| Ambiente | URL | Status |
|----------|-----|--------|
| Preview Lovable | `https://gestaoebd.lovable.app/livro/cativeiro-babilonico` | ✅ Funciona |
| Produção | `https://gestaoebd.com.br/livro/cativeiro-babilonico` | ❌ Precisa publicar |

## Ação Necessária

### 1. Publicar o Projeto

Você precisa **publicar o projeto** para que as alterações (nova rota e RLS policies) sejam aplicadas ao domínio de produção `gestaoebd.com.br`.

Para publicar:
1. Clique no botão **"Publish"** no canto superior direito da interface Lovable
2. Aguarde o deploy ser concluído
3. Teste acessando `https://gestaoebd.com.br/livro/cativeiro-babilonico`

### 2. Verificação Pós-Publicação

Após publicar, o link correto para compartilhar será:

```
https://gestaoebd.com.br/livro/cativeiro-babilonico
```

## Enquanto isso (alternativa temporária)

Se precisar usar o link **agora** antes de publicar, use o domínio do preview:

```
https://gestaoebd.lovable.app/livro/cativeiro-babilonico
```

Este link já funciona porque está no ambiente de preview onde as alterações já estão aplicadas.
