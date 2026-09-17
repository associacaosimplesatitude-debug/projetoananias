# Corrigir “Atribuir Clientes” — chamado #0184

## Objetivo
Fazer o item “Atribuir Clientes” abrir uma página própria de atribuição, sem exibir “Pedidos Online” e sem chamar funções antigas desativadas.

## Plano
1. Criar uma entrada de página dedicada para “Atribuir Clientes” e registrar uma rota própria no painel administrativo.
2. Reaproveitar apenas a listagem e o formulário de atribuição existentes, mantendo a página “Pedidos Online” e os demais itens do menu inalterados.
3. Na página de atribuição, ocultar comandos legados de sincronização e impedir a sincronização automática de itens que chama uma função desativada e retorna HTTP 410.
4. Atualizar somente o link “Atribuir Clientes” para a nova rota.
5. Validar no navegador que o menu abre o título correto, a rota dedicada permanece ativa e nenhuma Edge Function com erro é chamada ao carregar ou abrir um pedido.

## Detalhes técnicos
- Nova rota: `/admin/ebd/atribuir-clientes`.
- O caminho legado `/admin/ebd/pedidos-igrejas` será redirecionado para a nova rota, preservando favoritos antigos.
- A tela existente continuará com seu comportamento padrão quando acessada fora do modo de atribuição.
- Nenhuma função antiga será reativada ou alterada.
