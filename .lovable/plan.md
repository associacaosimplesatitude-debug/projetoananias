
## Objetivo

No PDV do vendedor (`/vendedor/shopify`), permitir escolher de qual depósito do Bling o produto sai. Quando a quantidade solicitada exceder o saldo de um depósito, o sistema sugere dividir automaticamente entre depósitos disponíveis, gerando **uma proposta por depósito**, cada uma com o frete calculado a partir do CEP daquela origem.

## Como vai funcionar (fluxo do vendedor)

1. **Busca de produto** — cada card passa a mostrar o saldo por depósito (Geral 437, LOJA PENHA 61, PERNANBUCO [ALFA] 424, etc.), listando dinamicamente qualquer depósito com saldo > 0.
2. **Adicionar ao carrinho**
   - Se a quantidade cabe em um único depósito → escolhe o depósito num dropdown ao lado do "Adicionar" (padrão: o de maior saldo). Uma linha no carrinho.
   - Se a quantidade excede o maior depósito → abre um **diálogo de divisão** sugerindo automaticamente a distribuição (ex.: 480 = 437 Geral + 43 Penha). Vendedor pode ajustar antes de confirmar. Isso cria N linhas no carrinho (uma por depósito).
3. **Sobrescrever manualmente** — cada linha do carrinho tem um dropdown de depósito, permitindo mudar depois; se o novo depósito não tem saldo suficiente, avisa e sugere dividir.
4. **Gerar proposta** — ao confirmar, o sistema **agrupa itens por depósito** e gera **uma proposta separada por depósito**. Cada proposta:
   - Contém somente os itens daquele depósito
   - Calcula frete usando o CEP de origem cadastrado para aquele depósito
   - Mostra ao vendedor um resumo ("2 propostas serão geradas — Matriz RJ (437 un, frete R$ X) e LOJA PENHA (43 un, frete R$ Y)") para confirmar antes de disparar
5. Cada proposta segue o fluxo atual (link para cliente, WhatsApp, faturamento, etc.).

## Escopo técnico

### Backend (Edge Functions)

- **`bling-search-product`**: hoje devolve só `estoque` consolidado. Passar a devolver também `saldosPorDeposito: [{ id, nome, saldo }]` chamando `/estoques/saldos?idsProdutos[]=` já no fluxo de busca (ou lazy no primeiro `add`). Já usamos esse endpoint em `bling-check-stock`, então é copiar a lógica de `item.saldos[]`.
- **`bling-check-stock`**: adicionar campo opcional `deposito_id` no input e retornar saldo do depósito específico (para revalidar no `add`).
- Nenhuma outra edge function precisa mudar; a criação de propostas é feita client-side em `handleGeneratePropostaLink`.

### Banco (migração)

- Nova tabela `bling_depositos_config` (id_bling, nome, cep_origem, cidade, uf, ativo_pdv, ordem). Popular inicialmente com Geral (CEP matriz RJ), LOJA PENHA (CEP Penha) e PERNANBUCO [ALFA] (CEP PE). Editável só por superadmin.
- Coluna `deposito_id` e `deposito_nome` em `vendedor_propostas` (para rastrear origem da proposta e usar no cálculo de comissão/logística).

### Frontend

- `src/lib/bling.ts` — extender `BlingVariant` com `saldosPorDeposito: {depositoId, nome, saldo}[]`. Manter `stockTotal` para compatibilidade.
- `src/pages/shopify/ShopifyPedidos.tsx`
  - Card do produto: badge "Em estoque: 922 un." vira lista compacta (Geral 437 · Penha 61 · PE 424).
  - Handler de "Adicionar": se qty ≤ maior saldo, adiciona com dropdown; se qty > maior saldo, abre novo `DividirDepositoDialog`.
  - Cart item: novo campo `depositoId`/`depositoNome`; dropdown inline para trocar; agrupar visualmente por depósito.
  - `handleGeneratePropostaLink`: iterar sobre grupos por depósito, criar N registros em `vendedor_propostas`, calcular frete de cada uma usando o CEP do depósito (chamando a rota de cotação já existente com origem sobrescrita).
  - Novo diálogo `ConfirmarSplitPropostasDialog` antes de disparar, mostrando as N propostas com frete de cada.
- Novo componente `src/components/shopify/DividirDepositoDialog.tsx` — sugere distribuição, permite editar quantidades por depósito, valida soma == qty pedida.
- Frete: onde hoje calculamos frete (transportadora/PAC), passar `cepOrigem` do depósito em vez do CEP fixo da matriz. Se o serviço de cotação for chamado por edge function, adicionar parâmetro `cep_origem` opcional.

### Fora de escopo

- Reserva de estoque no Bling (continua sendo saldo consultivo).
- Alteração no fluxo de "Pagar na loja / retirada" existente — apenas reaproveita o mesmo conceito de `deposito_origem`.
- Vendedor não filtra depósitos por polo — todos os depósitos com saldo aparecem para todos os vendedores.

## Entregáveis

```text
supabase/migrations/<ts>_bling_depositos_config.sql
supabase/functions/bling-search-product/index.ts   (retornar saldosPorDeposito)
supabase/functions/bling-check-stock/index.ts      (aceitar deposito_id)
src/lib/bling.ts                                    (novo tipo)
src/pages/shopify/ShopifyPedidos.tsx                (card, carrinho, split)
src/components/shopify/DividirDepositoDialog.tsx    (novo)
src/components/shopify/ConfirmarSplitPropostasDialog.tsx (novo)
src/components/shopify/FormaEnvioSection.tsx        (origem por depósito)
```

## Perguntas em aberto (posso assumir defaults na implementação)

- CEPs de origem: assumo que você me passa os 3 CEPs (Matriz RJ, Loja Penha, PE Alfa) ou cadastro placeholders e você preenche depois pela UI de admin.
- Comissão/relatórios: cada proposta filha entra normal nos relatórios do vendedor (não vou criar agrupamento "proposta-mãe" — se quiser depois, é um follow-up).
