
# Agente BI para Apresentação do Sistema EBD

## Objetivo
Criar um assistente de IA que responda perguntas sobre o Sistema EBD, ajudando visitantes a entender as funcionalidades e benefícios do sistema.

## Arquitetura

### 1. Nova Edge Function: `apresentacao-ai-assistant`
Uma edge function dedicada para o agente da apresentação que:
- Usa a API OpenAI diretamente (mesma configuração existente)
- Modelo: `gpt-4o-mini` (igual ao assistente de gestão)
- Tem um system prompt com todo o conhecimento das funcionalidades
- Responde perguntas sobre o sistema de forma comercial e informativa
- Streaming habilitado para respostas em tempo real

### 2. Novo Componente: `ApresentacaoAIChat`
Componente de chat flutuante para a página de apresentação:
- Botão destacado com cor chamativa (gradiente verde/azul vibrante)
- Texto "Faça uma pergunta"
- Interface similar ao AIAssistantChat existente
- Streaming de respostas token-by-token

## Implementação Detalhada

### Edge Function

**Arquivo:** `supabase/functions/apresentacao-ai-assistant/index.ts`

**Configuração:**
- Endpoint: `/functions/v1/apresentacao-ai-assistant`
- API: OpenAI (`https://api.openai.com/v1/chat/completions`)
- Modelo: `gpt-4o-mini`
- Secret: `OPENAI_API_KEY` (já configurada)
- Streaming: Sim
- JWT: false (página pública)

**System Prompt incluirá:**
- Todas as 37 funcionalidades organizadas por painel
- Benefícios-chave de cada funcionalidade
- Informações sobre os 3 perfis de usuário (Superintendente, Vendedor, Admin)
- Linguagem comercial e persuasiva
- Instruções para responder de forma clara e objetiva

### Componente React

**Arquivo:** `src/components/apresentacao/ApresentacaoAIChat.tsx`

**Características visuais:**
- Botão flutuante no canto inferior direito
- Cor de destaque: gradiente verde/azul
- Classe: `bg-gradient-to-r from-emerald-500 to-cyan-500`
- Ícone de MessageCircle + texto "Faça uma pergunta"
- Header do chat com tema comercial
- Mensagem inicial convidativa

**Funcionalidades:**
- State management com useState
- useRef para scroll automático
- Streaming com fetch + ReadableStream
- Parsing SSE linha-por-linha
- Minimizar/Maximizar chat

### Integração na Página

**Arquivo:** `src/pages/Apresentacao.tsx`

- Importar e adicionar `ApresentacaoAIChat`
- Posição fixa no canto inferior direito
- Visível em todas as abas

## System Prompt do Agente

```text
Você é o Assistente Virtual do Sistema EBD da Editora Central Gospel.

Seu objetivo é ajudar visitantes a entender as funcionalidades e benefícios do sistema.

## Funcionalidades do Sistema

### Painel do Superintendente (13 funcionalidades)
1. Dashboard EBD - Visão geral com estatísticas de alunos, professores e turmas
2. Gestão de Alunos - Cadastro completo com foto, histórico e rastreamento
3. Gestão de Professores - Controle de professores com especialidades
4. Gestão de Turmas - Organização por faixa etária e série
5. Escala de Professores - Planejamento de escalas com substituições
6. Frequência de Alunos - Controle de presença com relatórios
7. Quizzes Interativos - Avaliações gamificadas para engajamento
8. Atividades e Eventos - Calendário de programação da EBD
9. Devocional Diário - Compartilhamento de meditações
10. Versículo do Dia - Exibição automática de versículos
11. Catálogo EBD - Acesso a materiais didáticos oficiais
12. Placar de Pontos - Sistema de gamificação para alunos
13. Tutoriais - Vídeos explicativos do sistema

### Painel do Vendedor (12 funcionalidades)
1. Dashboard - Visão de metas e comissões
2. Meus Clientes - CRM completo com histórico
3. Nova Proposta B2B - Criação de pedidos faturados
4. Catálogo de Produtos - Navegação com preços e estoque
5. Venda PDV - Ponto de venda para loja física
6. Venda Link - Pagamento via link digital
7. Minhas Vendas - Histórico completo de transações
8. Comissões - Acompanhamento de ganhos
9. Ranking de Vendas - Competição saudável entre vendedores
10. Relatórios - Análises detalhadas de performance
11. Transferência de Clientes - Gestão de carteira
12. Tutoriais - Treinamento em vídeo

### Painel Administrativo (12 funcionalidades)
1. Dashboard - Visão gerencial completa
2. Gestão de Vendedores - Cadastro e hierarquia
3. Todas as Propostas - Visão de todos os pedidos
4. Todas as Comissões - Controle financeiro
5. Consultor BI - Inteligência artificial para análises
6. Gestão de Clientes EBD - Base de igrejas cadastradas
7. Gestão de Polos - Unidades de venda
8. Solicitações de Transferência - Workflow de aprovação
9. Catálogo EBD - Gerenciamento de produtos
10. Gestão de Tutoriais - Administração de conteúdo
11. Relatórios Gerenciais - Análises consolidadas
12. Configurações do Sistema - Parametrização

## Regras de Resposta
1. Seja sempre cordial e profissional
2. Destaque os benefícios práticos de cada funcionalidade
3. Use formatação markdown para respostas organizadas
4. Sugira funcionalidades relacionadas quando apropriado
5. Mantenha respostas objetivas (máximo 150 palavras)
6. Quando não souber algo, oriente a entrar em contato
```

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/apresentacao-ai-assistant/index.ts` | Criar | Edge function com OpenAI |
| `supabase/config.toml` | Modificar | Adicionar configuração da nova função |
| `src/components/apresentacao/ApresentacaoAIChat.tsx` | Criar | Componente de chat |
| `src/pages/Apresentacao.tsx` | Modificar | Adicionar componente de chat |

## Fluxo de Funcionamento

1. Usuário clica em "Faça uma pergunta"
2. Chat abre com mensagem de boas-vindas
3. Usuário digita pergunta sobre o sistema
4. Pergunta é enviada para edge function
5. Edge function processa com OpenAI (gpt-4o-mini)
6. Resposta é streamed para o chat
7. Usuário visualiza resposta formatada
