
# Plano: Ajustar Parser para Aceitar Formato em Linha Única

## Problema Identificado
O texto colado tem todo o conteúdo de cada pergunta em uma **única linha**, mas o parser atual (`quizParser.ts`) espera quebras de linha entre:
- Texto da pergunta
- Cada opção (A, B, C, D)
- Resposta correta

Exemplo do formato atual (que não funciona):
```
1. Pergunta aqui? A) Opção A B) Opção B C) Opção C Resposta Certa: B
```

## Solução
Atualizar o parser para detectar e extrair corretamente quando tudo está em uma única linha, usando **regex mais robusto** que encontra as opções A), B), C) e "Resposta Certa:" mesmo sem quebras de linha.

---

## Implementação

### Arquivo: `src/lib/quizParser.ts`

1. **Pré-processar o texto** para adicionar quebras de linha antes dos padrões conhecidos:
   - Antes de `A)`, `B)`, `C)`, `D)`
   - Antes de `Resposta Certa:`
   - Antes de números seguidos de ponto (`1.`, `2.`, etc.)

2. **Ajustar extração do título** para funcionar quando está junto com "Nível:" na mesma linha

3. **Manter compatibilidade** com o formato original (com quebras de linha)

### Mudanças específicas:

```text
Função parseQuizText:
1. Adicionar pré-processamento no início:
   - Substituir padrões inline por versões com quebra de linha
   - Ex: " A)" → "\nA)"
   - Ex: " Resposta Certa:" → "\nResposta Certa:"
   - Ex: " 1." → "\n1." (números de pergunta)

2. Ajustar regex do título para capturar texto até "Nível:" ou fim da linha
```

---

## Resultado Esperado
Após a correção, ao colar o texto no formato atual, o parser irá:
- Detectar o título: "Isaías — Consolo e Restauração no Exílio"
- Detectar nível: "Médio"
- Detectar contexto: "Escola da Palavra"
- Extrair as 10 perguntas com suas opções e respostas corretas
- Mostrar "10 perguntas detectadas" no preview com validação OK
