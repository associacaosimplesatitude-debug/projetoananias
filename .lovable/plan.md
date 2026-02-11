
# Login Exclusivo para Autores no dominio autor.editoracentralgospel.com.br

## Resumo

Criar experiencia de login diferenciada para autores acessando via `autor.editoracentralgospel.com.br`, com logo da Central Gospel Editora (imagem fornecida) e texto exclusivo. Atualizar o link enviado nos emails de dados de acesso.

## Alteracoes

### 1. Salvar o logo fornecido

Copiar o logo enviado (`horizontal-3.png`) para `public/logos/logo-central-gospel-autor.png` para uso no login do autor. O logo existente (`logo-central-gospel-horizontal.png`) tambem pode ser avaliado, mas usaremos o novo fornecido para garantir que e exatamente o desejado.

### 2. `src/hooks/useDomainBranding.tsx`

- Adicionar propriedade `isAutor: boolean` na interface `DomainBranding`
- Criar novo objeto `autorBranding` com:
  - `logoUrl`: `/logos/logo-central-gospel-autor.png`
  - `appName`: "Area do Autor"
  - `primaryColor` / `accentColor`: cores da Central Gospel (preto `#1a1a1a` e amarelo/dourado `#E8A917`)
  - `isAutor: true`
- Atualizar deteccao no `useDomainBranding`: se hostname inclui `editoracentralgospel`, retornar `autorBranding`
- Adicionar `isAutor: false` nos demais objetos de branding (ebdBranding, ananiasBranding)

### 3. `src/pages/Auth.tsx`

Quando `domainBranding.isAutor === true`:

- Mostrar logo da Central Gospel Editora
- Descricao simplificada: "Entre com suas credenciais para acessar a area do autor"
- Esconder o botao "Nao tem uma conta? Cadastre-se" (autores nao se cadastram sozinhos)
- Esconder opcao de "Criar Conta" (manter apenas login)

### 4. `src/components/royalties/AutorDialog.tsx` (linha 317)

Alterar:
```
link_login: "https://gestaoebd.lovable.app/autor"
```
Para:
```
link_login: "https://autor.editoracentralgospel.com.br/auth"
```

### 5. Redirect pos-login para autores

No `handlePostLoginRedirect` do `Auth.tsx`, adicionar verificacao de role `autor` (consultando `user_roles`) para redirecionar para `/autor` quando o dominio for o do autor. Isso garante que ao fazer login nesse dominio, o autor va direto para seu painel.

## O que NAO muda

- Nenhuma rota nova e criada
- Login de EBD, Ananias e admin permanecem identicos
- Portal do autor (`/autor/*`) nao sofre alteracao
- Logica de autenticacao e roles permanece a mesma
- Banco de dados nao e alterado
