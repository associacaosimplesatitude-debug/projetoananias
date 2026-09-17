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
