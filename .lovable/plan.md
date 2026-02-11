

# Corrigir redirecionamento do /login/autor no site publicado

## Problema

No ambiente de preview, a rota `/login/autor` funciona perfeitamente. O problema ocorre apenas no site publicado (`gestaoebd.com.br`). Quando voce acessa `gestaoebd.com.br/login/autor` diretamente no navegador, o servidor nao encontra um arquivo fisico nesse caminho e redireciona para `/auth` (ou retorna erro).

Isso acontece porque aplicacoes React SPA (Single Page Application) precisam de uma configuracao de fallback no servidor: todas as rotas devem servir o `index.html`, e o React Router cuida do roteamento no navegador.

## Solucao

Criar o arquivo `public/_redirects` com a regra de fallback SPA. Isso instrui o servidor a servir `index.html` para qualquer rota que nao corresponda a um arquivo fisico.

## Alteracao

### Criar `public/_redirects`

Conteudo:
```
/*    /index.html   200
```

Esta unica linha resolve o problema para `/login/autor` e qualquer outra rota futura que seja acessada diretamente pela URL.

## O que NAO muda

- Nenhum componente React e alterado
- Nenhuma rota e alterada
- Arquivos estaticos (imagens, CSS, JS) continuam sendo servidos normalmente
- O comportamento no preview continua identico

