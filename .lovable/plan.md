

# Separar Controle: Agente de IA vs Envio Automatico

## Situacao Atual
A flag `whatsapp_auto_envio_ativo` controla tudo: tanto o envio automatico de mensagens (pedidos, funil pos-venda) quanto as respostas do Agente de IA a mensagens recebidas. Nao ha como desligar um sem desligar o outro.

## O Que Sera Feito

### 1. Nova configuracao no banco de dados
Criar uma nova chave `whatsapp_agente_ia_ativo` na tabela `system_settings` com valor inicial `"false"` (desativado conforme solicitado).

### 2. Alterar o webhook do WhatsApp
No arquivo `supabase/functions/whatsapp-webhook/index.ts`, trocar a verificacao da flag:
- **Antes**: checa `whatsapp_auto_envio_ativo` para decidir se processa mensagens recebidas com IA
- **Depois**: checa a nova flag `whatsapp_agente_ia_ativo` para decidir se o Agente de IA responde

Isso significa que o envio automatico (pedidos, funil) continua funcionando normalmente com a flag existente, e o Agente de IA fica controlado por sua propria flag.

### 3. Adicionar switch no painel WhatsApp
No arquivo `src/pages/admin/WhatsAppPanel.tsx`, adicionar um novo switch "Agente de IA" ao lado do switch "Envio Automatico" existente, permitindo controlar cada funcionalidade independentemente.

## Resultado
- **Envio Automatico** (pedidos, funil pos-venda): continua LIGADO, controlado pela flag existente
- **Agente de IA** (respostas automaticas a mensagens recebidas): DESLIGADO, controlado pela nova flag

## Secao Tecnica

### Migracao SQL
```sql
INSERT INTO system_settings (key, value, description)
VALUES ('whatsapp_agente_ia_ativo', 'false', 'Liga/desliga o Agente de IA do WhatsApp')
ON CONFLICT (key) DO NOTHING;
```

### Arquivo: `supabase/functions/whatsapp-webhook/index.ts`
- Linha 217: trocar `eq("key", "whatsapp_auto_envio_ativo")` por `eq("key", "whatsapp_agente_ia_ativo")`
- Linha 220: trocar `autoEnvioSetting` por `agenteIaSetting` (renomear variavel)
- Mensagem de log: "Agente de IA desativado - flag independente"

### Arquivo: `src/pages/admin/WhatsAppPanel.tsx`
- Adicionar estado `agenteIaAtivo` com query para a nova key
- Adicionar switch "Agente de IA" na interface, similar ao switch existente de "Envio Automatico"
- Handler de toggle fazendo upsert na key `whatsapp_agente_ia_ativo`

