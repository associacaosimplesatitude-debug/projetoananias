## Remover 3 colunas do Kanban de Retenção

Remover as colunas que não fazem mais sentido na tela `/admin/ebd/retencao`:
- Retorno Agendado
- Perdido
- Contato Feito

### Layout final (5 colunas)

```
📞 A Contatar | 🌱 Interessado | 💬 Falar com Consultor | 🙅 Recusou | 🎯 Fechados (mês)
```

### Alterações

**1. `src/components/admin/retencao/RetencaoKanban.tsx`**
- Remover do array `COLUNAS` as entradas `contato_feito`, `retorno_agendado` e `perdido`.
- Remover do mapa `COLUNA_TO_RESULTADO` as chaves correspondentes (drag-and-drop só permitirá soltar nas 5 colunas restantes).
- Ajustar o grid: `xl:grid-cols-5` (em vez de 8).

**2. RPC `get_retencao_dashboard` (migration)**
- Na expressão `coluna_kanban`, remover os `WHEN` para `nao_quer_mais` (perdido), `retorno_agendado` e o fallback genérico que mandava qualquer outro `ultimo_resultado` para `contato_feito`.
- Clientes com esses resultados antigos cairão em `a_contatar` por padrão (volta a aparecer como pendente).
- O filtro do `WHERE` final continua o mesmo (>60 dias OU fechado no mês OU resultado interessado/falar/recusou).

### Fora de escopo
- Não mexer no modal `RegistrarContatoModal` (continua salvando os mesmos resultados; só não terão mais coluna dedicada).
- Não mexer no webhook do WhatsApp.
