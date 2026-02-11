

# Rota dedicada de login para Autores

## Problema
O domínio `autor.editoracentralgospel.com.br` está configurado e ativo no Lovable, porém `gestaoebd.com.br` é o domínio **primário** (marcado com estrela). Isso faz com que a plataforma redirecione automaticamente todos os domínios secundários para o primário, antes do código da aplicação ser executado.

## Solução
Criar uma rota dedicada `/login/autor` que mostra o login com branding da Central Gospel, independente do domínio. Assim o link enviado aos autores será `https://gestaoebd.com.br/login/autor` (ou o domínio do autor, caso o redirect seja corrigido no futuro).

## Alterações

### 1. Criar página `src/pages/AutorLogin.tsx`
Página simples de login exclusiva para autores com:
- Logo da Central Gospel Editora
- Título "Login"
- Texto "Entre com suas credenciais para acessar a área do autor"
- Apenas formulário de email + senha (sem opção de cadastro)
- Após login, redireciona para `/autor`

### 2. Registrar rota em `src/App.tsx`
Adicionar: `<Route path="/login/autor" element={<AutorLogin />} />`
(ao lado da rota existente `/login/ebd`)

### 3. Atualizar link no email - `src/components/royalties/AutorDialog.tsx`
Alterar o `link_login` de:
```
https://autor.editoracentralgospel.com.br/auth
```
Para:
```
https://gestaoebd.com.br/login/autor
```
Isso garante que funciona imediatamente, sem depender do domínio secundário.

### 4. Manter o código do `useDomainBranding.tsx` e `Auth.tsx`
As alterações anteriores no branding e na detecção de domínio continuam válidas. Se no futuro o domínio `autor.editoracentralgospel.com.br` deixar de redirecionar, o `/auth` também funcionará com o branding correto.

## O que NÃO muda
- Nenhuma tabela ou RLS alterada
- Login de EBD, Ananias e admin permanecem iguais
- Portal do autor (`/autor/*`) não sofre alteração

