## Diagnóstico

O clique foi recebido e gravou corretamente em `ebd_retencao_contatos`:

```
cliente_id: 4590e8fe-... (Cleuton Soares)
resultado: falar_com_consultor
```

Porém o cliente **não tem nenhuma compra** registrada (Shopify/MP/Faturado todos `NULL`).

A função SQL `get_retencao_dashboard` monta o CTE `com_dias` filtrando `WHERE data_ultima_compra > '-infinity'`. Como esse cliente nunca comprou, ele é descartado antes de chegar no `kanban_clientes` — mesmo tendo `ultimo_resultado = 'falar_com_consultor'`.

Resultado: o card simplesmente não existe no Kanban.

## Plano (1 alteração — migration SQL)

Atualizar a função `public.get_retencao_dashboard` para incluir clientes sem histórico de compras quando eles tiverem `ultimo_resultado IN ('interessado','falar_com_consultor','recusou')`.

### Mudanças na função

1. **CTE `com_dias`**: remover o filtro `WHERE data_ultima_compra > '-infinity'` ou flexibilizá-lo para manter clientes com `ultimo_resultado` relevante. `dias_sem_compra` será `NULL` quando não houver compra.

2. **`kanban_clientes`**: o `WHERE` final já contempla `cd.ultimo_resultado IN ('interessado','falar_com_consultor','recusou')`, então clientes sem compra mas com resposta passarão a aparecer normalmente.

3. **`coluna_kanban`**: a lógica `CASE WHEN cd.ultimo_resultado = 'falar_com_consultor' THEN 'falar_com_consultor'` já existe — funcionará automaticamente.

4. **Faixas (contagem verde/amarelo/vermelho/perdido)**: manter o filtro `dias_sem_compra IS NOT NULL` nessas contagens para não inflar números com clientes sem compra.

### Sem alterações em frontend

`RetencaoKanban.tsx` já trata `dias_sem_compra` e renderiza a coluna `falar_com_consultor`. Nada a mudar lá.

## Resultado esperado

Após a migration, ao recarregar `/admin/ebd/retencao`, o card "Cleuton Soares" aparecerá na coluna **💬 Falar com Consultor**.

Posso aplicar?
