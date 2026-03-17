

## Plan

### 1. Assign `gerente_ebd` role to gabriel.lourenco@editoracentralgospel.com

The user exists (ID: `3d1f77b8-3eb4-4f11-af5f-5f9faf331d5a`) but has **no role** assigned. I will insert a `gerente_ebd` role in the `user_roles` table via a database migration.

### 2. Restrict "Configurações" and "Google" menus to Admin only

In `src/components/admin/AdminEBDLayout.tsx`:

- **Current behavior**: "Configurações" is visible to admin and gerente_ebd (`!isFinanceiro`). "Google" is visible to all (admin, gerente_ebd, financeiro).
- **New behavior**: Both sections will only render when `isAdmin === true`.

Changes:
- Line 404: Change `{!isFinanceiro && (` to `{isAdmin && (`
- Line 500-501: Wrap the entire Google `<SidebarGroup>` with `{isAdmin && (` and close it after line 585.

### Technical Details

**Migration SQL:**
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('3d1f77b8-3eb4-4f11-af5f-5f9faf331d5a', 'gerente_ebd')
ON CONFLICT (user_id, role) DO NOTHING;
```

**AdminEBDLayout.tsx edits:**
- Line 404: `{!isFinanceiro && (` → `{isAdmin && (`
- Line 500: Add `{isAdmin && (` before Google SidebarGroup
- After line 585 (end of Google group): Add `)}` to close the conditional

