

# Plano: Exibir Numero da Aula nos Cards de Quiz

## Correção de Dados

O quiz "Análise Crítica e Política do Fim de Judá" está vinculado à **Aula 3** na escala. Será atualizado para apontar para a **Aula 4**, conforme solicitado.

| Quiz | Aula Atual | Aula Corrigida |
|------|-----------|----------------|
| Análise Crítica e Política do Fim de Judá | Aula 3 | Aula 4 |
| O Fim de Judá e a Habilidade Política | Aula 4 | Aula 4 (sem mudança) |

## Alterações no Código

### Arquivo: `src/components/ebd/aluno/AlunoDashboard.tsx`

**1. Query (linha 166)** - Adicionar `escala_id` e join com `ebd_escalas`:

```tsx
.select("id, titulo, pontos_max, data_limite, hora_liberacao, contexto, nivel, escala_id, ebd_escalas(observacao)")
```

**2. Mapeamento (linha 188)** - Extrair numero da aula:

```tsx
return pendentes.map((q) => {
  const obs = (q as any).ebd_escalas?.observacao || "";
  const matchAula = obs.match(/Aula (\d+)/i);
  const numeroAula = matchAula ? parseInt(matchAula[1]) : null;
  return {
    ...q,
    hora_liberacao: q.hora_liberacao || "09:00:00",
    contexto: q.contexto || null,
    nivel: q.nivel || null,
    numeroAula,
  };
});
```

**3. Card (linha 489)** - Mostrar o numero:

```tsx
// De:
Quiz da Aula

// Para:
Quiz da Aula {quiz.numeroAula ? quiz.numeroAula : ""}
```

### Banco de Dados

Atualizar o `escala_id` do quiz "Análise Crítica..." para apontar para a escala da Aula 4, fazendo com que ambos exibam "Quiz da Aula 4".

## Resultado

- Quiz da Aula **4** - Análise Crítica e Política do Fim de Judá
- Quiz da Aula **4** - O Fim de Judá e a Habilidade Política
- Quiz da Aula **5** - O Clamor de um Povo Exilado
- Quiz da Aula **6** - Isaías -- Consolo e Restauração no Exílio

