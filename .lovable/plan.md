

# Fechar Sidebar no Mobile ao Clicar no Menu

## Problema
No mobile, o sidebar abre como um painel lateral (Sheet), mas ao clicar em um item do menu, o sidebar permanece aberto, exigindo que o usuario feche manualmente.

## Solucao
Usar o hook `useSidebar` dentro do componente `EBDSidebar` para acessar a funcao `setOpenMobile`. Ao clicar em qualquer item do menu, chamar `setOpenMobile(false)` para fechar o sidebar automaticamente.

## Secao Tecnica

### Arquivo: `src/components/ebd/EBDLayout.tsx`

1. Importar `useSidebar` do componente de sidebar
2. No componente `EBDSidebar`, chamar `const { setOpenMobile } = useSidebar()`
3. Envolver cada `RouterNavLink` com um `onClick` que chama `setOpenMobile(false)`

Exemplo da mudanca em cada item de menu:
```tsx
<RouterNavLink to="/ebd/dashboard" end onClick={() => setOpenMobile(false)}>
```

Isso sera aplicado a todos os 11 itens de menu do sidebar. Nenhuma outra alteracao necessaria.

