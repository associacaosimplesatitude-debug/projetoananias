
# Fix: Lessons not loading for Shopify OTP readers

## Root Cause

The `revista_licoes` table has an RLS policy "Anyone can read licoes" that is restricted to the `authenticated` role. Shopify OTP users access the app without Supabase Auth (they use sessionStorage tokens), so all queries run as `anon`. The query returns 0 rows — not a UUID mismatch.

**Evidence:**
- UUIDs are correct: `revista_licencas_shopify.revista_id` = `503e5583...` matches `revista_licoes.revista_id` = `503e5583...` (13 lessons exist)
- RLS policy: `polroles = {authenticated}`, `polcmd = r (SELECT)`, `qual = true`
- OTP readers use `supabase` client with anon key → blocked by RLS

## Fix (single change)

**Database migration** — Add an RLS policy allowing `anon` to SELECT from `revista_licoes`:

```sql
CREATE POLICY "Public can read licoes"
ON public.revista_licoes
FOR SELECT
TO anon
USING (true);
```

This is safe because:
- Lesson content (image URLs) is meant to be viewable by anyone with a valid OTP session
- The images are already public URLs in storage
- No sensitive data in `revista_licoes` (just lesson number, title, and image URLs)
- Write operations remain restricted to authenticated managers

## Files changed
- 1 database migration only
- No code changes needed — `RevistaLeitura.tsx` is already correct
