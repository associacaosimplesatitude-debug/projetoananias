
Objetivo: encerrar o erro persistente da integração WhatsApp com diagnóstico definitivo (não só “tentativa e erro”) e guiar a correção correta no Meta.

Diagnóstico consolidado (com evidência):
- Eu validei no backend com os mesmos dados salvos (Phone Number ID 1043748032148428, WABA ID 900583089532590 e token atual) e o retorno foi consistente:
  - `GET /{phone_number_id}` → erro `100 / subcode 33`
  - `GET /{waba_id}/phone_numbers` → erro `100 / subcode 33`
  - `POST /{phone_number_id}/messages` → erro `100 / subcode 33`
- Isso prova que o problema não está no frontend nem no payload do painel; é bloqueio de acesso no lado Meta (token/asset-contexto).
- Também há um segundo bloqueio visível nos prints: “Nenhuma forma de pagamento válida” (isso impacta envio para clientes fora da janela gratuita, depois que o acesso ao objeto for resolvido).

Do I know what the issue is?
- Sim: o token atual está válido em formato, mas sem acesso efetivo ao objeto WhatsApp (Phone Number/WABA) no contexto usado pela Graph API, apesar das permissões aparentes na UI.

Plano de implementação (código + operação):
1) Fortalecer diagnóstico da edge function `whatsapp-meta-test`
- Arquivo: `supabase/functions/whatsapp-meta-test/index.ts`
- Adicionar trilha de diagnóstico em `test_connection`:
  - Etapa A: validar token contra endpoint básico (`/me`) e retornar status claro.
  - Etapa B: testar acesso ao WABA e ao Phone Number separadamente, retornando qual falhou.
  - Etapa C: classificar `100/33` em causa provável objetiva:
    - token sem vínculo efetivo ao ativo,
    - app/contexto diferente do WABA,
    - permissão não propagada para aquele asset.
- Resposta estruturada nova:
  - `checks.token_valid`
  - `checks.waba_access`
  - `checks.phone_access`
  - `probable_cause`
  - `next_steps` (checklist acionável)
- Manter CORS e auth como estão (já corretos).

2) Melhorar UX do painel de credenciais para eliminar ambiguidade
- Arquivo: `src/pages/admin/WhatsAppPanel.tsx`
- Exibir resultado por etapas (Token / WABA / Phone) em vez de erro único.
- Mostrar ações objetivas quando vier `100/33`:
  - confirmar ativo WABA no mesmo Business do app,
  - regenerar token no mesmo app e mesmo System User após salvar permissões,
  - conferir que o Phone Number pertence ao WABA informado.
- Adicionar botão “Diagnóstico avançado” reutilizando `test_connection` com render detalhado do `checks`.

3) Checklist operacional Meta (fora do código, mas obrigatório para fechar)
- No Meta Business: garantir que o System User esteja atribuído ao ativo WABA correto (não só ao App).
- Gerar token novamente no mesmo app conectado ao produto WhatsApp.
- Confirmar que o Phone Number ID exibido no WhatsApp Manager pertence ao mesmo WABA ID.
- Resolver aviso de pagamento (“Adicionar forma de pagamento”) para permitir envios a clientes fora da janela grátis.

4) Validação final ponta a ponta (critério de aceite)
- Teste 1: “Testar Conexão” deve retornar:
  - `token_valid: true`
  - `waba_access: true`
  - `phone_access: true`
- Teste 2: “Enviar Teste” para número WhatsApp válido deve retornar sucesso sem `100/33`.
- Teste 3: validar no histórico/insights do WhatsApp Manager que a mensagem entrou como enviada.

Detalhes técnicos (resumo):
- Não haverá mudança de banco nem de RLS.
- A correção principal é de observabilidade + diagnóstico preciso no backend function e UI.
- O erro atual é de autorização de objeto no provedor externo (Meta), não de sintaxe de request nem de CORS local.

Sequência de execução (após sua confirmação):
1. Implementar melhorias em `whatsapp-meta-test`.
2. Atualizar render de diagnóstico no `WhatsAppPanel`.
3. Reexecutar testes de conexão/envio.
4. Te devolver relatório “antes/depois” com os retornos reais.
