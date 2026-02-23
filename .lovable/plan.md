

# Solucao: Nova funcao leve para heranca simples (bypass do deploy travado)

## Problema

O deploy da funcao `bling-generate-nfe` (1549 linhas) nao esta tomando efeito. Ja tentamos 3 vezes - o codigo fonte tem o PASSO 1 (heranca simples), mas os logs confirmam que a versao antiga continua rodando. A funcao possivelmente e grande demais para o bundler processar corretamente.

## Estrategia

Criar uma funcao nova e pequena (`bling-nfe-simple`) que faz APENAS a heranca simples. Atualizar o front-end para tentar esta funcao primeiro. Se funcionar, a NF-e ja vem vinculada ao pedido (icone "V" laranja). Se falhar, chama a funcao antiga como fallback.

## Passos

### 1. Criar funcao `supabase/functions/bling-nfe-simple/index.ts` (~100 linhas)

Funcao minima que:
- Recebe `bling_order_id`
- Busca token do Bling na tabela `bling_config`
- Faz POST para `https://api.bling.com.br/Api/v3/nfe` com payload `{ idPedidoVenda: orderId }`
- Se der 201/200 com ID, envia para SEFAZ via POST `nfe/{id}/envio`
- Retorna sucesso com o ID da NF-e criada

### 2. Adicionar configuracao no `supabase/config.toml`

```toml
[functions.bling-nfe-simple]
verify_jwt = true
```

### 3. Atualizar front-end - `src/pages/vendedor/VendedorPDV.tsx`

Trocar a chamada direta a `bling-generate-nfe` por:
1. Tentar `bling-nfe-simple` primeiro
2. Se falhar, chamar `bling-generate-nfe` como fallback

### 4. Atualizar front-end - `src/components/shopify/VendaConcluidaDialog.tsx`

Mesma logica de fallback.

### 5. Deploy da nova funcao

Deploy automatico da `bling-nfe-simple`.

## Por que isso resolve

- Funcao nova e pequena, deploy confiavel
- Heranca simples vincula a NF-e ao pedido automaticamente (icone "V")
- Fallback garante que se a heranca simples falhar, o sistema ainda gera a nota pela funcao antiga
- Nao depende de conseguir deploiar a funcao grande de 1549 linhas

