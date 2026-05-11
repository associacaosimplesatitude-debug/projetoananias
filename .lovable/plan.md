
## Diagnóstico

O agente continua respondendo com os dados antigos (Pr. Antonio / Igreja Batista Nova Vida / Pires de Castro / 86 9414-7951) **mesmo após o banco já estar 100% atualizado**. A causa é histórica, não de dados.

Encontrei duas fontes de "memória contaminada" na conversa `41656f43-adfb-4ce6-838a-7f5c2b13b2a7` (telefone 5511947141878):

1. **Snapshot congelado em `agente_ia_mensagens`** — quando a conversa começou em 08/05, foi gravada uma mensagem `role=system` com:
   ```
   [CONTEXTO AUTOMÁTICO] {"nome_igreja":"Igreja Batista Nova Vida","nome_superintendente":"Pr. Antonio",...}
   ```
   Esse JSON foi salvo no banco e nunca mais é refeito.

2. **Respostas anteriores do próprio agente** (role=assistant) também estão no histórico repetindo "Pr. Antonio / Pires de Castro / 86 9414...". Como o agente recarrega TODA a conversa a cada nova mensagem, o Claude vê que ele mesmo já afirmou esses dados várias vezes e simplesmente repete.

No código `supabase/functions/agente-loja-cg/index.ts` (linhas 110–207), o contexto rico só é montado **na primeira mensagem** (`if (!conversa.cliente_id)`). Nas mensagens seguintes só vai um contexto mínimo, então a "verdade" pro modelo passa a ser o que está no histórico antigo.

## Plano de correção

### Parte 1 — Limpeza pontual desta conversa (dados)

- Sobrescrever a mensagem `system` `[CONTEXTO AUTOMÁTICO]` da conversa com o snapshot atualizado (Cleuton Soares / Assembleia Teste Sistema / Rua dos Coqueiros 1291 / Santo André-SP / 09080-010).
- Inserir uma nova mensagem `role=system` no final do histórico do tipo `[CORREÇÃO DE CADASTRO]` instruindo o agente a **ignorar quaisquer dados anteriores** e usar apenas os atuais.

Isso resolve imediatamente esta conversa específica.

### Parte 2 — Correção estrutural no edge function `agente-loja-cg`

Alterar `supabase/functions/agente-loja-cg/index.ts` para que **toda mensagem** (não só a primeira) recarregue o contexto fresco do banco:

- Mover o bloco `contexto_inicial_cliente` para fora do `if (!conversa.cliente_id)`.
- Quando já existe `cliente_id`, buscar dados completos atualizados de `ebd_clientes` + `ebd_leads_reativacao` (nome, igreja, email, telefone, endereço completo, CEP) e injetar como **última** mensagem `system` do prompt (após o histórico), com header tipo `DADOS ATUAIS DO CLIENTE (fonte da verdade — sobrepõe qualquer informação anterior do histórico)`.
- **Não** persistir mais snapshots `[CONTEXTO AUTOMÁTICO]` no banco — apenas montar em memória a cada turno. Os snapshots já existentes ficam, mas a mensagem viva no fim do prompt tem prioridade explícita.
- Atualizar o `SYSTEM_PROMPT` (em `skill.ts`) com regra: "Se houver conflito entre o que você disse antes na conversa e o bloco DADOS ATUAIS DO CLIENTE, os DADOS ATUAIS são a verdade absoluta — nunca repita dados antigos."

### Parte 3 — Tool de auto-correção (opcional, recomendada)

Adicionar uma tool `recarregar_dados_cliente` em `tools.ts` que faz `SELECT` fresco e retorna o cadastro atual. Útil quando o cliente diz "esses dados estão errados" — o agente chama a tool e responde com a fonte da verdade.

## Detalhes técnicos

Arquivos a alterar:
- `supabase/functions/agente-loja-cg/index.ts` — refazer build do `contextoCliente` em todo turno; remover insert do snapshot; adicionar bloco "DADOS ATUAIS" no fim do array de mensagens enviado pro Claude.
- `supabase/functions/agente-loja-cg/skill.ts` — adicionar regra de prioridade ao SYSTEM_PROMPT.
- `supabase/functions/agente-loja-cg/tools.ts` — (opcional) nova tool `recarregar_dados_cliente`.

Operações de dados (via insert tool):
- UPDATE da mensagem `d4835586-98f5-4b34-8d00-0544c63ea96b` em `agente_ia_mensagens` com JSON atualizado.
- INSERT de uma mensagem `system` `[CORREÇÃO DE CADASTRO]` na conversa `41656f43-adfb-4ce6-838a-7f5c2b13b2a7`.

## Resultado esperado

- A próxima mensagem que você mandar no WhatsApp vai ser respondida com **Cleuton Soares / Assembleia Teste Sistema / Rua dos Coqueiros 1291 / Santo André-SP / 09080-010**.
- Daqui pra frente, qualquer atualização de cadastro feita no banco será refletida automaticamente na próxima resposta do agente, sem precisar limpar histórico nem recriar conversa.
