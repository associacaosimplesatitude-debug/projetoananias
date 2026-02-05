
# Plano: Corrigir Erro ao Criar Quiz

## Problema Identificado
O componente `CriarQuizAulaDialog.tsx` está tentando inserir dados em colunas que **não existem** na tabela `ebd_quizzes`:
- `escala_id`
- `contexto`
- `nivel`
- `hora_liberacao`

O código usa `as any` para evitar erros de TypeScript, mas quando executa a query no banco, ela falha porque as colunas não existem.

## Solução
Adicionar as colunas faltantes à tabela `ebd_quizzes` via migration SQL.

---

## Implementação

### Passo 1: Migration SQL
Executar o seguinte SQL para adicionar as colunas:

```sql
ALTER TABLE ebd_quizzes
ADD COLUMN IF NOT EXISTS escala_id UUID REFERENCES ebd_escalas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contexto TEXT,
ADD COLUMN IF NOT EXISTS nivel TEXT DEFAULT 'Médio',
ADD COLUMN IF NOT EXISTS hora_liberacao TIME DEFAULT '09:00';
```

---

## Resultado Esperado
Após adicionar as colunas, o quiz será criado com sucesso ao colar o texto formatado.
