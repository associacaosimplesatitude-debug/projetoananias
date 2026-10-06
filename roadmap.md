# Roadmap

- [x] Registrar migration da permissão pública de `get_resumo_diario_publico(date)`
- [x] Limpeza/otimização da auditoria de propostas (trigger + índices + purge de ruído)
- [x] Reduzir escrita da sincronização de marketplace (só grava o que mudou, em lotes)
- [ ] Otimizar telas pesadas (colunas específicas + cache)
- [x] Segurança: auth/cron-secret nas funções de comissão (unauth_commission_cron)
- [x] Segurança: create-aluno-public (aluno_public_takeover)
- [x] Segurança: whatsapp-upload-template-media (wa_upload_media_ssrf)
- [x] Corrigir login preso em “Processando...” sem bloquear por atualizações secundárias
- [x] Corrigir rota e chamadas legadas de “Atribuir Clientes” (chamado #0184)
- [x] Ocultar pedidos somente digitais em “Atribuir Clientes” sem afetar “Pedidos Online”
- [x] Adicionar busca e filtro por tipo ao seletor de material da licença manual (chamado #197)
- [x] Corrigir “% Meta” do card individual de vendedor para sempre arredondar para baixo
- [x] Unir os itens do menu AdminEBD para usuários com múltiplos papéis
- [x] Remover duplicidade por `bling_order_id` no card Performance de Vendedores
- [x] Corrigir guardas das rotas administrativas para usuários com múltiplos papéis
- [x] Adicionar a aba Templates ao painel de Marketing
- [x] Devolver os controles nativos de navegação ao PDF do Modo Kindle
