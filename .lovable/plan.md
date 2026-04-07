

## Problem Diagnosis

The quiz buttons don't appear because the edge functions `buscar-quiz-licao` and `salvar-quiz-publico` are called **without authentication** (public portal readers use WhatsApp OTP, not Supabase Auth). However, these functions are **missing `verify_jwt = false`** in `supabase/config.toml`, so every call returns a **401 Unauthorized** error silently (the `.catch(() => {})` swallows the error).

The database has 13 quizzes ready — the data is there, but inaccessible.

## Fix

**File: `supabase/config.toml`** — Add two entries:

```toml
[functions.buscar-quiz-licao]
verify_jwt = false

[functions.salvar-quiz-publico]
verify_jwt = false
```

No other files need changes. The UI code and edge function logic are correct — they just can't be reached due to JWT verification blocking unauthenticated requests.

