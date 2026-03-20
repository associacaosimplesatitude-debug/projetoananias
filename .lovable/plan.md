

## Correção do link da embaixadora no modal de detalhes

O link no modal usa `window.location.origin` (que retorna o domínio do preview/lovable), mas deveria usar o domínio de produção `gestaoebd.com.br`.

### Alteração em `src/pages/admin/SorteioAdmin.tsx`

Nas linhas 1330 e 1337, substituir `${window.location.origin}/r/` por `https://gestaoebd.com.br/r/` — hardcoded, igual ao que é usado nos e-mails e no painel da embaixadora.

