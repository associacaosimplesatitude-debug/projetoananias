
# Plano: Landing Page de Apresentacao Completa do Sistema

## Estrutura Corrigida - 3 Paineis Distintos

---

## SECAO 1: Painel do Superintendente (Gestao EBD)
Rota base: `/ebd/*`

### 1.1 Dashboard EBD
**Funcionalidades:**
- Visao geral de alunos, professores e turmas
- Acompanhamento de frequencia
- Indicadores de participacao
- Cards de resumo da EBD

**Beneficios:**
- Visao completa da Escola Biblica Dominical
- Tomada de decisao baseada em dados
- Acompanhamento em tempo real

### 1.2 Alunos
**Funcionalidades:**
- Cadastro completo de alunos
- Vinculacao a turmas
- Historico de frequencia
- Dados de contato e responsaveis

**Beneficios:**
- Gestao centralizada dos alunos
- Rastreabilidade completa
- Comunicacao facilitada com responsaveis

### 1.3 Professores
**Funcionalidades:**
- Cadastro de professores
- Vinculacao a turmas
- Dados de contato
- Historico de aulas ministradas

**Beneficios:**
- Gestao da equipe docente
- Facilidade na montagem de escalas
- Reconhecimento de dedicacao

### 1.4 Turmas
**Funcionalidades:**
- Criacao de turmas por faixa etaria
- Vinculacao de professores e alunos
- Configuracao de horarios
- Capacidade maxima

**Beneficios:**
- Organizacao pedagogica
- Distribuicao equilibrada de alunos
- Planejamento de recursos

### 1.5 Ativar Revistas
**Funcionalidades:**
- Ativacao de revistas EBD por turma
- Definicao de periodo de uso
- Vinculacao de licoes ao calendario
- Controle de conteudo liberado

**Beneficios:**
- Controle do material didatico
- Sincronizacao com calendario escolar
- Acompanhamento do curriculo

### 1.6 Escala
**Funcionalidades:**
- Escala de professores por domingo
- Calendario visual
- Notificacao de escala
- Substituicoes

**Beneficios:**
- Organizacao antecipada
- Professores sabem quando ministrar
- Evita falta de cobertura

### 1.7 Lancamento Manual
**Funcionalidades:**
- Registro manual de presenca
- Selecao de data e turma
- Marcacao individual de alunos
- Observacoes por aula

**Beneficios:**
- Flexibilidade no registro
- Correcao de lancamentos
- Registro de ausencias justificadas

### 1.8 Frequencia (Relatorios)
**Funcionalidades:**
- Relatorio de frequencia por periodo
- Filtros por turma e aluno
- Graficos de participacao
- Exportacao de dados

**Beneficios:**
- Analise de engajamento
- Identificacao de alunos ausentes
- Base para acoes de reativacao

### 1.9 Quizzes
**Funcionalidades:**
- Criacao de quizzes por licao
- Perguntas de multipla escolha
- Ranking de participantes
- Resultados em tempo real

**Beneficios:**
- Gamificacao do aprendizado
- Avaliacao de conhecimento
- Engajamento dos alunos

### 1.10 Desafio Biblico
**Funcionalidades:**
- Desafios de leitura biblica
- Acompanhamento de progresso
- Medalhas e conquistas
- Ranking entre participantes

**Beneficios:**
- Incentivo a leitura da Biblia
- Competicao saudavel
- Formacao de habito

### 1.11 Catalogo (Loja)
**Funcionalidades:**
- Visualizacao de produtos disponiveis
- Revistas e materiais EBD
- Precos e descricoes
- Adicionar ao carrinho

**Beneficios:**
- Acesso facil ao material
- Compra autonoma
- Catalogo sempre atualizado

### 1.12 Meus Pedidos
**Funcionalidades:**
- Historico de pedidos
- Status de entrega
- Detalhes de cada compra
- Rastreamento

**Beneficios:**
- Acompanhamento de compras
- Transparencia no processo
- Historico para referencia

---

## SECAO 2: Painel do Vendedor
Rota base: `/vendedor/*`

### 2.1 Painel (Dashboard)
**Funcionalidades:**
- Total de clientes na carteira
- Clientes pendentes de ativacao
- Aniversariantes do mes
- Clientes em risco (sem login ha 30+ dias)
- Progresso da meta mensal com barra visual
- Comissao prevista por parcelas
- Segmentacao da carteira (ADVECS, Igreja CNPJ/CPF, etc.)
- Botao "Novo Cliente" rapido

**Beneficios:**
- Visao completa da carteira em uma tela
- Priorizacao de acoes (quem precisa de atencao)
- Acompanhamento de meta em tempo real

