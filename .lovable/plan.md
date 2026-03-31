

# Fix: SKU Mapping — Dual Table Reference Problem

## Problem Found

The database has two different foreign keys:
- `ebd_produto_revista_mapping.revista_id` → `ebd_revistas` (Bling product catalog)
- `revista_licencas_shopify.revista_id` → `revistas_digitais` (digital magazine with lessons)

The webhook copies `mapping.revista_id` directly into `revista_licencas_shopify`, inserting an `ebd_revistas` UUID where a `revistas_digitais` UUID is expected. Titles don't match between tables either:
- `ebd_revistas`: "Revista EBD N07 Jovens e Adultos - O Homem, o Pecado e a Salvação ALUNO"
- `revistas_digitais`: "Revista EBD N07 - O Homem, o Pecado e a Salvação"

## Solution

Add a `revista_digital_id` column to `ebd_produto_revista_mapping` with FK to `revistas_digitais`. This cleanly separates the two references.

### Step 1 — Database migration
Add column `revista_digital_id UUID REFERENCES revistas_digitais(id) ON DELETE SET NULL` to `ebd_produto_revista_mapping`.

### Step 2 — Frontend (RevistaMapeamentos.tsx)
- Change the "Revista Digital" select to query `revistas_digitais` (WHERE `ativo = true`) instead of `ebd_revistas`
- Send the selected ID as `revista_digital_id` in the insert call
- Keep displaying `ebd_revistas.titulo` in the table (from `list_mappings` join) but also show the linked `revistas_digitais` title if present

### Step 3 — Edge function (revista-licencas-shopify-admin)
- `insert_mapping`: Accept `revista_digital_id` param and save it alongside the existing `revista_id` (which remains the `ebd_revistas` reference)
- Make `revista_id` (ebd_revistas) optional in the insert — the admin may not know the Bling product
- `list_mappings`: Add a second select or embed to also fetch `revistas_digitais` title via `revista_digital_id`

### Step 4 — Webhook (ebd-shopify-order-webhook)
- When creating a `revista_licencas_shopify` record, use `mapping.revista_digital_id` (the `revistas_digitais` UUID) instead of `mapping.revista_id`
- Fix the join from `.select('revista_id, revistas_digitais(titulo)')` to use the correct FK column
- Add a guard: skip if `revista_digital_id` is null

### Files changed
1. 1 database migration (add column + FK)
2. `src/pages/admin/RevistaMapeamentos.tsx` — select from `revistas_digitais`, send `revista_digital_id`
3. `supabase/functions/revista-licencas-shopify-admin/index.ts` — handle `revista_digital_id` in insert/list
4. `supabase/functions/ebd-shopify-order-webhook/index.ts` — use `revista_digital_id` for license creation

