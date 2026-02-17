
# Implementacao: Fluxo 2 mensagens + Teste

## Resumo

1. **Migracao SQL**: Adicionar colunas `email_acesso` e `senha_temp` em `funil_posv_tracking`
2. **send-whatsapp-message**: Adicionar suporte a `buttonActions` para usar `/send-button-actions`
3. **ebd-shopify-order-webhook**: Reescrever Mensagem 1 sem credenciais, salvar email/senha no tracking, botao com tracker URL
4. **whatsapp-link-tracker**: Ao detectar clique fase 1, disparar Mensagem 2 com credenciais automaticamente
5. **Teste**: Enviar Mensagem 1 para 5511964103366 (Cleuton Soares) com dados ficticios

## Secao Tecnica

### Migracao SQL
```sql
ALTER TABLE funil_posv_tracking
ADD COLUMN IF NOT EXISTS email_acesso TEXT,
ADD COLUMN IF NOT EXISTS senha_temp TEXT;
```

### send-whatsapp-message/index.ts
- Linha 38: extrair `title`, `footer`, `buttonActions` do body
- Linhas 88-94: adicionar condicao para buttonActions antes de imagem/texto

### ebd-shopify-order-webhook/index.ts
- Linhas 690-695: adicionar `email_acesso` e `senha_temp` no upsert do tracking
- Linhas 742-748: reescrever mensagem Fase 1 no novo formato sem credenciais
- Linha 760: URL do botao usa tracker `whatsapp-link-tracker?c=ID&f=1&r=/login/ebd`

### whatsapp-link-tracker/index.ts
- Ao receber clique fase 1: verificar se ja foi clicado antes, buscar dados do cliente e credenciais, enviar Mensagem 2 via Z-API com botao "Acessar meu Painel"

### Teste
Chamar `send-whatsapp-message` com payload da Mensagem 1 para 5511964103366.