### 2.2 Clientes
**Funcionalidades:**
- Lista completa de clientes da carteira
- Busca e filtros avancados
- Card de cliente com todas as informacoes
- Iniciar venda direto do cliente
- Configurar descontos por categoria
- Lancamento manual de revista
- Historico de pedidos do cliente

**Beneficios:**
- Gestao completa da carteira propria
- Acesso rapido a informacoes de contato
- Personalizacao de descontos por cliente

### 2.3 PDV Balcao (Vendedores de Loja)
**Funcionalidades:**
- Busca de cliente por nome, CNPJ ou CPF
- Catalogo de produtos com busca
- Carrinho de compras intuitivo
- Formas de pagamento: PIX, Dinheiro, Cartao
- Aplicacao automatica de descontos
- Finalizacao de venda instantanea

**Beneficios:**
- Vendas presenciais rapidas e eficientes
- Integracao automatica com estoque
- Desconto automatico baseado no perfil

### 2.4 Pos-Venda E-commerce
**Funcionalidades:**
- Lista de pedidos online atribuidos
- Status de ativacao do cliente
- Acesso a detalhes do pedido
- Mensagem de boas-vindas
- Ativacao do cliente no sistema EBD

**Beneficios:**
- Conversao de compradores em clientes recorrentes
- Processo estruturado de onboarding
- Aumento da retencao

### 2.5 Leads Landing Page
**Funcionalidades:**
- Kanban de leads (Contato, Negociacao, Fechou, Cancelado)
- Card de lead com informacoes de contato
- Registro de valor de fechamento
- Motivo de perda/cancelamento

**Beneficios:**
- Gestao visual do funil de vendas
- Acompanhamento de conversao
- Historico de negociacoes

### 2.6 Ativacao Pendente
**Funcionalidades:**
- Lista de clientes aguardando ativacao
- Informacoes de contato (email, telefone)
- Botao de ativar cliente
- Senha temporaria visivel

**Beneficios:**
- Nenhum cliente fica sem acesso
- Processo de ativacao simplificado

### 2.7 Proximas Compras
**Funcionalidades:**
- Clientes com revistas proximas do fim
- Data prevista de proxima compra
- Card com informacoes para contato
- Mensagem de abordagem sugerida

**Beneficios:**
- Vendas proativas
- Previsibilidade de receita
- Aumento de recorrencia

### 2.8 Clientes em Risco
**Funcionalidades:**
- Lista de clientes sem login ha 30+ dias
- Informacoes de ultimo acesso
- Card de contato rapido
- Mensagem de reativacao sugerida

**Beneficios:**
- Prevencao de churn
- Identificacao precoce de insatisfacao

### 2.9 Notas Emitidas
**Funcionalidades:**
- Lista de notas fiscais emitidas
- Numero da NF-e e chave de acesso
- Link para PDF da nota
- Envio via WhatsApp

**Beneficios:**
- Controle de documentacao fiscal
- Facilidade de reenvio para cliente

### 2.10 Pedidos
**Funcionalidades:**
- Aba "Nova Venda" - criar pedido
- Aba "Minhas Propostas" - acompanhar
- Selecao de cliente e produtos
- Aplicacao de descontos
- Geracao de link de proposta
- Status (Pendente, Aceita, Faturado, Pago)

**Beneficios:**
- Fluxo de vendas completo e digital
- Proposta profissional enviada por link
- Acompanhamento em tempo real

### 2.11 Minhas Parcelas
**Funcionalidades:**
- Lista de parcelas a receber (comissoes)
- Filtro por mes e status
- Valor total a receber
- Detalhamento por cliente

**Beneficios:**
- Previsibilidade de ganhos
- Controle financeiro pessoal

### 2.12 Orcamento Transportadora
**Funcionalidades:**
- Selecao de cliente e endereco
- Busca e adicao de produtos
- Calculo automatico de peso e volume
- Selecao de local de coleta
- Conversao em proposta

**Beneficios:**
- Precisao no calculo de frete
- Agilidade na montagem de pedidos

### 2.13 Tutoriais
**Funcionalidades:**
- Videos de treinamento por categoria
- Reproducao direta na plataforma

**Beneficios:**
- Capacitacao continua
- Autonomia para resolver duvidas

---

## SECAO 3: Painel do Gerente EBD (Admin)
Rota base: `/admin/*` e `/admin/ebd`

### 3.1 Dashboard de Vendas
**Funcionalidades:**
- KPIs de vendas em tempo real
- Canais: E-commerce, Igreja CNPJ/CPF, Marketplaces
- Grafico de evolucao de vendas
- Ranking de vendedores com meta
- Filtros por periodo

