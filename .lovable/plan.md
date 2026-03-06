

## Plano: Descontos nos Públicos + Seleção de Públicos nas Campanhas

### 1. Atualizar RPC `get_publicos_revistas_por_mes`

Modificar a função SQL para incluir contagem de contatos **com desconto** e **sem desconto** por mês. A lógica:
- Faz LEFT JOIN de `ebd_shopify_pedidos.customer_email` com `ebd_clientes.email_superintendente`
- Depois LEFT JOIN com `ebd_descontos_categoria_representante` para verificar se o cliente tem desconto
- Retorna por mês: `total_contatos`, `com_desconto`, `sem_desconto`
- Cada contato no array terá um campo `tem_desconto: boolean`

**Migration:** `ALTER OR REPLACE FUNCTION get_publicos_revistas_por_mes()`

### 2. Atualizar `WhatsAppPublicos.tsx`

Exibir na badge de cada mês:
```
Fevereiro 2026 — 32 contatos (14 com desconto · 18 sem desconto)
```

Adicionar badges coloridas: verde para "com desconto", cinza para "sem desconto".

### 3. Atualizar `WhatsAppCampaigns.tsx` — Segmentação com Públicos

Na etapa de segmentação, adicionar uma **nova seção** (antes ou junto com "Usar público de campanha existente"):

**"Usar Público de Revistas"**
- Dropdown multi-select com os públicos mensais disponíveis (ex: "Janeiro 2026 — 186 contatos", "Fevereiro 2026 — 32 contatos")
- Opção **"Todos os meses"** no topo
- Filtro: **Com Desconto / Sem Desconto / Todos**
- Botão **"Carregar Público"** que busca os contatos da RPC já filtrados
- Os contatos carregados são adicionados ao array `recipients` (com deduplicação por email)

**Fluxo:** O usuário pode selecionar múltiplos meses + filtro de desconto → clicar "Carregar" → contatos são carregados como destinatários da campanha.

### Arquivos

- **Migration:** Atualizar função `get_publicos_revistas_por_mes` (adicionar `tem_desconto`, `com_desconto`, `sem_desconto`)
- **Editar:** `src/components/admin/WhatsAppPublicos.tsx` (mostrar contagens com/sem desconto)
- **Editar:** `src/components/admin/WhatsAppCampaigns.tsx` (adicionar seção de públicos de revistas na segmentação)

