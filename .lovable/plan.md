

## Plano: PDF Upload, Quiz com IA, Leitura Contínua e Modo Rolagem

### 1. Upload de PDF completo no Admin (RevistasDigitais.tsx)

Na gestão de lições, adicionar um segundo botão "Subir PDF completo" ao lado do upload de imagens. Ao enviar um PDF:
- Usar `pdfjs-dist` (já instalado) para renderizar cada página do PDF como imagem PNG no canvas
- Upload de cada imagem gerada para o storage (`revistas/{revistaId}/licao-{n}/`)
- Salvar as URLs nas `paginas` da lição (mesmo fluxo atual)
- Manter o upload manual de imagens como está

### 2. Quiz gerado por IA ao final de cada lição

**Banco de dados — 2 novas tabelas:**

| Tabela | Campos principais |
|--------|-------------------|
| `revista_licao_quiz` | `id`, `licao_id` (FK revista_licoes), `perguntas` (JSONB — array de 5 objetos com pergunta, 3 opções, resposta correta), `created_at` |
| `revista_licao_quiz_respostas` | `id`, `quiz_id` (FK), `user_id`, `respostas` (JSONB), `acertos` (int), `pontos_ganhos` (int), `created_at`, `UNIQUE(quiz_id, user_id)` |

RLS: authenticated lê quiz; insere/lê próprias respostas. Admin gerencia tudo.

**Geração automática com IA:**
- No admin, ao lado de cada lição com páginas, botão "Gerar Quiz com IA"
- Chama edge function `gerar-quiz-revista` que:
  - Recebe `licao_id`, busca as URLs das páginas
  - Envia as imagens para o modelo Gemini 2.5 Flash (suportado pelo Lovable AI, sem API key)
  - Prompt: "Analise estas páginas de uma lição bíblica e crie 5 perguntas de múltipla escolha com 3 alternativas cada. Retorne JSON."
  - Salva o resultado em `revista_licao_quiz`

**No leitor (RevistaLeitor.tsx):**
- Ao concluir a lição (modal de conclusão), se existir quiz cadastrado, mostrar botão "Responder Quiz"
- Tela de quiz inline: 5 perguntas, radio com 3 opções, botão "Enviar"
- Após enviar: mostra resultado (X de 5, +Y pontos), botão "Ver erros"
- Cada acerto = 10 pontos (atualiza `ebd_alunos.pontos_totais`)
- UNIQUE constraint impede refazer; se já respondeu, mostra resultado anterior

### 3. Leitura Contínua + Toggle Setas/Rolagem

**AlunoRevistaVirtual.tsx:**
- Botão "Leitura Contínua" que navega para `/ebd/revista/{id}/leitura-continua`
- Nova rota e componente `RevistaLeituraContinua.tsx`: carrega todas as lições e renderiza todas as páginas em scroll vertical contínuo com separadores por lição

**RevistaLeitor.tsx:**
- Toggle no header: ícone Setas vs ícone Rolagem
- Modo Setas: comportamento atual (uma página por vez)
- Modo Rolagem: todas as páginas da lição em coluna vertical com scroll, watermark em cada página

### Arquivos alterados/criados

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Criar `revista_licao_quiz` e `revista_licao_quiz_respostas` com RLS |
| `supabase/functions/gerar-quiz-revista/` | Edge function que usa Gemini para gerar quiz a partir das imagens |
| `RevistasDigitais.tsx` | Botão upload PDF + botão "Gerar Quiz" por lição |
| `RevistaLeitor.tsx` | Toggle setas/rolagem, botão quiz no modal conclusão, componente quiz inline |
| `RevistaLeituraContinua.tsx` (novo) | Leitura contínua de todas as lições |
| `AlunoRevistaVirtual.tsx` | Botão "Leitura Contínua" |
| `App.tsx` | Nova rota para leitura contínua |

