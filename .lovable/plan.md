

## Plano: Criar página de Política de Privacidade

A Meta exige uma URL de política de privacidade válida para publicar o app. Vou criar uma página pública acessível em `/politica-de-privacidade`.

### O que será feito

1. **Criar `src/pages/PoliticaPrivacidade.tsx`** — Página pública com política de privacidade completa cobrindo:
   - Dados coletados (nome, telefone, e-mail via WhatsApp)
   - Finalidade do uso dos dados
   - Compartilhamento com terceiros (Meta/WhatsApp API)
   - Armazenamento e segurança
   - Direitos do usuário (acesso, correção, exclusão)
   - Contato para questões de privacidade
   - Design limpo, responsivo, sem necessidade de login

2. **Registrar rota em `src/App.tsx`** — Adicionar `<Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />` como rota pública (junto das outras rotas públicas como `/auth`, `/gestao-ebd`, etc.)

### URL final
`https://gestaoebd.lovable.app/politica-de-privacidade` — pronta para colar no campo "Privacy Policy URL" do Meta Developers.

