

# Correção do Consultor de BI - Informações Completas de Clientes

## Problemas Identificados

O Consultor de BI consegue **contar vendas** mas **não consegue** buscar informações dos clientes porque:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                    PROBLEMAS NO SYSTEM_PROMPT                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. STATUS CASE-SENSITIVE                                                │
│     Prompt diz: status = 'ativo'                                         │
│     Banco tem:  status = 'Ativo'  ← Não encontra vendedores!             │
│                                                                          │
│  2. EMAIL FICTÍCIO                                                       │
│     AI cria: elaine@email.com (inventado)                                │
│     Deveria: elaine.ribeiro@editoracentralgospel.com (real)              │
│     Causa: Não busca vendedor primeiro, chuta email                      │
│                                                                          │
│  3. PONTO E VÍRGULA NAS QUERIES                                          │
│     AI gera: SELECT ... WHERE status = 'PAGO';                           │
│     RPC erro: syntax error at or near ";"                                │
│                                                                          │
│  4. PERDE FILTRO DE DATA                                                 │
│     Pergunta 1: "vendas de hoje" → filtra CURRENT_DATE ✓                 │
│     Pergunta 2: "clientes da Gloria" → SEM filtro de data ✗              │
│     Resultado: Busca em todo histórico, não encontra nada                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Solução

Atualizar o `SYSTEM_PROMPT` em `supabase/functions/gemini-assistente-gestao/index.ts` com:

### 1. Corrigir Status Case-Sensitive

```sql
-- ERRADO (no prompt atual)
WHERE status = 'ativo'

-- CORRETO (usar ILIKE ou valor correto)
WHERE status ILIKE 'ativo'
-- OU
WHERE LOWER(status) = 'ativo'
```

### 2. Instruir a SEMPRE Buscar Vendedor Primeiro

Adicionar regra obrigatória:

```
## REGRA CRÍTICA: Buscar Vendedor Primeiro

Quando o usuário perguntar sobre um vendedor específico:
1. PRIMEIRO busque o vendedor na tabela vendedores pelo nome
2. OBTENHA o email e id reais
3. SÓ DEPOIS use esses dados nas queries de vendas

Exemplo CORRETO:
-- Passo 1: Buscar vendedor
SELECT id, nome, email FROM vendedores WHERE nome ILIKE '%elaine%'
-- Resultado: id=abc, email=elaine.ribeiro@editoracentralgospel.com

-- Passo 2: Usar email REAL nas queries
SELECT cliente_nome FROM vendedor_propostas WHERE vendedor_email = 'elaine.ribeiro@editoracentralgospel.com'

NUNCA invente emails como 'elaine@email.com' ou 'gloria@exemplo.com'
```

### 3. Proibir Ponto e Vírgula

Adicionar regra:

```
## NUNCA Use Ponto e Vírgula

As queries NÃO devem terminar com ponto e vírgula (;)
O RPC execute_readonly_query não aceita queries com ;

ERRADO:  SELECT * FROM vendedores WHERE nome = 'Gloria';
CORRETO: SELECT * FROM vendedores WHERE nome = 'Gloria'
```

### 4. Manter Contexto de Data Entre Perguntas

Adicionar instruções:

```
## Manter Contexto Temporal

Se o usuário perguntou sobre "vendas de HOJE" e depois pergunta sobre clientes:
- MANTENHA o filtro de data nas queries subsequentes
- Use created_at::date = CURRENT_DATE para vendas de hoje
- Use created_at >= CURRENT_DATE - INTERVAL '7 days' para última semana

Exemplo de conversa:
User: "vendas de hoje" → filtrar CURRENT_DATE
User: "clientes da Gloria" → MANTER filtro CURRENT_DATE
```

### 5. Documentar Campos de Cliente por Tabela

Adicionar seção específica:

```
## Campos de Cliente em Cada Tabela

Para buscar NOME DO CLIENTE em cada tabela:

| Tabela                         | Campo do Cliente  | Outros campos úteis           |
|-------------------------------|-------------------|-------------------------------|
| vendedor_propostas            | cliente_nome      | cliente_id, cliente_cnpj      |
| ebd_shopify_pedidos           | customer_name     | customer_email, customer_phone|
| ebd_shopify_pedidos_mercadopago| cliente_nome     | cliente_id                    |
| vendas_balcao                 | cliente_nome      | cliente_cpf, cliente_telefone |
```

---

## Alterações no Arquivo

### Arquivo: `supabase/functions/gemini-assistente-gestao/index.ts`

Atualizar o `SYSTEM_PROMPT` (linhas 11-110) para incluir todas as correções acima.

---

## Resultado Esperado

Após as correções:

| Pergunta | Comportamento Atual | Comportamento Esperado |
|----------|--------------------|-----------------------|
| "Vendas de hoje" | Conta corretamente | Conta corretamente ✓ |
| "Clientes da Gloria hoje" | "Nenhum encontrado" | Lista: Bruna Soares silva, Igreja Assembleia de Deus |
| "Cliente da Elaine hoje" | "Nenhum encontrado" | IGREJA BATISTA SEMEAR |

O Consultor de BI passará a:
- Buscar vendedor pelo nome PRIMEIRO para obter email real
- Manter filtros de data consistentes entre perguntas
- Evitar erros de sintaxe (sem ponto e vírgula)
- Encontrar vendedores corretamente (status case-insensitive)

