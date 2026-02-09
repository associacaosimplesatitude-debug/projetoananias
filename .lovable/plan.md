

# Disparo Automatico de Emails: Dados de Acesso e Link de Afiliado

## Resumo

Implementar o disparo automatico de emails em duas acoes:

1. **Dados de Acesso ao Painel de Royalties** - Quando um novo autor e cadastrado com email, enviar automaticamente o template `autor_acesso` com as credenciais de login.
2. **Link de Afiliado** - Quando um novo link de afiliado e criado, enviar automaticamente o template `afiliado_link` para o autor com o link e codigo.

## Correcao necessaria

O template `autor_acesso` ainda tem o assunto "Seus dados de acesso - Projeto Ananias". Sera corrigido via SQL para "Seus dados de acesso - Central Gospel Editora".

## Alteracoes

### 1. Corrigir assunto do template `autor_acesso`

Migração SQL para atualizar o assunto removendo "Projeto Ananias".

### 2. Disparo automatico: Link de Afiliado

No arquivo `src/components/royalties/AffiliateLinkDialog.tsx`, apos o `insert` bem-sucedido na tabela `royalties_affiliate_links`, disparar a edge function `send-royalties-email` com:

- `autorId`: ID do autor selecionado
- `templateCode`: `afiliado_link`
- `dados`:
  - `livro`: titulo do livro
  - `link_afiliado`: URL completa do link gerado (`{origin}/livro/{slug}`)
  - `codigo`: codigo do afiliado gerado

O envio sera feito em background (sem bloquear a UI). Se falhar, exibe toast de aviso mas nao impede o cadastro.

### 3. Disparo automatico: Dados de Acesso

No componente `AutorDialog.tsx` (cadastro de autores), apos o insert bem-sucedido de um novo autor que possua email, disparar a edge function com:

- `autorId`: ID do autor recem-criado
- `templateCode`: `autor_acesso`
- `dados`:
  - `senha_temporaria`: senha gerada para o autor
  - `link_login`: URL do portal do autor (`https://gestaoebd.lovable.app/autor`)

Isso depende de como o cadastro de autor cria o usuario de login. Sera necessario verificar o fluxo no `AutorDialog` para integrar corretamente.

## Detalhes Tecnicos

### Arquivos alterados

| Arquivo | Acao |
|---------|------|
| `src/components/royalties/AffiliateLinkDialog.tsx` | Adicionar disparo do email `afiliado_link` apos insert |
| `src/components/royalties/AutorDialog.tsx` | Adicionar disparo do email `autor_acesso` apos criacao de autor |
| Migracao SQL | Corrigir assunto do template `autor_acesso` |

### Logica de envio (ambos os casos)

```text
// Apos insert bem-sucedido:
supabase.functions.invoke("send-royalties-email", {
  body: { autorId, templateCode, dados }
}).then(() => {
  toast.success("Email enviado ao autor");
}).catch((err) => {
  console.error(err);
  toast.warning("Cadastro realizado, mas houve erro ao enviar email");
});
```

O envio nao bloqueia o fluxo principal - se falhar, o cadastro ja foi concluido com sucesso.

