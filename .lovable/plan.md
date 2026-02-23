

# Correção: Forçar deploy real do bling-generate-nfe

## Problema

A versão com herança simples (PASSO 1) existe no código fonte mas **não está rodando em produção**. O deploy anterior mudou apenas o comentário de versão, o que pode não ter sido suficiente para forçar um rebuild.

Evidência nos logs (23:37:33):
- Nenhum log de "PASSO 1" ou "herança simples"
- Foi direto para "Status criação (payload completo): 400"
- A NF-e 19276 foi criada sem vínculo ao pedido

## Solucao

### Acao 1: Modificar o codigo de forma substancial para forçar rebuild

Adicionar um timestamp de deploy como constante no inicio do arquivo e um log explicito no inicio da execucao para confirmar que a versao correta esta rodando:

```typescript
// v4 - FORCE REBUILD 2026-02-23T23:45
const DEPLOY_VERSION = 'v4-heranca-simples-2026-02-23';

// No inicio do serve():
console.log(`[BLING-NFE] ========== VERSÃO: ${DEPLOY_VERSION} ==========`);
```

### Acao 2: Deploy da funcao

Fazer o deploy usando a ferramenta de deploy de Edge Functions.

### Acao 3: Verificacao

Apos o deploy, o proximo pedido deve mostrar nos logs:
- `VERSÃO: v4-heranca-simples-2026-02-23`
- `PASSO 1: Tentando herança simples`

Se a heranca simples funcionar, o "V" laranja aparecera no Bling.
