
# Mover Integracoes e Emails EBD para o Admin Geral

## O que muda

1. **Menu "Integracoes"** sai do menu do vendedor (/vendedor/integracoes) e vai para o Admin EBD (/admin/ebd/integracoes), acessivel apenas para admin e gerente_ebd
2. **Menu "Emails EBD"** sai do menu do vendedor (/vendedor/emails-ebd) e vai para o Admin EBD (/admin/ebd/emails-ebd), acessivel para admin e gerente_ebd
3. Ambos os itens serao removidos do sidebar do vendedor

## Alteracoes tecnicas

### 1. Rotas (App.tsx)

- Remover as rotas `/vendedor/emails-ebd` e `/vendedor/integracoes` do bloco de rotas do vendedor
- Adicionar as rotas `/admin/ebd/emails-ebd` e `/admin/ebd/integracoes` dentro do bloco `<AdminEBDLayout>`
- O componente VendedorEmailsEBD precisara ser adaptado para nao depender do hook `useVendedor()` (que so funciona para vendedores logados), carregando todos os logs em vez de filtrar por vendedor
- O componente VendedorIntegracoes pode ser reutilizado diretamente pois ja usa `system_settings` global

### 2. Sidebar do Admin EBD (AdminEBDLayout.tsx)

- Adicionar dois novos itens de menu na secao "Configuracoes":
  - "Emails EBD" com icone Mail, link para `/admin/ebd/emails-ebd`
  - "Integracoes" com icone Settings, link para `/admin/ebd/integracoes`
- Ambos visiveis apenas para admin e gerente_ebd (nao para financeiro)

### 3. Sidebar do Vendedor (VendedorLayout.tsx)

- Remover as entradas `emails-ebd` e `integracoes` do array de menu items

### 4. Pagina Emails EBD (VendedorEmailsEBD.tsx)

- Remover a dependencia do `useVendedor()` -- a versao admin deve mostrar TODOS os logs, de todos os vendedores
- Na aba de historico, adicionar coluna "Vendedor" para identificar qual vendedor disparou
- A aba "Disparar Email" no admin deve permitir selecionar qualquer cliente (nao filtrado por vendedor)
- Renomear o componente para refletir o contexto admin (ou manter reutilizavel com prop)

### 5. Conteudo dos emails no historico

- Na tabela de historico, adicionar um botao "Ver" em cada linha que abre um dialog/modal com o HTML renderizado do email (usando o campo `dados_enviados` do log + template para reconstruir, ou armazenando o HTML final)
- Isso permitira inspecionar o conteudo exato de cada email enviado
