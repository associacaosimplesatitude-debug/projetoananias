

## Plano: Isolar dados da página AGE26 por sessão específica

### Problema
A query de sessão ativa busca qualquer sessão com `ativo = true`, retornando a sessão "Vitoriosas Conference" que está ativa no momento. Não há como distinguir sessões AGE26 de outras.

### Solução

**1. Adicionar coluna `slug` à tabela `sorteio_sessoes`** (migração)

```sql
ALTER TABLE sorteio_sessoes ADD COLUMN slug text;
CREATE UNIQUE INDEX idx_sorteio_sessoes_slug ON sorteio_sessoes(slug) WHERE slug IS NOT NULL;
```

Isso permite que cada sessão tenha um identificador único (ex: `age26`, `vitoriosas-2026`).

**2. Atualizar `SorteioAge26Landing.tsx`**

Alterar a query de sessão ativa para filtrar por `slug = 'age26'` além de `ativo = true`:

```typescript
const { data } = await supabase
  .from("sorteio_sessoes")
  .select("*")
  .eq("ativo", true)
  .eq("slug", "age26")
  .maybeSingle();
```

**3. Criação da sessão AGE26**

Quando o admin criar a sessão AGE26 na página `/admin/ebd/sorteio`, deverá definir o slug como `age26`. Para facilitar, nenhuma alteração no admin é necessária agora — o slug será definido manualmente via banco ou poderá ser adicionado ao formulário admin futuramente.

### Resultado
- A página `/sorteio/age26` só exibirá dados (ganhadores, participantes, countdown) da sessão com slug `age26`
- A página `/sorteio` original continua funcionando como antes (sem filtro de slug)
- Múltiplos eventos podem rodar simultaneamente sem conflito

### Arquivos modificados
- Migração: adicionar coluna `slug` em `sorteio_sessoes`
- `src/pages/public/SorteioAge26Landing.tsx` — filtrar por `slug = 'age26'`

