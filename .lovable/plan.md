

# Corrigir Parser de Quiz para Aceitar Formato Markdown

## Problema
O `quizParser.ts` não reconhece o formato do texto colado pelo usuário. O texto usa formatação Markdown:

- Opções: `* **A)** Texto da opção` (com bullet e bold)
- Resposta: `**Resposta Certa: A** | *Racional:* ...`
- Título: `### **Questionário: ...**`
- Nível: `**Nível:** Médio | **Contexto:** Escola da Palavra`

O parser atual espera:
- Opções: `A) Texto da opção`
- Resposta: `Resposta Certa: A`
- Título: `Questionário: ...`

Resultado: apenas algumas perguntas são detectadas (as que por acaso ficam no formato certo após o pré-processamento), e as opções ficam vazias → erro de validação.

## Solução

### Arquivo: `src/lib/quizParser.ts`

1. **Função `preprocessText`**: Adicionar limpeza de markdown antes do processamento:
   - Remover `###`, `**`, `*` (bold/italic/headers)
   - Normalizar bullets `* **A)**` → `A)`
   - Remover `| *Racional:* ...` após a resposta certa (é conteúdo informativo, não faz parte do quiz)

2. **Regex de detecção de opções** (linhas 120-123): Tornar mais flexíveis para capturar variações:
   - `**A)**` → `A)`
   - `* A)` → `A)`

3. **Regex de título** (linha 56): Aceitar markdown no início (`### **Questionário:`)

4. **Regex de nível/contexto** (linhas 69-78): Aceitar `**Nível:**` com asteriscos

### Detalhes técnicos

A limpeza de markdown na função `preprocessText` resolverá a maioria dos casos. Adicionar no início:

```text
// Remover racional/explicação após resposta certa
processed = processed.replace(/\|\s*\*?Racional:?\*?\s*.*/gi, '');

// Remover markdown: ###, **, *
processed = processed.replace(/#{1,6}\s*/g, '');        // headers
processed = processed.replace(/\*\*([^*]+)\*\*/g, '$1'); // bold
processed = processed.replace(/\*([^*]+)\*/g, '$1');     // italic

// Normalizar bullets com opções: "* A)" → "A)"
processed = processed.replace(/^\*\s+([ABCD]\))/gm, '$1');
```

Isso garante que qualquer texto colado com markdown (do ChatGPT, Google Docs, etc.) será limpo antes do parsing.

## Resumo
- 1 arquivo alterado: `src/lib/quizParser.ts`
- Adição de limpeza de markdown na função `preprocessText`
- Sem alteração na lógica de parsing, apenas normalização do input

