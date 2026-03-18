

## Validação do Plano de Retenção de Clientes

### Respostas às perguntas

**1. Query unificando 3 canais por `cliente_id` — viável sem lentidão?**

Sim, é viável. Os 3 canais já usam `cliente_id` como FK para `ebd_clientes`:
- `ebd_shopify_pedidos.cliente_id` + `created_at` (status = 'paid')
- `ebd_shopify_pedidos_mercadopago.cliente_id` + `created_at` (status = 'PAGO')
- `vendedor_propostas.cliente_id` + `confirmado_em` (status = 'FATURADO' ou 'PAGO')

**Recomendação**: Criar uma **RPC (database function)** em vez de fazer 3 queries separadas no frontend. Padrão já usado no projeto (ex: `get_funil_stage_counts`, `get_sales_channel_totals`). A RPC faz o GREATEST das datas e retorna os dados já categorizados por faixa. Isso evita trazer todos os pedidos para o frontend.

**2. Índices necessários na `ebd_retencao_contatos`?**

Sim, adicionar:
- `INDEX ON ebd_retencao_contatos(cliente_id)` — lookup por cliente
- `INDEX ON ebd_retencao_contatos(vendedor_id)` — filtro por vendedor
- `INDEX ON ebd_retencao_contatos(data_contato DESC)` — último contato

**3. Conflito com `ebd_leads_reativacao` e `funil_posv_tracking`?**

**Não há conflito direto**, mas há **sobreposição de propósito** que vale documentar:

| Tabela | Propósito | Público-alvo |
|--------|-----------|-------------|
| `ebd_leads_reativacao` | Leads novos (landing page, reativação de inativos). Tem `status_kanban`, `motivo_perda`, `lead_score`. | Leads que nunca compraram ou saíram há muito tempo |
| `funil_posv_tracking` | Pós-venda automático de e-commerce (5 fases: WhatsApp, login, onboarding). | Clientes que acabaram de comprar via Shopify |
| `ebd_retencao_contatos` (nova) | Histórico de interações manuais para reter clientes existentes 60+ dias sem comprar. | Clientes ativos que estão esfriando |

São complementares. A nova tabela é um **registro de contatos**, não um funil. O Kanban proposto é uma **view derivada** do estado do cliente (dias sem comprar + último contato registrado), não um status salvo na tabela — o que é correto.

**4. useQuery com paginação ou tudo de uma vez?**

Use `useQuery` com a RPC retornando dados já agrupados por faixa. O Kanban tipicamente terá poucos clientes (60+ dias), então não precisa de paginação no Kanban. Os cards de contagem (0-30, 30-60, etc.) são apenas números agregados da RPC.

Para o histórico de contatos de um cliente específico, usar query paginada no modal.

### Problemas e ajustes encontrados

**A. Campo `status_kanban` no Kanban**

O plano propõe 4 colunas de Kanban derivadas da combinação "dias sem comprar" + "contatos registrados". Isso é bom — **não salvar** a coluna do Kanban na tabela. A posição do cliente no Kanban deve ser calculada:
- "A Contatar" = 60+ dias sem comprar E sem contato em `ebd_retencao_contatos`
- "Contato Feito" = tem registro com resultado != 'retorno_agendado' e != 'nao_quer_mais'
- "Retorno Agendado" = último contato com resultado = 'retorno_agendado'
- "Perdido" = último contato com resultado = 'nao_quer_mais'

**B. Quando resultado = "comprou" — o "zerar" é automático**

Não precisa de trigger. Se o cliente fez nova compra em qualquer canal, a query de "última compra" já retorna data recente, e ele sai automaticamente da faixa 60+ dias. O campo `resultado = 'comprou'` no contato é apenas informativo.

**C. Rota sugerida: `/admin/ebd/retencao`**

Correto e consistente com o padrão existente (`/admin/ebd/*`).

**D. RLS da nova tabela**

Precisa de policies para:
- Admin/gerente_ebd: acesso total
- Vendedores: ver/inserir apenas `WHERE vendedor_id = vendedor logado`

**E. Valor médio no card do Kanban**

Para mostrar "valor médio", a RPC precisa calcular a média de compras do cliente nos 3 canais. Adicionar esse cálculo na mesma RPC.

### Estrutura técnica recomendada

```text
1. Migration SQL:
   - CREATE TABLE ebd_retencao_contatos (conforme proposto + índices)
   - RLS policies
   - RPC get_retencao_dashboard(p_vendedor_id) retornando:
     {faixas: {verde, amarelo, vermelho, perdido}, 
      kanban_clientes: [{id, nome, dias_sem_compra, canal, vendedor, valor_medio, ultimo_contato}]}

2. Frontend:
   - src/pages/admin/EbdRetencao.tsx (página principal)
   - src/components/admin/retencao/RetencaoKanban.tsx
   - src/components/admin/retencao/RegistrarContatoModal.tsx
   - Rota em App.tsx: /admin/ebd/retencao
   - Menu no sidebar Admin EBD
```

### Veredicto

O plano é **tecnicamente sólido**. Nenhum problema bloqueante. Os ajustes acima são refinamentos recomendados, não correções obrigatórias.

