# Correção de Segurança Crítica: api-bling (Authorization) ✅ CONCLUÍDA

## Status: IMPLEMENTADO E DEPLOYADO (v1.2.0)

---

## Problema Identificado (CORRIGIDO)

A Edge Function `api-bling` continha uma vulnerabilidade crítica onde o `SUPABASE_SERVICE_ROLE_KEY` era usado como fallback para o header de Authorization em chamadas HTTP internas.

### Código Vulnerável (REMOVIDO)

**Linha 719 - handleCreateOrder:**
```typescript
// ANTES (INSEGURO):
const authorizationHeader = authHeader || `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`;

// DEPOIS (SEGURO):
const authorizationHeader = authHeader;
```

**Linha 781 - handleGenerateNfe:**
```typescript
// ANTES (INSEGURO):
const authorizationHeader = authHeader || `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`;

// DEPOIS (SEGURO):
const authorizationHeader = authHeader;
```

---

## Correções Implementadas

### 1. ✅ Verificação de Authorization nos Handlers

Ambos `handleCreateOrder` e `handleGenerateNfe` agora verificam a presença do Authorization header antes de qualquer lógica:

```typescript
if (!authHeader) {
  console.error('[API-BLING] [AUTH] Missing Authorization header for CREATE_ORDER');
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Unauthorized: missing Authorization header',
      fase: 'auth'
    }),
    {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}
```

### 2. ✅ Removido Fallback para Service Role Key

O fallback foi completamente removido. Agora usa apenas o header original:

```typescript
const authorizationHeader = authHeader; // SEM fallback para Service Role
```

### 3. ✅ Uso Correto do Service Role Key

O `SUPABASE_SERVICE_ROLE_KEY` é usado APENAS para:
- Inicialização do cliente Supabase (linha 846): `createClient(supabaseUrl, supabaseServiceKey)`

Ele NÃO é usado como Bearer token em nenhuma chamada HTTP.

---

## Arquivo Modificado

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/api-bling/index.ts` | v1.2.0 - Correção de segurança completa |

---

## Validação

1. **Deploy**: ✅ Sucesso
2. **Chamadas sem Authorization**: Retornarão HTTP 401
3. **Chamadas com Authorization válido**: Funcionam normalmente
4. **Service Role**: Usado APENAS para `createClient`, nunca como Bearer

---

## Benefícios da Correção

1. **Segurança**: Requisições não autenticadas são rejeitadas imediatamente com HTTP 401
2. **Conformidade**: Service Role Key usado apenas para fins administrativos
3. **Auditoria**: Logs claros de tentativas não autenticadas (`[API-BLING] [AUTH]`)
4. **Padrão**: Alinhamento com melhores práticas de segurança
