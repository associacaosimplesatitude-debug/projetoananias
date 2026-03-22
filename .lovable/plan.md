

## Sorteio manual das 21h - Sessão "Vitoriosas Conference 26 [Sáb.]"

### Situação
- A sessão terminou às 00:00 UTC (21h BRT) e o cron executou após esse horário, perdendo o último sorteio
- Último sorteio realizado: **20h BRT** (Milena Gasoni Hybner)
- 41 participantes na sessão, elegível sorteada aleatoriamente: **Rebeka Cristiana** (id: `210f5368-d147-4dcf-830f-ad8cbc218cc2`)

### Ação
Inserir manualmente a ganhadora na tabela `sorteio_ganhadores`:

```sql
INSERT INTO sorteio_ganhadores (participante_id, sessao_id, status, expira_em)
VALUES (
  '210f5368-d147-4dcf-830f-ad8cbc218cc2',
  '7d05ac91-a95d-483e-acd9-c21659b24c9b',
  'aguardando',
  (now() + interval '3 hours')
);
```

Isso fará com que **Rebeka Cristiana** apareça imediatamente na página `/sorteio` com o timer de 3 horas para retirar o prêmio.

### Correção futura recomendada
Ajustar a edge function para usar `nowMs >= fim` em vez de `nowMs > fim`, ou estender o `data_fim` em 5 minutos para cobrir o último slot.

