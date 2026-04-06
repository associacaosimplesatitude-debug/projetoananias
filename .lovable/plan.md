

## Diagnóstico

Todos os 10 registros no banco estão com **todos os campos nulos** (ip, cidade, estado, latitude, longitude, latitude_gps, longitude_gps). Isso confirma que:

1. **`ipapi.co` está retornando `{}`** — provavelmente bloqueado por rate-limit ou CORS no domínio do Lovable/produção
2. **GPS não está sendo concedido** — o navegador não concede permissão automaticamente, e o usuário não está interagindo com o prompt

## Solução proposta

Criar uma **Edge Function** que faz a chamada de geolocalização por IP no lado do servidor, eliminando problemas de CORS e rate-limit do frontend.

### Arquivos envolvidos

1. **`supabase/functions/geo-ip/index.ts`** (novo) — Edge Function que:
   - Recebe o IP do cliente via header `x-forwarded-for` ou `cf-connecting-ip`
   - Chama `ipapi.co/{ip}/json/` server-side
   - Retorna os dados de geolocalização
   - Fallback: se ipapi.co falhar, tenta `ip-api.com/json/{ip}` (outra API gratuita)

2. **`src/pages/revista/RevistaLeitura.tsx`** — Alterar `trackAcesso` para:
   - Chamar a Edge Function em vez de `ipapi.co` direto do frontend
   - Manter o fallback de GPS como está

### Fluxo corrigido

```text
Frontend (trackAcesso)
  → POST /functions/v1/geo-ip
  → Edge Function lê IP do request
  → Chama ipapi.co server-side (sem CORS)
  → Fallback: ip-api.com se ipapi.co falhar
  → Retorna { ip, city, region, latitude, longitude }
  → Frontend insere em revista_acessos_geo
  → Tenta GPS como enriquecimento opcional
```

### Detalhes da Edge Function

```typescript
// supabase/functions/geo-ip/index.ts
// 1. Extrair IP real do header
// 2. Tentar ipapi.co/{ip}/json/
// 3. Se falhar, tentar ip-api.com/json/{ip}
// 4. Retornar JSON normalizado: { ip, city, region, country, latitude, longitude }
```

### Alteração em RevistaLeitura.tsx

Substituir:
```typescript
const resp = await fetch('https://ipapi.co/json/');
```

Por:
```typescript
const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geo-ip`);
```

### Critérios de aceite

- Novos acessos passam a ter cidade, estado e coordenadas preenchidos
- Se ambas APIs falharem, o acesso ainda é registrado (com campos nulos)
- O mapa plota os novos acessos corretamente

