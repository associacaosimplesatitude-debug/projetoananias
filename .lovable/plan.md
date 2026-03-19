

# Plano: Sorteio Automático via Cron Job

## Visão Geral
Implementar sorteio automático que roda a cada minuto, verifica se é hora de sortear baseado no intervalo da sessão ativa, e executa o sorteio sem intervenção manual. A landing page exibe animação de roleta quando detecta novo ganhador.

---

## Etapas

### 1. Migração de banco de dados
Adicionar coluna `premio_padrao` na tabela `sorteio_sessoes`:
```sql
ALTER TABLE sorteio_sessoes ADD COLUMN IF NOT EXISTS premio_padrao text;
```

### 2. Criar Edge Function `sorteio-automatico`
**Arquivo:** `supabase/functions/sorteio-automatico/index.ts`

Lógica sequencial:
1. Buscar sessão ativa (`ativo = true`)
2. Verificar se `now()` está dentro de `data_inicio` e `data_fim`
3. Calcular slots de sorteio (`data_inicio + N * intervalo_minutos`) e verificar se estamos dentro de 5 min de um slot
4. Verificar se já existe ganhador nos últimos `intervalo_minutos` minutos (evitar duplicata)
5. Buscar participantes elegíveis da sessão, excluindo quem já ganhou com `status != 'expirado'`
6. Sortear aleatoriamente, inserir em `sorteio_ganhadores` com `status = 'aguardando'`, `expira_em = now() + 3h`, `premio_descricao = sessao.premio_padrao`

Usar `createClient` com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (internamente). CORS headers incluídos. `verify_jwt = false` no config.toml.

### 3. Configurar cron job
Usar o insert tool (não migração) para registrar o cron schedule via `cron.schedule`, chamando a Edge Function a cada minuto com o anon key e URL do projeto.

### 4. Atualizar SorteioAdmin.tsx — Modal "Nova Sessão"
- Adicionar campo `premio_padrao` ao state `newSession`
- Adicionar Input "Prêmio padrão dos sorteios (opcional)" no modal
- Incluir `premio_padrao` no `insert` da mutation
- Exibir `premio_padrao` nos cards de sessão existentes

### 5. Atualizar SorteioLanding.tsx — Animação de roleta
- Adicionar `useRef` para guardar último `ganhador_id`
- Estados: `mostrandoRoleta`, `nomeRoleta`, `roletaFinalizado`
- No `useEffect`, comparar `ganhadoresAtual?.id` com `ultimoGanhadorRef.current`
- Se novo ganhador detectado:
  - Exibir overlay escuro fullscreen com nomes aleatórios piscando (~3s, desacelerando)
  - Revelar nome real com efeito de escala + confetti CSS (partículas douradas via keyframes)
  - Esconder após ~4s
- Overlay: `fixed inset-0 z-50 bg-black/90` com animação de texto

### 6. Deploy da Edge Function
Fazer deploy de `sorteio-automatico`.

---

## Arquivos Modificados
| Arquivo | Ação |
|---|---|
| `supabase/functions/sorteio-automatico/index.ts` | Criar |
| `supabase/config.toml` | Adicionar entry (automático) |
| `src/pages/admin/SorteioAdmin.tsx` | Editar (campo premio_padrao no modal) |
| `src/pages/public/SorteioLanding.tsx` | Editar (animação roleta) |
| Migração SQL | `premio_padrao` column |
| Insert SQL | cron.schedule |

