

## Etapa 1 — Database Migration: Sorteio + Embaixadoras

### Single Migration

One SQL migration covering all 7 tables, indexes, RLS policies, and seed data for `embaixadoras_tiers`.

**Tables created:**
1. `sorteio_sessoes` — session config
2. `sorteio_participantes` — public registrations (unique by whatsapp/email)
3. `sorteio_ganhadores` — winners with status tracking
4. `embaixadoras_tiers` — commission tiers (seeded with 3 defaults)
5. `embaixadoras` — ambassador profiles linked to participants
6. `embaixadoras_cliques` — click tracking
7. `embaixadoras_vendas` — sales attribution

**RLS policies** as specified: public INSERT for participants/clicks, public SELECT for winners/sessions/tiers, admin-only for mutations.

**Storage bucket note:** The `storage` schema is reserved and cannot be modified via migrations. The `sorteio-fotos` bucket will need to be created in a later step when building the frontend, or via a different approach.

### Technical details

- All SQL exactly as provided by the user, combined into a single migration
- Indexes on foreign keys, status columns, and lookup fields
- Seed data for 3 tiers: Iniciante (5%), Ativa (8%), Premium (12%)
- No frontend files created

