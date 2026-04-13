

## Plano: Adicionar botão "Atendimento" no painel dos vendedores

### O que será feito

Adicionar o item de menu "Atendimento" no sidebar do vendedor, com a mesma estilização verde (#25D366) usada no painel admin — fundo verde, texto branco, ícone MessageCircle e ponto pulsante.

### Implementação

**1. Criar rota `/vendedor/atendimento` no `src/App.tsx`**
- Reutilizar o componente `AtendimentoWhatsApp` já existente em `src/pages/admin/AtendimentoWhatsApp.tsx`
- Adicionar a rota dentro do bloco de rotas do vendedor

**2. Adicionar item no sidebar do vendedor (`src/components/vendedor/VendedorLayout.tsx`)**
- Adicionar `MessageCircle` aos imports do lucide-react
- Adicionar entrada `{ to: "/vendedor/atendimento", icon: MessageCircle, label: "Atendimento" }` no topo do array `allMenuItems` (logo após "Painel")
- Renderizar esse item específico com estilização especial: fundo `#25D366`, texto branco, ponto pulsante — idêntico ao que já existe no `AdminEBDLayout.tsx`

### Arquivos modificados
- `src/App.tsx` — nova rota
- `src/components/vendedor/VendedorLayout.tsx` — novo item de menu com estilização verde

