

## Plano: Botão "Testar Landing Page" no Dashboard Admin

### Alteração: `src/pages/admin/Dashboard.tsx`

- Adicionar função `handleTestarLandingPage` que busca o token mais recente de `campaign_links` (order by `created_at desc`, limit 1)
- Se encontrar token → abre `/oferta/{token}` em nova aba via `window.open`
- Se não encontrar → mostra toast informando que não há links gerados
- Adicionar botão "🔍 Testar Landing Page" ao lado do título "Painel Administrativo"
- Importar `toast` de `sonner` e `Search` de `lucide-react`

