

# Corrigir Modal "Visualizar Lead" - Limite de 1000 rows

## Problema Identificado

A tabela `ebd_shopify_pedidos` possui **1520 registros** com telefone, mas o Supabase retorna no maximo **1000 por query**. O pedido da Jaqueline Leovani (#2368) esta fora desse corte, por isso o modal aparece vazio.

## Solucao

Substituir a abordagem de "buscar todos e filtrar em memoria" por queries mais inteligentes que usam filtros no banco.

### Alteracoes em `LeadDetailModal.tsx`

**Estrategia: gerar variantes do telefone e usar filtro `in` no Supabase**

Em vez de buscar TODOS os registros e filtrar no frontend, vamos:

1. Gerar as variantes do telefone (com/sem 9o digito, com/sem prefixo 55, com/sem +)
2. Usar `.in("customer_phone", variantes)` direto na query do Supabase

Variantes geradas para `554591482203`:
- `554591482203`
- `5545991482203`
- `+554591482203`
- `+5545991482203`
- `4591482203`
- `45991482203`

Isso elimina o problema do limite de 1000 rows porque a query ja retorna apenas os registros relevantes.

### Detalhes tecnicos

```text
Arquivo: src/components/admin/whatsapp/LeadDetailModal.tsx

1. Nova funcao `generatePhoneFilters(phone)`:
   - Recebe o telefone bruto
   - Retorna array com todas as variantes possiveis:
     - digits puro
     - com/sem 55
     - com/sem 9o digito  
     - com/sem + na frente
   - Remove duplicatas

2. Query ebd_shopify_pedidos:
   - DE: .select(...).not("customer_phone", "is", null) + filter em JS
   - PARA: .select(...).in("customer_phone", phoneFilters)
   
3. Query ebd_leads_reativacao:
   - DE: .select(...).not("telefone", "is", null) + filter em JS  
   - PARA: .select(...).in("telefone", phoneFilters)

4. Query ebd_clientes:
   - DE: .select(...).not("telefone", "is", null) + filter em JS
   - PARA: .select(...).in("telefone", phoneFilters)
```

Essa mudanca resolve o problema de limite e tambem melhora a performance (busca apenas registros relevantes em vez de carregar centenas/milhares de registros).
