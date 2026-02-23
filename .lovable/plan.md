
# Correção: Deploy da versão atualizada do bling-generate-nfe

## Problema encontrado

A análise dos logs confirma que a **versão antiga** da Edge Function `bling-generate-nfe` ainda está rodando em produção. A evidência:

- Os logs mostram "PASSO 2" e "PASSO 3", mas **nenhum "PASSO 1"** com "Herança simples"
- O log mostra `Status criação (payload completo): 400` -- foi direto para payload completo manual
- A NF-e 019275 foi criada **sem vínculo** ao pedido porque usou payload manual

O código no arquivo já tem a lógica correta (herança simples nas linhas 405-443), mas o **deploy não foi aplicado** na última atualização.

## Solução

### Ação 1: Redeploiar a Edge Function

Forçar o redeploy de `bling-generate-nfe` para que a versão com herança simples entre em produção.

### Ação 2: Verificar via logs

Após o deploy, o próximo pedido Penha deve gerar logs com:
- `PASSO 1: Tentando herança simples (idPedidoVenda: ...)` 
- `Herança simples - Status: ...`
- Se funcionar: `HERANÇA SIMPLES FUNCIONOU!`

Nenhuma alteração de código é necessária -- apenas o redeploy da função.
