

# Fix 3 Bugs in ebd-shopify-order-webhook

Only file changed: `supabase/functions/ebd-shopify-order-webhook/index.ts`

## Correction 1 — `supabaseUrl is not defined` (line 833)

**Current** (line 833):
```typescript
const trackerUrl = `${supabaseUrl}/functions/v1/whatsapp-link-tracker?c=${clienteId}&f=1`;
```

**Fix**: Replace `supabaseUrl` with `SUPABASE_URL` (defined at line 138).

## Correction 2 — Idempotency guard for duplicate licenses

**Current** (lines 1035-1045): Inserts directly into `revista_licencas_shopify` without checking for existing records.

**Fix**: Add check before the insert (after line 1033, before line 1035):
```typescript
// Idempotency guard
const { data: existingLicense } = await supabase
  .from('revista_licencas_shopify')
  .select('id')
  .eq('shopify_order_id', String(order.id))
  .eq('whatsapp', whatsappLimpo)
  .maybeSingle();

if (existingLicense) {
  console.log(`⚠️ License already exists for order ${order.id}, skipping...`);
  continue;
}
```

## Correction 3 — `.single()` → `.maybeSingle()` on mapping query

**Current** (line 1009):
```typescript
.single();
```

**Fix**: Change to `.maybeSingle()`. The existing `if (!mapping) continue;` on line 1011 already handles null, so no other changes needed.

Note: The `ebd_clientes` lookups (lines 672 and 928) already use `.maybeSingle()` — no changes needed there. The PGRST116 error was likely triggered by the `.single()` on line 1009 when a SKU has no mapping.

## Summary of changes
- Line 833: `supabaseUrl` → `SUPABASE_URL`
- Line 1009: `.single()` → `.maybeSingle()`
- Lines 1034-1035: Insert idempotency guard block

