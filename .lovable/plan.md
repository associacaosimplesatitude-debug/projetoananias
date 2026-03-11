

## Plano: Remover botão "Gerar Quiz IA" e inserir quiz manual nas 13 lições

### Mudanças

**1. Remover botão "Gerar Quiz IA" das lições (`RevistasDigitais.tsx`)**
- Remover o botão e o estado `generatingQuiz` / função `handleGenerateQuiz` da tela de gestão de lições

**2. Inserir quiz nas 13 lições via banco de dados**
- Inserir 13 registros na tabela `revista_licao_quiz` com as 5 perguntas de cada lição (formato JSON `perguntas`)
- Cada pergunta segue o formato: `{ ordem, pergunta, opcao_a, opcao_b, opcao_c, resposta_correta }`
- Mapeamento lição → licao_id:
  - Lição 1 → `c654e6ec-...`
  - Lição 2 → `b5116f22-...`
  - ... até Lição 13 → `2c961b78-...`

### Resultado
- O botão "Gerar Quiz IA" some do admin
- Todas as 13 lições terão quiz disponível para os alunos responderem

