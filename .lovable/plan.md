# Plano

Vou corrigir o botão **Reenviar interesse pendentes** porque a chamada para `backfill-interesse-presente` está falhando antes mesmo da função começar a executar.

## O que encontrei
- O backend está saudável.
- A tela chama `backfill-interesse-presente` ao clicar no botão.
- A requisição do navegador falha com **Failed to fetch**.
- Não há logs de execução dessa função, o que indica que o problema está no deploy/entrypoint da função, não na lógica interna do processamento.
- Já a função `backfill-cliques-novidades-perdidos` tem logs de boot, então ela está ativa.

## O que vou fazer
1. **Validar a função `backfill-interesse-presente`**
   - Conferir o arquivo da função e o padrão usado nas outras funções que estão funcionando.
   - Identificar incompatibilidade de runtime, import, resposta HTTP ou configuração que impeça a função de subir.

2. **Corrigir a estratégia do botão**
   - Se a função estiver quebrada, ajustar para um fluxo estável:
     - ou consertar `backfill-interesse-presente`;
     - ou trocar o botão para chamar uma função já operacional, caso a responsabilidade real esteja duplicada.

3. **Melhorar a tolerância a falhas na tela**
   - Ajustar o tratamento do erro para mostrar uma mensagem útil quando a função estiver indisponível.
   - Garantir refresh do kanban após sucesso real.

4. **Validar ponta a ponta**
   - Confirmar que a função passa a responder sem erro de rede.
   - Verificar que o botão executa e retorna contadores válidos.
   - Confirmar que a coluna **Interessado** volta a refletir os registros recuperados/enviados.

## Detalhes técnicos
- Arquivos mais prováveis:
  - `src/pages/admin/EbdRetencao.tsx`
  - `supabase/functions/backfill-interesse-presente/index.ts`
  - possivelmente `supabase/config.toml` se houver configuração específica necessária
- Sinal principal de sucesso:
  - a chamada `functions.invoke("backfill-interesse-presente")` deixa de falhar com **Failed to fetch** e passa a retornar JSON.