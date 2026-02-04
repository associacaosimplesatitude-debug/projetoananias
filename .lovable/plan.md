
# Plano: Sistema Completo de Emails Transacionais para Royalties

## Visão Geral

Implementar um sistema de emails transacionais personalizado para autores, com templates editáveis no painel administrativo, usando o **Resend** (plano gratuito - 3.000 emails/mes).

## O que sera criado

| Item | Descricao |
|------|-----------|
| 2 tabelas no banco | Templates e logs de envio |
| 1 edge function | `send-royalties-email` |
| 1 nova pagina | `/royalties/emails` |
| 4 componentes | Editor, preview, envio manual, historico |
| 6 templates padrao | Acesso, venda, pagamento, relatorio, afiliado venda, afiliado link |

## Templates de Email

| Codigo | Nome | Gatilho | Variaveis |
|--------|------|---------|-----------|
| `autor_acesso` | Dados de Acesso | Manual | `{nome}`, `{email}`, `{senha_temporaria}`, `{link_login}` |
| `royalty_venda` | Aviso de Venda | Automatico | `{nome}`, `{livro}`, `{quantidade}`, `{valor_venda}`, `{valor_royalty}`, `{data}` |
| `pagamento_realizado` | Pagamento Confirmado | Automatico | `{nome}`, `{valor}`, `{data}`, `{comprovante_url}` |
| `relatorio_mensal` | Relatorio Mensal | Manual | `{nome}`, `{mes}`, `{total_vendas}`, `{total_royalties}`, `{resumo_livros}` |
| `afiliado_venda` | Venda via Afiliado | Automatico | `{nome}`, `{livro}`, `{comprador}`, `{valor_venda}`, `{valor_comissao}` |
| `afiliado_link` | Link de Afiliado | Manual | `{nome}`, `{livro}`, `{link_afiliado}`, `{codigo}` |

## Interface do Admin

A pagina `/royalties/emails` tera:

- **Lista de templates** com status ativo/inativo
- **Editor visual** com campos de assunto e corpo HTML
- **Preview** com dados de exemplo antes de enviar
- **Envio manual** selecionando autor e template
- **Historico** de todos os emails enviados

---

## Secao Tecnica

### 1. Criar Tabelas no Banco

**Tabela `royalties_email_templates`:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | Chave primaria |
| codigo | TEXT | Identificador unico (ex: `royalty_venda`) |
| nome | TEXT | Nome exibido no admin |
| descricao | TEXT | Descricao do template |
| assunto | TEXT | Assunto do email (com variaveis) |
| corpo_html | TEXT | Corpo HTML editavel |
| variaveis | JSONB | Lista de variaveis disponiveis |
| is_active | BOOLEAN | Ativo/inativo |
| created_at | TIMESTAMPTZ | Data de criacao |
| updated_at | TIMESTAMPTZ | Data de atualizacao |

**Tabela `royalties_email_logs`:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | Chave primaria |
| template_id | UUID | FK para template |
| autor_id | UUID | FK para autor |
| destinatario | TEXT | Email do destinatario |
| assunto | TEXT | Assunto enviado |
| status | TEXT | enviado, erro, entregue |
| erro | TEXT | Mensagem de erro (se houver) |
| dados_enviados | JSONB | Dados usados na personalizacao |
| created_at | TIMESTAMPTZ | Data de envio |

**RLS Policies:**
- Apenas admins podem gerenciar templates
- Apenas admins podem ver logs

### 2. Edge Function `send-royalties-email`

```text
Fluxo da funcao:
1. Recebe: autorId, templateCode, dados
2. Busca template ativo do banco
3. Busca dados do autor (nome, email)
4. Substitui variaveis {nome}, {livro}, etc.
5. Envia via Resend
6. Registra log no banco
7. Retorna sucesso ou erro
```

**Arquivo:** `supabase/functions/send-royalties-email/index.ts`

### 3. Novos Arquivos Frontend

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/royalties/Emails.tsx` | Pagina principal com abas |
| `src/components/royalties/EmailTemplateDialog.tsx` | Modal de edicao de template |
| `src/components/royalties/EmailPreviewModal.tsx` | Preview do email |
| `src/components/royalties/SendEmailDialog.tsx` | Modal de envio manual |
| `src/components/royalties/EmailLogsTable.tsx` | Tabela de historico |

### 4. Modificacoes em Arquivos Existentes

**`src/components/royalties/RoyaltiesAdminLayout.tsx`:**
- Adicionar item de menu "Emails" com icone `Mail`

**`src/App.tsx`:**
- Adicionar rota `/royalties/emails`
- Import do componente `RoyaltiesEmails`

### 5. Estrutura da Pagina de Emails

```text
/royalties/emails
|
+-- Tabs
|   |-- Templates (lista editavel)
|   |-- Enviar Email (envio manual)
|   +-- Historico (logs de envio)
|
+-- Templates Tab
|   |-- Tabela com codigo, nome, status
|   |-- Botao editar -> abre modal
|   |-- Modal com:
|       |-- Campo assunto
|       |-- Editor corpo HTML (textarea)
|       |-- Lista de variaveis disponiveis
|       +-- Botao preview
|
+-- Enviar Tab
|   |-- Selecionar autor
|   |-- Selecionar template
|   |-- Preencher variaveis
|   +-- Botao enviar
|
+-- Historico Tab
    |-- Tabela com data, autor, template, status
    +-- Filtros por data e status
```

### 6. Exemplo de Template HTML Padrao

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: linear-gradient(135deg, #1a2d40, #2d4a5e); 
              padding: 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; }
    .content { padding: 30px; }
    .footer { background: #1a2d40; color: #fff; padding: 20px; 
              text-align: center; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Projeto Ananias</h1>
    </div>
    <div class="content">
      <h2>Ola, {nome}!</h2>
      <p>Voce vendeu {quantidade} unidade(s) de <strong>{livro}</strong>.</p>
      <p><strong>Valor da venda:</strong> {valor_venda}</p>
      <p><strong>Seu royalty:</strong> {valor_royalty}</p>
      <p>Data: {data}</p>
    </div>
    <div class="footer">
      <p>Projeto Ananias - Sistema de Royalties</p>
    </div>
  </div>
</body>
</html>
```

## Resultado Esperado

Apos a implementacao:

- 6 templates de email prontos e editaveis
- Personalizacao automatica com dados do autor e livro
- Historico completo de todos os emails enviados
- Envio manual de qualquer template para qualquer autor
- Custo ZERO no plano gratuito do Resend (ate 3.000 emails/mes)
- Interface intuitiva no painel de royalties
