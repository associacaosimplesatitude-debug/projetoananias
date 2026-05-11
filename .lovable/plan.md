## Investigação concluída

**Dados atuais em `agente_ia_conversas`:**
- `ativa`: 8
- `escalada`: 4 (incluindo Cleuton — ficou travada)
- `fechada`: 2

**Coluna existente:** já existe `motivo_pausa text` (nullable). Vamos adicionar `agente_pausado boolean`.

**Usos atuais de `escalada`/`pausada_humano` no código:**

| Arquivo | Uso |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Bloqueia agente em ambos status (linhas 36–44) |
| `supabase/functions/agente-loja-cg/tools.ts` | `escalar_para_humano` marca conversa como `escalada` |
| `supabase/functions/agente-loja-cg/index.ts` | Filtra conversas elegíveis em `["ativa", "pausada_humano", "escalada"]` e bloqueia chamada à Anthropic se status = pausada/escalada |
| `src/pages/admin/agente-ia/ConversaDetalhe.tsx` | Botões "Pausar" (→ pausada_humano) / "Retomar" (→ ativa) já existem nesse painel |
| `src/pages/admin/agente-ia/Conversas.tsx` | Filtro de status + badge colorido |
| `src/pages/admin/agente-ia/Metricas.tsx` | Conta conversas escaladas |

---

## Plano de execução

### 1. Migration — desacoplar pausa de escalada

```sql
ALTER TABLE agente_ia_conversas
  ADD COLUMN IF NOT EXISTS agente_pausado boolean NOT NULL DEFAULT false;

-- pausada_humano → pausa explícita do vendedor
UPDATE agente_ia_conversas
SET agente_pausado = true, status = 'ativa'
WHERE status = 'pausada_humano';

-- escalada → escalação fica em agente_ia_escalations; agente volta a responder
UPDATE agente_ia_conversas
SET status = 'ativa', agente_pausado = false
WHERE status = 'escalada';

-- 'fechada' permanece intocada
CREATE INDEX IF NOT EXISTS idx_agente_ia_conv_pausado
  ON agente_ia_conversas(agente_pausado) WHERE agente_pausado = true;
```

### 2. Webhook — `deveRotearParaAgente` (whatsapp-webhook/index.ts, ~L36–44)

```ts
const { data: convAgente } = await supabase
  .from("agente_ia_conversas")
  .select("id, agente_pausado")
  .in("telefone", variantes)
  .eq("agente_pausado", true)
  .order("ultima_mensagem_em", { ascending: false })
  .limit(1)
  .maybeSingle();
if (convAgente) return { chamar: false, motivo: "agente_pausado_manualmente" };
```

Mantém regra de retenção (72h) intacta.

### 3. `agente-loja-cg/tools.ts` — `escalar_para_humano`

Remover a linha que faz `update({ status: "escalada" })`. Apenas insere em `agente_ia_escalations` e devolve `mensagem_para_cliente`. Agente continua dono da conversa.

### 4. `agente-loja-cg/index.ts` — filtro/guarda

- Trocar `.in("status", ["ativa", "pausada_humano", "escalada"])` por `.in("status", ["ativa"])`.
- Substituir guarda `status === "pausada_humano" || status === "escalada"` por `conversa.agente_pausado === true` (mesmo log "pausada manualmente — não chamar").

### 5. Frontend — botão Pausar/Retomar no chat de atendimento

Em `src/components/admin/WhatsAppChat.tsx` (chat usado em `/admin/whatsapp`), no header da conversa selecionada:

- Buscar `agente_pausado` da conversa do agente (via telefone do contato).
- Botão toggle:
  - `agente_pausado=false` → "⏸️ Pausar Agente IA" (update para true).
  - `agente_pausado=true` → "▶️ Retomar Agente IA" (update para false) + banner "Agente IA pausado. Você está atendendo manualmente."
- Permissão: admin, superadmin ou vendedor responsável (já controlado pelas RLS existentes).

`ConversaDetalhe.tsx` (painel /admin/agente-ia): adaptar os botões existentes para alterar `agente_pausado` em vez de `status`. Manter visual.

### 6. `whatsapp-send-template-avulso` — reativar agente

Após envio bem-sucedido, fazer:
```ts
await supabase.from("agente_ia_conversas")
  .update({ agente_pausado: false })
  .in("telefone", variantes)
  .eq("agente_pausado", true);
```
Resolve o caso do Cleuton e qualquer template avulso futuro.

### 7. Envio de texto livre pelo vendedor — pausa automática (opcional, recomendado)

No fluxo de envio manual (texto livre) do `WhatsAppChat`, quando o vendedor digita e envia, marcar `agente_pausado = true` na conversa. O vendedor retoma manualmente quando quiser.

### 8. Painéis cosméticos

- `Conversas.tsx`: remover opções de filtro "Pausada" e "Escalada" (ou manter "Escalada" lendo de `agente_ia_escalations` em vez de `status`). Adicionar filtro "Agente pausado" (boolean).
- `Metricas.tsx`: contar escalações via `agente_ia_escalations` (não `status`).

### 9. Deploy + validação

1. `psql` confirmando: Cleuton em `status=ativa, agente_pausado=false`.
2. Cleuton manda mensagem real → agente responde (logs `roteamento ... chamar:true`).
3. Clicar "Pausar Agente IA" no chat → próxima mensagem dele não é respondida pelo agente.
4. Clicar "Retomar" → agente volta.
5. Forçar escalação em outra conversa → aparece em `/admin/agente-ia/escalations` mas conversa segue sendo respondida pelo agente.

## Restrições respeitadas

- Painel `/admin/agente-ia/escalations`: não muda.
- Regra de retenção: intacta.
- `whatsapp-sync-templates-from-meta`: intacta.
- Migration idempotente (`IF NOT EXISTS`, updates condicionais).
