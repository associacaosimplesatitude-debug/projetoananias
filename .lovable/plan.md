

## Fix: Add missing UPDATE policy for revistas storage bucket

### Root Cause
The PDF upload code uses `supabase.storage.from("revistas").upload(path, blob, { upsert: true })`. When `upsert: true` is set and a file already exists, Supabase needs an **UPDATE** policy on `storage.objects`. Currently only INSERT and DELETE policies exist for the `revistas` bucket — no UPDATE.

### Solution
Single SQL migration to add the missing UPDATE policy:

```sql
CREATE POLICY "Managers can update revistas files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'revistas' AND public.can_manage_revistas(auth.uid()))
  WITH CHECK (bucket_id = 'revistas' AND public.can_manage_revistas(auth.uid()));
```

### Files
| File | Change |
|------|--------|
| New SQL migration | Add UPDATE policy for `storage.objects` on `revistas` bucket |

No code changes needed.

