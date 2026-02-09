

# Ajuste de Nomenclaturas e Botoes de Status/Device Z-API

## Resumo

Corrigir as nomenclaturas dos campos para alinhar com a documentacao oficial da Z-API e adicionar dois botoes na aba Credenciais para verificar o status da instancia e os dados do celular conectado.

## Alteracoes

### 1. Nomenclaturas - Aba Credenciais

Ajustar os labels dos campos para ficarem identicos ao painel da Z-API:

| Campo atual | Novo label | Chave no banco |
|-------------|-----------|----------------|
| Instance ID | ID da Instancia | zapi_instance_id |
| Token da Instancia | Token da Instancia | zapi_token |
| Client Token | Token de Seguranca da Conta | zapi_client_token |

### 2. Nova Edge Function `zapi-instance-info`

Criar uma unica edge function que aceita um parametro `action` ("status" ou "device") e faz o GET correspondente na Z-API:

- `GET /status` - Retorna o status da instancia (connected, smartPhoneConnected, session, etc.)
- `GET /device` - Retorna dados do celular conectado (phone, name, imgUrl, device, etc.)

A funcao:
- Valida autenticacao do usuario
- Busca credenciais da `system_settings`
- Faz GET no endpoint correto da Z-API com header `Client-Token`
- Retorna o resultado

### 3. Frontend - Botoes na aba Credenciais

Adicionar na aba Credenciais, abaixo do botao "Salvar Credenciais":

- **Botao "Verificar Status"**: Chama a edge function com action=status e exibe o resultado em um card/bloco JSON formatado
- **Botao "Dados do Celular"**: Chama a edge function com action=device e exibe o resultado (telefone, nome, modelo, etc.)

Os resultados serao exibidos em cards visuais com os dados principais destacados e o JSON completo disponivel para inspecao.

## Detalhes Tecnicos

### Endpoints Z-API utilizados

```text
GET https://api.z-api.io/instances/{INSTANCE_ID}/token/{TOKEN}/status
GET https://api.z-api.io/instances/{INSTANCE_ID}/token/{TOKEN}/device
Header: Client-Token: {CLIENT_TOKEN}
```

### Resposta esperada do /status

```text
{
  "connected": true/false,
  "smartPhoneConnected": true/false,
  "session": "connected"/"disconnected",
  ...
}
```

### Resposta esperada do /device

```text
{
  "phone": "5521...",
  "name": "Nome",
  "imgUrl": "...",
  "device": { "sessionName": "...", "device_model": "..." },
  ...
}
```

### Arquivos criados/alterados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/zapi-instance-info/index.ts` | Criar edge function |
| `src/pages/admin/WhatsAppPanel.tsx` | Ajustar labels + adicionar botoes + exibir resultados |

