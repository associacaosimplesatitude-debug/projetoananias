

# Melhorias no Funil de Vendas

## 1. Corrigir logica das etapas usando `ultimo_login`

A logica atual usa `status_ativacao_ebd` para determinar se o cliente fez login, o que e impreciso. A nova logica sera:

- **Aguardando Login**: `ultimo_login IS NULL` (nunca logou, independente do status_ativacao)
- **Pendente Config**: `ultimo_login IS NOT NULL` E `onboarding_concluido = false` (logou mas nao configurou)
- **Ativos**: `ultimo_login IS NOT NULL` E `onboarding_concluido = true` E login nos ultimos 30 dias

## 2. Mostrar email e senha de acesso na lista expandida

Os campos `email_superintendente` e `senha_temporaria` da tabela `ebd_clientes` serao exibidos na lista expandida de cada etapa (exceto "Primeira Compra" que vem de outra tabela).

Exemplo de como ficara cada item da lista:

```text
ADVEC SAO JOAO DE MERITI
  Tel: 21999999999
  Email: gilsoncost5@gmail.com | Senha: mudar123
  Ultimo login: nunca
```

## 3. Mostrar data do ultimo login

Na lista expandida, exibir a data formatada do `ultimo_login` ou "Nunca" se for nulo.

## 4. Mostrar valor total das primeiras compras

No card "Primeira Compra", alem do numero de clientes, exibir o valor total somado (atualmente R$ 105.852,82). Sera necessario criar uma nova RPC ou ajustar a existente para retornar tambem o valor total.

## 5. Novo layout visual tipo funil

Trocar o layout atual de 5 cards lado a lado por um layout vertical em formato de funil, inspirado na imagem de referencia:

- Cada etapa e uma barra horizontal com largura decrescente (de cima para baixo)
- O numero fica dentro da barra, centralizado
- O label/descricao fica ao lado direito, fora da barra
- Cores degradando de vermelho/laranja no topo para verde na base
- Ao clicar numa barra, expande a lista de clientes abaixo

```text
|========= 517 =========|  Primeira Compra (R$ 105.852)
  |======= 355 =======|    Aguardando Login
    |===== 140 =====|      Pendente Config.
      |=== 2 ===|           Ativos
        |= 0 =|            Zona de Renovacao
```

## Resumo tecnico das alteracoes

### Banco de dados
- Criar RPC `get_primeira_compra_funil_total` (ou ajustar a count existente) para retornar tambem a soma dos valores

### Arquivo: `src/pages/vendedor/VendedorFunil.tsx`
1. **Corrigir queries** das etapas 2-4 para usar `ultimo_login IS NULL / IS NOT NULL` em vez de `status_ativacao_ebd`
2. **Adicionar campos** `email_superintendente`, `senha_temporaria`, `ultimo_login` no select das etapas que consultam `ebd_clientes`
3. **Exibir** email, senha e data do login na lista expandida
4. **Buscar e exibir** o valor total das primeiras compras no card
5. **Redesenhar** o layout dos cards para formato de funil vertical com barras de largura decrescente, numero dentro e descricao fora

