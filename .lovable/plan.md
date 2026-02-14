

# Implementar Sistema Completo de Emails de Vendas para EBD

## Visao Geral
Criar um sistema de emails transacionais para o pipeline de vendas EBD, reutilizando a infraestrutura existente (Resend, templates no banco). Serao 8 templates de email, uma Edge Function dedicada, tabelas de controle, e uma pagina de gestao na area do vendedor.

---

## Parte 1: Banco de Dados

### Tabela `ebd_email_templates`
Armazena os templates de email para vendas EBD (separado dos templates de royalties).

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| codigo | text | Codigo unico (ex: `ebd_reposicao_14d`) |
| nome | text | Nome amigavel |
| descricao | text | Descricao do uso |
| assunto | text | Assunto com variaveis `{nome}` |
| corpo_html | text | HTML do email |
| variaveis | jsonb | Lista de variaveis aceitas |
| is_active | boolean | Ativo/inativo |
| created_at / updated_at | timestamptz | Controle |

### Tabela `ebd_email_logs`
Historico de envios.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| template_id | uuid | FK para ebd_email_templates |
| cliente_id | uuid | FK para ebd_clientes |
| vendedor_id | uuid | FK para vendedores |
| destinatario | text | Email destino |
| assunto | text | Assunto enviado |
| status | text | enviado / erro |
| erro | text | Mensagem de erro |
| dados_enviados | jsonb | Variaveis usadas |
| tipo_envio | text | manual / automatico / cron |
| resend_email_id | text | ID do Resend |
| created_at | timestamptz | Data do envio |

### RLS Policies
- Vendedores veem apenas seus proprios logs
- Admins/gerentes veem tudo
- Templates sao leitura publica (para a edge function)

---

## Parte 2: 8 Templates de Email

Todos com identidade visual Central Gospel (cor dourada #B8860B, logo, rodape padrao).

### 1. `ebd_reposicao_14d` - Alerta de Reposicao (14 dias)
- **Gatilho**: `data_proxima_compra - 14 dias`
- **Variaveis**: `nome`, `nome_igreja`, `data_proxima_compra`, `link_catalogo`, `vendedor_nome`
- **Assunto**: "Suas revistas estao acabando - Hora de repor!"

### 2. `ebd_reposicao_7d` - Alerta de Reposicao (7 dias)
- **Gatilho**: `data_proxima_compra - 7 dias`
- **Variaveis**: mesmas + urgencia
- **Assunto**: "Ultimos dias! Reponha suas revistas EBD"

### 3. `ebd_reposicao_hoje` - Alerta de Reposicao (no dia)
- **Gatilho**: `data_proxima_compra = hoje`
- **Variaveis**: mesmas
- **Assunto**: "Hoje e o dia! Garanta suas revistas EBD"

### 4. `ebd_boas_vindas` - Pos-Compra / Boas-vindas
- **Gatilho**: Apos pedido e-commerce (is_pos_venda_ecommerce = true)
- **Variaveis**: `nome`, `nome_igreja`, `vendedor_nome`, `vendedor_telefone`, `link_painel`
- **Assunto**: "Bem-vindo a Central Gospel! Ative seu painel gratuito"

### 5. `ebd_ativacao_3d` - Lembrete Ativacao (3 dias)
- **Gatilho**: 3 dias apos cadastro, `status_ativacao_ebd = false`
- **Variaveis**: `nome`, `nome_igreja`, `link_painel`, `vendedor_nome`
- **Assunto**: "Voce ainda nao ativou seu Painel EBD!"

### 6. `ebd_ativacao_7d` - Lembrete Ativacao (7 dias)
- Variacao mais urgente do anterior

### 7. `ebd_cliente_inativo` - Re-engajamento (30+ dias sem login)
- **Gatilho**: `ultimo_login < 30 dias atras`
- **Variaveis**: `nome`, `nome_igreja`, `dias_sem_login`, `link_painel`, `vendedor_nome`
- **Assunto**: "Sentimos sua falta na EBD!"

### 8. `ebd_novo_trimestre` - Lancamento Novo Trimestre
- **Gatilho**: Manual/sazonal (Jan, Abr, Jul, Out)
- **Variaveis**: `nome`, `nome_igreja`, `trimestre`, `link_catalogo`, `vendedor_nome`
- **Assunto**: "Novas revistas EBD disponiveis - Trimestre {trimestre}"

---

## Parte 3: Edge Function `send-ebd-email`

Similar a `send-royalties-email`, mas adaptada para clientes EBD:

- Recebe: `clienteId`, `templateCode`, `dados`, `vendedorId`, `tipoEnvio`
- Busca template na tabela `ebd_email_templates`
- Busca dados do cliente em `ebd_clientes`
- Busca dados do vendedor em `vendedores` (para personalizar com nome/telefone)
- Substitui variaveis no HTML
- Envia via Resend (remetente: `relatorios@painel.editoracentralgospel.com.br`)
- Loga em `ebd_email_logs`

---

## Parte 4: Edge Function `ebd-email-cron`

Funcao agendada via pg_cron que roda 1x por dia e dispara automaticamente os emails baseados nos gatilhos:

1. Busca clientes com `data_proxima_compra` em 14, 7 ou 0 dias
2. Busca clientes com `status_ativacao_ebd = false` ha 3 ou 7 dias
3. Busca clientes com `ultimo_login` > 30 dias atras
4. Para cada grupo, verifica se o email ja foi enviado (evita duplicidade via `ebd_email_logs`)
5. Chama `send-ebd-email` para cada cliente elegivel

---

## Parte 5: Interface - Pagina de Gestao de Emails EBD

Nova aba ou pagina na area do vendedor com 3 abas:

### Aba "Disparar Email"
- Selecionar cliente (dropdown dos clientes do vendedor)
- Selecionar template (dropdown)
- Preencher variaveis extras se necessario
- Preview do email
- Botao enviar

### Aba "Historico"
- Tabela com todos os envios do vendedor
- Filtro por template, status, data
- Badge de status (enviado/erro)

### Aba "Emails Automaticos"
- Dashboard mostrando quantos emails automaticos foram disparados hoje/semana/mes
- Lista dos proximos disparos agendados (clientes com data_proxima_compra proxima)

---

## Sequencia de Implementacao

1. Migracoes de banco (tabelas + dados iniciais dos 8 templates + RLS)
2. Edge Function `send-ebd-email`
3. Edge Function `ebd-email-cron`
4. Cron job no pg_cron para rodar `ebd-email-cron` diariamente
5. Pagina de gestao na interface do vendedor
6. Testes end-to-end

