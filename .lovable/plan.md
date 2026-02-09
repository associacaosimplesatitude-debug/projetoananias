
# Painel WhatsApp com Aba de Credenciais Z-API

## Resumo

Criar a pagina do painel WhatsApp em `/admin/ebd/whatsapp` com uma aba de **Credenciais** onde voce podera salvar as credenciais da Z-API (Instance ID, Token e Client Token) diretamente pelo painel, sem precisar configurar por fora. As credenciais serao armazenadas no banco de dados na tabela `system_settings`.

## Alteracoes

### 1. Banco de Dados

**Nova tabela `system_settings`** para armazenar configuracoes do sistema (incluindo credenciais Z-API):

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| key | text (unique) | Chave da configuracao (ex: `zapi_instance_id`) |
| value | text | Valor (criptografado para dados sensiveis) |
| description | text | Descricao da configuracao |
| updated_by | uuid | Quem alterou por ultimo |
| updated_at | timestamptz | Data da ultima alteracao |

RLS: Apenas usuarios admin/gerente_ebd podem ler e editar.

**Nova tabela `whatsapp_mensagens`** para historico de mensagens (conforme plano anterior).

### 2. Pagina `src/pages/admin/WhatsAppPanel.tsx`

Pagina com **2 abas** (usando Tabs do shadcn):

- **Aba "Enviar Mensagem"**: Formulario de envio (tipo, telefone, nome, mensagem, URL imagem) + historico de mensagens enviadas
- **Aba "Credenciais Z-API"**: Formulario para salvar/editar as 3 credenciais:
  - Instance ID
  - Token da Instancia
  - Client Token
  - Botao "Salvar Credenciais"
  - Indicador visual de status (configurado/nao configurado)
  - Campos com mascara de senha (mostrar/ocultar)

### 3. Edge Function `send-whatsapp-message`

Funcao que:
- Busca as credenciais Z-API da tabela `system_settings` (nao de secrets)
- Envia mensagem via Z-API
- Registra no historico

### 4. Rota e Navegacao

- Adicionar rota `/admin/ebd/whatsapp` no `App.tsx`
- Adicionar link "WhatsApp" no sidebar do admin EBD (`AdminEBDLayout.tsx`) na secao Configuracoes, com icone de mensagem

## Detalhes Tecnicos

### Fluxo de Credenciais

```text
Aba Credenciais -> Salva em system_settings -> Edge Function le de system_settings -> Envia via Z-API
```

### Chaves armazenadas em `system_settings`

- `zapi_instance_id` - ID da instancia Z-API
- `zapi_token` - Token da instancia
- `zapi_client_token` - Token de seguranca da conta

### Arquivos criados/alterados

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar tabelas `system_settings` e `whatsapp_mensagens` |
| `supabase/functions/send-whatsapp-message/index.ts` | Criar edge function |
| `src/pages/admin/WhatsAppPanel.tsx` | Criar pagina com 2 abas |
| `src/App.tsx` | Adicionar rota |
| `src/components/admin/AdminEBDLayout.tsx` | Adicionar link no sidebar |
