
# Correção de Segurança Crítica: api-bling (Authorization)

## Problema Identificado

A Edge Function `api-bling` contém uma vulnerabilidade crítica onde o `SUPABASE_SERVICE_ROLE_KEY` é usado como fallback para o header de Authorization em chamadas HTTP internas.

### Código Vulnerável (2 ocorrências)

**Linha 719 - handleCreateOrder:**
```typescript
const authorizationHeader = authHeader || `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`;
```

**Linha 781 - handleGenerateNfe:**
```typescript
const authorizationHeader = authHeader || `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`;
```

### Impacto da Vulnerabilidade

- Requisições sem Authorization são processadas com privilégios de Service Role
- Qualquer atacante pode acessar funcionalidades protegidas sem autenticação
- Viola princípios básicos de segurança (bypass de autenticação)

---

## Correção Proposta

### 1. Adicionar Verificação de Authorization no Main Handler

No início da função `serve`, após capturar o `authHeader`, adicionar verificação imediata para ações que requerem autenticação.

### 2. Bloquear Execução sem Authorization

Nos handlers `CREATE_ORDER` e `GENERATE_NFE`, antes de qualquer lógica:

```typescript
if (!authHeader) {
  console.error("[API-BLING] [AUTH] Missing Authorization header");
  return new Response(
    JSON.stringify({
      success: false,
      error: "Unauthorized: missing Authorization header",
      fase: "auth"
    }),
    {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}
```

### 3. Remover Fallback para Service Role Key

Substituir:
```typescript
const authorizationHeader = authHeader || `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`;
```

Por:
```typescript
const authorizationHeader = authHeader; // SEM fallback para Service Role
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/api-bling/index.ts` | Correção de segurança completa |

## Alterações Detalhadas

### Função `handleCreateOrder` (linhas 666-769)

1. Adicionar verificação de `authHeader` no início
2. Retornar 401 se ausente
3. Remover fallback da linha 719

### Função `handleGenerateNfe` (linhas 773-824)

1. Adicionar verificação de `authHeader` no início
2. Retornar 401 se ausente
3. Remover fallback da linha 781

### Uso Correto do Service Role Key

O `SUPABASE_SERVICE_ROLE_KEY` continuará sendo usado **apenas** para:
- Inicialização do cliente Supabase (linha 846): `createClient(supabaseUrl, supabaseServiceKey)`

Ele **nunca** será usado como Bearer token em chamadas HTTP.

---

## Validação Pós-Deploy

1. **Teste sem Authorization**: Deve retornar HTTP 401
   ```bash
   curl -X POST .../api-bling -d '{"action":"CREATE_ORDER",...}'
   # Esperado: 401 Unauthorized
   ```

2. **Teste com Authorization válido**: Deve funcionar normalmente
   ```bash
   curl -X POST .../api-bling -H "Authorization: Bearer <token>" -d '...'
   # Esperado: 200 OK ou erro de negócio
   ```

3. **Verificar logs**: Nenhum uso de Service Role em Authorization

---

## Benefícios da Correção

1. **Segurança**: Requisições não autenticadas são rejeitadas imediatamente
2. **Conformidade**: Service Role Key usado apenas para fins administrativos
3. **Auditoria**: Logs claros de tentativas não autenticadas
4. **Padrão**: Alinhamento com melhores práticas de segurança
