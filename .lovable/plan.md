

# Rastreamento de Abertura e Cliques nos Emails EBD

## Resumo

Adicionar rastreamento de abertura (open tracking) e cliques em links (click tracking) nos emails enviados, exibindo essas informacoes tanto no historico quanto nos cards da aba "Automaticos".

## Alteracoes

### 1. Banco de dados -- novos campos na tabela `ebd_email_logs`

Adicionar 4 colunas:
- `email_aberto` (boolean, default false)
- `data_abertura` (timestamptz, nullable)
- `link_clicado` (boolean, default false)
- `data_clique` (timestamptz, nullable)

### 2. Edge Function -- `ebd-email-tracker`

Criar uma nova Edge Function que recebe requisicoes GET com parametros para registrar aberturas e cliques:

- **Abertura**: `GET /ebd-email-tracker?type=open&logId=xxx` -- retorna um pixel transparente 1x1 (imagem GIF) e atualiza `email_aberto=true` e `data_abertura=now()` no log
- **Clique**: `GET /ebd-email-tracker?type=click&logId=xxx&url=https://...` -- atualiza `link_clicado=true` e `data_clique=now()` no log, e redireciona o usuario para a URL original

### 3. Injecao do tracking nos emails enviados

Nas Edge Functions `send-ebd-email` e `ebd-email-cron`, apos montar o HTML final e ANTES de enviar via Resend:
- Inserir o log no banco primeiro (para obter o `logId`)
- Adicionar um `<img>` pixel de tracking no final do corpo HTML apontando para a funcao tracker
- Reescrever os links `<a href="...">` no HTML para apontar para a funcao tracker com redirect

### 4. Frontend -- Historico (tabela)

Na tabela de historico, adicionar duas novas colunas apos "Status":
- **Aberto**: icone de olho verde se `email_aberto=true` com tooltip mostrando a data/hora, cinza se nao
- **Clicou**: icone de cursor/link verde se `link_clicado=true` com tooltip mostrando data/hora, cinza se nao

### 5. Frontend -- Aba Automaticos (cards)

Adicionar dois novos cards de estatisticas alem dos 3 existentes (Hoje/Semana/Mes):
- **Taxa de Abertura**: percentual de emails com `email_aberto=true` sobre o total enviado (no periodo do mes)
- **Taxa de Clique**: percentual de emails com `link_clicado=true` sobre o total enviado (no periodo do mes)

Os cards existentes passam de grid-cols-3 para grid-cols-5 (ou 2 linhas em mobile).

### Sequencia de implementacao

1. Migracao do banco (adicionar colunas)
2. Criar Edge Function `ebd-email-tracker`
3. Atualizar `send-ebd-email` para inserir log antes e injetar pixel + rewrite de links
4. Atualizar `ebd-email-cron` com a mesma logica de tracking
5. Atualizar frontend `VendedorEmailsEBD.tsx` com colunas e cards novos

