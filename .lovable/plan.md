

# Correcao do Envio de Emails Transacionais (Resend)

## Problemas Identificados

1. **Remetente incorreto**: O codigo atual usa `from: "Projeto Ananias <noreply@projetoananias.com.br>"` mas o dominio verificado no Resend e `painel.editoracentralgospel.com.br`
2. **Edge function nao registrada**: `send-royalties-email` nao esta no `supabase/config.toml`, o que impede o deploy
3. A `RESEND_API_KEY` ja esta configurada nos secrets - ok

## Alteracoes

### 1. Registrar a edge function no config.toml

Adicionar `[functions.send-royalties-email]` com `verify_jwt = false` (a funcao valida auth internamente via service role).

### 2. Corrigir o remetente na edge function

Atualizar `supabase/functions/send-royalties-email/index.ts`:

- Trocar o `from` de `"Projeto Ananias <noreply@projetoananias.com.br>"` para `"Relatorios <relatorios@painel.editoracentralgospel.com.br>"` (dominio verificado no Resend)

### 3. Deploy da edge function

Fazer o deploy de `send-royalties-email` para que fique disponivel.

## Arquivos alterados

| Arquivo | Acao |
|---------|------|
| `supabase/config.toml` | Adicionar registro da funcao |
| `supabase/functions/send-royalties-email/index.ts` | Corrigir remetente |

