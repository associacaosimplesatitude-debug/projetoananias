

# Correcoes: Download PDF + Solicitacao de Recarga

## Problema 1: Download PDF bloqueado pelo navegador

O `window.open(signedUrl)` abre uma nova aba com uma URL que contem "google" no path do arquivo. Extensoes de bloqueio de anuncios (como AdBlock) detectam isso e bloqueiam a pagina com "ERR_BLOCKED_BY_CLIENT".

**Solucao:** Em vez de abrir a URL em nova aba, fazer download via `fetch` + Blob, criando um link temporario de download que nao e interceptado por ad blockers.

### Arquivo: `src/pages/admin/GoogleNotasFiscais.tsx`

Alterar `handleDownload` para:
1. Gerar a signed URL normalmente
2. Fazer `fetch(signedUrl)` para obter o conteudo como blob
3. Criar um `URL.createObjectURL(blob)` e simular clique em link de download
4. Revogar a URL temporaria apos o download

## Problema 2: Financeiro nao consegue solicitar recarga

A tabela `system_settings` tem RLS que permite leitura apenas para `admin` e `gerente_ebd`. O role `financeiro` nao consegue ler o `google_ads_customer_id`, resultando em `customerId` vazio e a mensagem "Configure o Customer ID".

**Solucao:** Adicionar o role `financeiro` na policy de SELECT da tabela `system_settings`.

### Migracao SQL

Atualizar a policy `Admins can read system_settings` para incluir `financeiro`:

```text
DROP POLICY "Admins can read system_settings" ON system_settings;
CREATE POLICY "Authorized roles can read system_settings" ON system_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'gerente_ebd', 'financeiro')
    )
  );
```

## Resumo de alteracoes

1. `src/pages/admin/GoogleNotasFiscais.tsx` -- download via blob em vez de window.open
2. Migracao SQL -- adicionar financeiro na policy de leitura de system_settings