**Beneficios:**
- Visao 360 graus do negocio
- Acompanhamento de metas em tempo real
- Identificacao de top performers

### 3.2 Propostas Digitais
**Funcionalidades:**
- Central de propostas com status
- Visualizacao detalhada
- Filtros por vendedor e status
- Historico completo

**Beneficios:**
- Rastreabilidade do ciclo de vendas
- Gestao centralizada

### 3.3 Pedidos por Canal
**Funcionalidades:**
- Pedidos Central Gospel (e-commerce)
- Pedidos Igreja CPF e CNPJ
- Pedidos ADVECS e Atacado
- Marketplaces: Amazon, Shopee, Mercado Livre

**Beneficios:**
- Visao segmentada por canal
- Identificacao de canais performaticos

### 3.4 Aprovacao de Faturamento
**Funcionalidades:**
- Lista de pedidos aguardando liberacao
- Analise de credito
- Aprovacao/Rejeicao

**Beneficios:**
- Controle financeiro rigoroso
- Reducao de inadimplencia

### 3.5 Gestao de Comissoes
**Funcionalidades:**
- Comissoes de vendedores e gerentes
- Royalties de autores
- Filtros por status e vendedor
- Detalhamento por operacao

**Beneficios:**
- Controle financeiro preciso
- Transparencia no pagamento
- Gestao hierarquica

### 3.6 Atribuicao de Clientes
**Funcionalidades:**
- Pedidos sem vendedor atribuido
- Atribuicao automatica por email
- Filtros e busca

**Beneficios:**
- Nenhum cliente sem atendimento
- Distribuicao inteligente

### 3.7 Gestao de Clientes EBD
**Funcionalidades:**
- Lista completa de clientes
- Filtros por vendedor, estado, status
- Edicao e transferencia
- Visualizacao de progresso de revistas

**Beneficios:**
- Gestao centralizada da base
- Identificacao de oportunidades

### 3.8 Leads de Reativacao
**Funcionalidades:**
- Importacao via planilha
- Score de leads (Quente, Morno, Frio)
- Status e atribuicao a vendedores
- Leads de Landing Page

**Beneficios:**
- Recuperacao de clientes inativos
- Priorizacao inteligente

### 3.9 Gestao de Vendedores
**Funcionalidades:**
- Cadastro de vendedores e representantes
- Tipo de perfil e comissao
- Meta mensal e gerente responsavel
- Flag "Trabalha na Loja Penha"
- Foto e visualizar como vendedor

**Beneficios:**
- Gestao completa da equipe
- Flexibilidade de perfis
- Hierarquia de comissoes

### 3.10 Transferencias
**Funcionalidades:**
- Solicitacoes de transferencia
- Aprovacao/Rejeicao
- Historico completo

**Beneficios:**
- Processo organizado
- Auditoria de movimentacoes

### 3.11 Catalogo EBD (Admin)
**Funcionalidades:**
- Gestao de revistas e licoes
- Quizzes e conteudo biblico
- Integracao Shopify

**Beneficios:**
- Gestao completa do portfolio
- Sincronizacao automatica

### 3.12 Gestao de Tutoriais
**Funcionalidades:**
- Upload de videos
- Organizacao por categoria
- Acesso para vendedores e clientes

**Beneficios:**
- Treinamento escalavel
- Suporte em video

---

## Arquivos a Criar

### 1. Nova pagina de apresentacao
`src/pages/Apresentacao.tsx`
- Landing page com 3 secoes
- Navegacao por tabs
- Cards de funcionalidades com icones
- Placeholders para screenshots
- Design profissional

### 2. Rota
Adicionar em `src/App.tsx`:
```typescript
<Route path="/apresentacao" element={<Apresentacao />} />
```

---

## Estrutura Visual

### Navegacao
- Tabs para alternar entre os 3 paineis
- Scroll suave entre secoes

### Cards de Funcionalidade
- Icone representativo
- Titulo da funcionalidade
- Lista de recursos
- Beneficios destacados em badges
- Placeholder para screenshot (800x450px)

### Placeholders
- Componente visual indicando qual tela capturar
- Texto: "Inserir print: [Nome da Tela]"
- Dimensoes 16:9 para consistencia

---

## Resultado Esperado

Uma pagina completa documentando:
- **12 funcionalidades** do Painel do Superintendente
- **13 funcionalidades** do Painel do Vendedor  
- **12 funcionalidades** do Painel do Gerente EBD

Total: **37 funcionalidades** documentadas com beneficios claros e espacos para screenshots.
