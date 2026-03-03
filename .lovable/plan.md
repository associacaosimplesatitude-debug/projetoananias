
Objetivo: fazer com que respostas recebidas no WhatsApp apareçam no painel de conversas de forma confiável (incluindo mensagens enviadas e recebidas).

Diagnóstico confirmado
- O problema não está na tela do chat: está na ingestão do webhook.
- Banco mostra que `whatsapp_conversas` e `whatsapp_webhooks` pararam em 20/02.
- Não existe nenhum payload Meta salvo (`payload ? 'entry' = 0`), então as respostas da Meta não estão chegando no backend atual.
- `whatsapp_mensagens` tem envios mais recentes, mas sem novos recebimentos correlatos.
- Hoje o fluxo depende de URL/path exato do webhook + token fixo no código, o que é frágil.

Plano de implementação

1) Tornar o webhook Meta resiliente ao path (correção principal)
- Arquivo: `supabase/functions/whatsapp-webhook/index.ts`
- Ajustar detecção Meta para não depender apenas de `lastSegment === "whatsapp-meta-webhook"`.
- Regra nova:
  - Se `GET` com `hub.mode/hub.verify_token/hub.challenge` => tratar como verificação Meta.
  - Se `POST` com payload contendo `entry[].changes[]` => tratar como evento Meta.
- Assim funciona mesmo se o callback estiver configurado como:
  - `/functions/v1/whatsapp-webhook`
  - ou `/functions/v1/whatsapp-webhook/whatsapp-meta-webhook`.

2) Remover token hardcoded e usar configuração salva
- Arquivo: `supabase/functions/whatsapp-webhook/index.ts`
- Em vez de comparar com `"centralgospel123"` fixo:
  - buscar `whatsapp_verify_token` em `system_settings`;
  - fallback para `"centralgospel123"` só se não houver valor.
- Isso evita quebra quando token for alterado na tela de Integrações.

3) Persistência completa de mensagens Meta
- Arquivo: `supabase/functions/whatsapp-webhook/index.ts`
- Processar todos os itens de `messages[]` (não só o primeiro).
- Para cada mensagem:
  - extrair texto/imagem/áudio/interativo;
  - salvar em `whatsapp_conversas` com `role: "user"`;
  - manter auditoria em `whatsapp_webhooks` com evento padronizado (ex.: `meta_message` / `meta_status`).
- Manter normalização de telefone e vínculo com `cliente_id` por variantes.

4) Compatibilidade com endpoint legado (blindagem)
- Arquivo: `supabase/functions/whatsapp-meta-webhook/index.ts`
- Como esse endpoint antigo ainda existe no projeto e pode estar configurado no Meta:
  - alinhar comportamento para usar o mesmo token/config e persistir em `whatsapp_conversas`,
  - ou transformá-lo em proxy para a lógica principal.
- Resultado: mesmo se o callback no Meta estiver no endpoint antigo, as mensagens entram no chat.

5) Ajuste visual mínimo de integração (evitar regressão de configuração)
- Arquivo: `src/pages/vendedor/VendedorIntegracoes.tsx`
- Mostrar instrução explícita de URL recomendada e validar token usado.
- Exibir “último webhook recebido em …” (lendo `whatsapp_webhooks`) para diagnóstico rápido.

Validação pós-implementação (obrigatória)
1. Verificação do webhook:
- Executar verificação Meta (GET challenge) e confirmar 200 com challenge correto.
2. Teste real:
- Enviar mensagem para um número de teste e responder pelo celular.
- Confirmar nova linha em:
  - `whatsapp_webhooks` (evento Meta recente),
  - `whatsapp_conversas` (role `user` com horário atual).
3. Tela `/admin/whatsapp`:
- Confirmar que a conversa aparece/atualiza sem precisar workaround.
4. Teste ponta a ponta:
- Validar envio manual + resposta do cliente + exibição no mesmo thread.

Detalhes técnicos (resumo)
- Sem migração de banco.
- Arquivos alvo:
  - `supabase/functions/whatsapp-webhook/index.ts` (principal)
  - `supabase/functions/whatsapp-meta-webhook/index.ts` (compatibilidade)
  - `src/pages/vendedor/VendedorIntegracoes.tsx` (orientação/diagnóstico)
- Risco principal mitigado: dependência de URL exata e token hardcoded, que hoje bloqueiam ingestão silenciosamente.
