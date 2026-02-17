
# Aprimorar o Agente IA do WhatsApp

## Problema 1: API Key
A `OPENAI_API_KEY` ja esta configurada e funcionando nos secrets do projeto. O teste anterior comprovou que a IA respondeu corretamente. Nenhuma acao necessaria aqui.

## Problema 2: Fluxo correto das mensagens
O fluxo ja esta correto na arquitetura:
- **Mensagem 1** (resumo do pedido) e enviada automaticamente pelo `ebd-shopify-order-webhook` quando o pedido entra no Shopify
- **Agente IA** so responde quando o cliente **escreve de volta** no WhatsApp

O teste anterior pareceu estranho porque foi simulado manualmente com a frase "quero acessar". No uso real, o cliente recebe primeiro o resumo do pedido e so depois responde.

**Nenhuma mudanca de fluxo necessaria** -- apenas melhorar o link/URL de acesso na resposta de credenciais para apontar para `gestaoebd.com.br` em vez de `gestaoebd.lovable.app`.

## Problema 3: Conhecimento detalhado do sistema
O system prompt atual e muito superficial. Precisa incluir instrucoes detalhadas sobre:

### Alteracao: Expandir o SYSTEM_PROMPT no `whatsapp-webhook/index.ts`

Adicionar conhecimento completo sobre o **Painel do Superintendente**:

**Funcionalidades que o agente precisa saber explicar:**
1. **Dashboard EBD** - Visao geral com total de alunos, professores, turmas, frequencia media, grafico de evolucao semanal, ranking de alunos, aniversariantes do mes, saldo de creditos
2. **Gestao de Alunos** - Cadastro completo com foto, telefone, data de nascimento, turma vinculada, historico de presenca, link de cadastro publico para o aluno se cadastrar sozinho
3. **Gestao de Professores** - Cadastro com especialidade por faixa etaria, vinculacao a turmas, controle de disponibilidade
4. **Gestao de Turmas** - Criar turmas por faixa etaria (Adultos, Jovens, Adolescentes, Juniores, Jardim, Maternal), vincular professor titular e auxiliar, definir sala
5. **Ativar Revistas** - Selecionar a turma, escolher a revista comprada no catalogo, ativar para liberar o conteudo das aulas
6. **Montar Escala** - Calendario mensal, atribuir professor por domingo, definir numero da aula, permitir substituicoes, visualizar escala geral de todas as turmas
7. **Lancamento de Presenca** - Selecionar turma e data, marcar presentes/ausentes, adicionar observacoes por aluno, registrar visitantes
8. **Relatorios de Frequencia** - Filtros por periodo e turma, graficos de barras e pizza, percentual de frequencia por aluno, exportar para PDF
9. **Quizzes Interativos** - Criar quizzes com perguntas e alternativas, alunos respondem pelo app, ranking de pontuacao, gamificacao com estrelas
10. **Desafio Biblico** - Programa de leitura da Biblia com metas diarias, alunos registram leituras, medalhas por conquistas, ranking geral entre alunos
11. **Devocionais** - Conteudo devocional diario gerado para os alunos, com versiculo e reflexao
12. **Catalogo EBD** - Visualizar todas as revistas disponiveis para compra, adicionar ao carrinho, finalizar pedido
13. **Planejamento Escolar** - Definir periodo letivo, dia da semana da EBD, vincular revista ao planejamento da turma
14. **Onboarding Guiado** - Passo a passo para configurar a EBD: criar turmas > cadastrar professores > cadastrar alunos > montar escala > ativar revista

### Instrucoes adicionais no prompt:
- Quando o cliente perguntar "como cadastro uma turma", explicar o passo a passo
- Quando perguntar sobre escala, explicar como funciona o calendario e a atribuicao
- Quando perguntar sobre frequencia, explicar o lancamento e os relatorios
- O link de acesso deve ser `https://gestaoebd.com.br/login/ebd`
- A senha padrao e `mudar123` (buscar do campo `senha_temporaria` do banco)

### Correcao do link na resposta de credenciais:
Trocar `gestaoebd.lovable.app` por `gestaoebd.com.br` na funcao `handleEnviarCredenciais`.

## Secao Tecnica

### Arquivo alterado: `supabase/functions/whatsapp-webhook/index.ts`

**Mudanca 1**: Expandir o `SYSTEM_PROMPT` (linhas 9-41) com conhecimento detalhado das 14 funcionalidades do painel do superintendente, incluindo passo-a-passo de cada uma.

**Mudanca 2**: Na funcao `handleEnviarCredenciais` (linha 390), trocar:
```
gestaoebd.lovable.app → gestaoebd.com.br
```

**Mudanca 3**: Adicionar ao system prompt instrucoes sobre o fluxo correto:
- O cliente ja recebeu a Mensagem 1 com resumo do pedido
- Se ele responde "sim", "quero", "ok" → enviar credenciais
- Se ele pergunta algo sobre o sistema → responder com conhecimento detalhado
- Se ele responde depois de dias (lembrete de login) → ser amigavel e oferecer ajuda
