

## Plano: Landing Page de Campanha WhatsApp — Oferta EBD com Reativação

### O que será construído
Uma LP exclusiva em `/oferta-ebd` para clientes que recebem a mensagem WhatsApp de reativação. Destaca o desconto de 20%, o presente (acesso ao Gestão EBD) com todos os benefícios, e dois CTAs que abrem modal de formulário.

### Alterações

**1. Criar `src/pages/OfertaEBD.tsx`**
Página completa com:
- **Hero**: Banner de impacto com "20% DE DESCONTO" + "PRESENTE: Acesso ao Gestão EBD", usando as 4 imagens anexadas (revistas) + `dashboard-notebook.png` existente
- **Seção Revistas com Desconto**: Cards mostrando as revistas com badge "20% OFF", usando as imagens anexadas (`epistolas.webp`, `imgi_11_...webp`, `WhatsApp_Image...webp`, `image-1772559168.png`)
- **Seção Presente — Gestão EBD**: Reutilizar os mesmos assets e features da `LandingEBD.tsx`:
  - `dashboard-notebook.png` — Painel do Superintendente
  - `lista-professores.png` — Gestão de Professores
  - `ranking-alunos.png` — Ranking e Gamificação
  - `catalogo-materiais.png` — Catálogo de Materiais
  - Lista completa de benefícios (KPIs, Turmas, Frequência, Comunicação)
- **Dois botões CTA fixos** ao longo da página:
  - "QUERO MEU DESCONTO" → abre modal
  - "QUERO MEU ACESSO GRÁTIS" → abre modal
- **Modal de Formulário**: Dialog com campos (nome igreja, nome, email, telefone, senha, como conheceu). Submete via `ebd-instant-signup` com `origemLead: 'Campanha WhatsApp Reativação'`
- **Footer** com logo Gestão EBD

**2. Editar `src/App.tsx`**
- Adicionar rota pública: `<Route path="/oferta-ebd" element={<OfertaEBD />} />`

### Assets utilizados
- **Existentes** (de `src/assets/landing/`): `logo-gestao-ebd.png`, `dashboard-notebook.png`, `ranking-alunos.png`, `lista-professores.png`, `catalogo-materiais.png`
- **Anexadas** (4 imagens): usadas diretamente via `user-uploads://` para as revistas na seção de desconto

### Sem migração necessária
Reutiliza a edge function `ebd-instant-signup` existente com campo `origemLead` diferenciado.

