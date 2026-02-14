
# Configuracoes de Integracao Z-API + Dashboard de Funil de Vendas

## Visao Geral
Duas novas paginas na area do vendedor: uma para gestao de credenciais Z-API com teste de conexao, e outra com o dashboard visual do funil de vendas de 90 dias, mostrando clientes em cada etapa com status de mensagens WhatsApp.

---

## Parte 1: Banco de Dados

### Tabela `vendedor_zapi_settings`
Credenciais Z-API por vendedor (cada vendedor pode ter sua propria instancia).

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| vendedor_id | uuid | FK vendedores, UNIQUE |
| instance_id | text | Z-API Instance ID |
| token | text | Z-API Token |
| client_token | text | Z-API Client Token |
| is_connected | boolean | Status da ultima validacao |
| last_tested_at | timestamptz | Data do ultimo teste |
| created_at / updated_at | timestamptz | Controle |

**RLS**: Vendedor le/escreve apenas seus proprios registros. Admins veem tudo.

**Nota**: Se a intencao for manter credenciais globais (como ja existe em `system_settings`), a tela pode simplesmente ler/escrever de `system_settings` com as chaves existentes (`zapi_instance_id`, `zapi_token`, `zapi_client_token`). A escolha depende se cada vendedor tera instancia propria ou se e uma unica instancia compartilhada. Vou implementar usando `system_settings` (compartilhado) com opcao de expandir futuramente, ja que a infraestrutura ja existe.

---

## Parte 2: Pagina de Configuracoes de Integracao

### Rota: `/vendedor/integracoes`

Tela com:
1. **Card de Credenciais Z-API**: Campos para Instance ID, Token, Client Token com toggle de visibilidade (senha)
2. **Botao "Salvar Credenciais"**: Grava em `system_settings`
3. **Botao "Testar Conexao"**: Chama a Edge Function `zapi-instance-info` com action `status` e mostra resultado (conectado/desconectado/erro)
4. **Indicador visual**: Badge verde (Conectado) ou vermelho (Desconectado) apos teste

Reutiliza a logica ja existente em `WhatsAppPanel.tsx` mas adaptada para a area do vendedor.

---

## Parte 3: Dashboard do Funil de Vendas

### Rota: `/vendedor/funil`

Dashboard com 5 cards de etapas do funil, usando dados reais de `ebd_clientes` e `ebd_pos_venda_ecommerce`:

### Etapas do Funil (calculadas via queries)

| Etapa | Logica de Consulta |
|-------|-------------------|
| **Compra Aprovada (Dia 0)** | `ebd_pos_venda_ecommerce` com `status = 'pendente'` (clientes e-commerce aguardando primeiro contato) |
| **Aguardando Login** | `ebd_clientes` com `status_ativacao_ebd = false` e `is_pos_venda_ecommerce = false` (cadastrados mas nunca logaram) |
| **Pendente de Configuracao** | `ebd_clientes` com `status_ativacao_ebd = true` e `onboarding_concluido = false` (logaram mas nao completaram quiz/onboarding) |
| **Ativos** | `ebd_clientes` com `status_ativacao_ebd = true`, `onboarding_concluido = true` e `ultimo_login` nos ultimos 30 dias |
| **Zona de Renovacao (75-90 dias)** | `ebd_clientes` com `data_proxima_compra` entre hoje e hoje + 15 dias (proximo de renovar) |

### Interface Visual

- 5 Cards horizontais com icone, contagem e nome da etapa
- Cores distintas: azul (Compra Aprovada), amarelo (Aguardando Login), laranja (Pendente Config), verde (Ativos), vermelho (Renovacao)
- Clicar em um card expande abaixo a lista de clientes daquela etapa
- Cada cliente mostra: nome da igreja, telefone, e badge com status da ultima mensagem WhatsApp

### Status WhatsApp por Cliente
Para cada cliente listado, buscar na tabela `whatsapp_mensagens` a ultima mensagem enviada para o telefone do cliente e exibir:
- **Enviada** (badge azul)
- **Entregue** (badge verde)
- **Lida** (badge verde escuro)
- **Erro** (badge vermelho)
- **Sem envio** (badge cinza)

Tambem cruzar com `whatsapp_webhooks` para eventos de delivery/read.

---

## Parte 4: Navegacao

Adicionar dois novos itens no menu lateral do vendedor:

```text
Sidebar:
  ...
  Funil de Vendas (icone: Filter)
  Integracoes (icone: Settings)
  ...
```

Ambos com `vendedorOnly: true`.

---

## Parte 5: Arquivos a Criar/Editar

### Novos Arquivos
1. `src/pages/vendedor/VendedorFunil.tsx` - Dashboard do funil com cards e lista expansivel
2. `src/pages/vendedor/VendedorIntegracoes.tsx` - Tela de configuracao Z-API

### Arquivos Editados
1. `src/App.tsx` - Adicionar rotas `/vendedor/funil` e `/vendedor/integracoes`
2. `src/components/vendedor/VendedorLayout.tsx` - Adicionar itens no menu lateral

### Nao requer migracoes de banco
Todas as tabelas necessarias ja existem (`system_settings`, `ebd_clientes`, `ebd_pos_venda_ecommerce`, `whatsapp_mensagens`, `whatsapp_webhooks`).

---

## Sequencia de Implementacao

1. Criar pagina `VendedorIntegracoes.tsx` com gestao de credenciais Z-API e teste de conexao
2. Criar pagina `VendedorFunil.tsx` com os 5 cards estatisticos e lista expansivel
3. Integrar status WhatsApp nos clientes listados (cruzando `whatsapp_mensagens`)
4. Atualizar rotas e sidebar
