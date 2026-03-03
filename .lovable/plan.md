

## Plano: Mover WhatsApp para o painel Admin geral

O menu e rota do WhatsApp estão atualmente no `/admin/ebd` (AdminEBDLayout). O objetivo é movê-lo para `/admin` (AdminLayout).

### Alterações

**1. Editar `src/App.tsx`**
- Remover `<Route path="whatsapp" element={<WhatsAppPanel />} />` de dentro de `/admin/ebd`
- Adicionar `<Route path="whatsapp" element={<WhatsAppPanel />} />` dentro de `/admin`
- Rota final: `/admin/whatsapp`

**2. Editar `src/components/admin/AdminLayout.tsx`**
- Adicionar item "WhatsApp" no sidebar com ícone `MessageSquare` e link para `/admin/whatsapp`

**3. Editar `src/components/admin/AdminEBDLayout.tsx`**
- Remover o item "WhatsApp" do sidebar (linhas ~411-417)

