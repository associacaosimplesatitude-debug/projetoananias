

## Correção: Fuso horário na criação de sessões de sorteio

### Problema
O input `datetime-local` retorna valores sem fuso horário (ex: `2026-03-21T14:00`). Quando enviado ao banco (coluna `timestamptz`), o Supabase interpreta como UTC. O admin quis dizer 14:00 BRT (UTC-3), mas o banco armazena como 14:00 UTC (= 11:00 BRT).

Resultado: o countdown calcula os slots com base em horários errados (3 horas adiantados), gerando o timer de ~43 minutos ao invés do correto.

### Solução

**Arquivo: `src/pages/admin/SorteioAdmin.tsx`**

Ao salvar a sessão (tanto na criação quanto na edição), converter o valor do `datetime-local` para ISO string com fuso horário local antes de enviar ao banco:

```typescript
// Antes de inserir/atualizar:
const dataInicioISO = new Date(newSession.data_inicio).toISOString();
const dataFimISO = new Date(newSession.data_fim).toISOString();
```

`new Date("2026-03-21T14:00")` em JS cria um Date no fuso local do navegador. `.toISOString()` converte para UTC corretamente. Assim, 14:00 BRT vira 17:00 UTC no banco, e o countdown funciona.

Aplicar nos dois pontos: `createMutation` (linha ~48) e `updateMutation` (linha ~70).

