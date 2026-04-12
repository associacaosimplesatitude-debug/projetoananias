

## Adicionar "Atendimento WhatsApp" ao sidebar Admin EBD

### Arquivos a criar

**1. `src/pages/admin/AtendimentoWhatsApp.tsx`**
- Componente com cabeçalho mínimo (ícone WhatsApp verde + título + botão "Abrir em nova aba")
- iframe full-width apontando para `https://crm.houseassessoria.com.br/login`
- Sem padding extra — o main do layout já tem `p-6`, então vamos usar margin negativo ou override para o iframe preencher o espaço

### Arquivos a modificar

**2. `src/components/admin/AdminEBDLayout.tsx`**
- Adicionar item "Atendimento WhatsApp" no TOPO do sidebar (antes do grupo "Voltar ao Admin Geral")
- Estilização especial: fundo verde `#25D366`, texto branco, hover `#1ebe5d`
- Ponto verde pulsante animado ao lado
- Ícone `MessageCircle` do lucide-react
- Link para `/admin/ebd/atendimento-whatsapp`
- Visível para todos os roles (inclusive gerente_sorteio)

**3. `src/App.tsx`**
- Adicionar rota `atendimento-whatsapp` como child de `/admin/ebd` (linha ~580)
- Componente: `AtendimentoWhatsApp`

### Detalhes técnicos

- O item do sidebar usará estilos inline para o fundo verde, ignorando os estilos padrão do `SidebarMenuButton`
- A animação de pulso usará `animate-pulse` do Tailwind em um pequeno dot
- A página terá `overflow: hidden` e o `main` padding será compensado com margin negativo para o iframe ocupar tudo

