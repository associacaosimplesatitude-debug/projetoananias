## Bug

Ao clicar nas setas ◀ ▶ do lightbox de visualização de páginas, o modal pai (`Dialog` do Radix) fecha junto. Causa: o lightbox renderiza por cima do `DialogContent` mas, no DOM, fica fora dele — o Radix detecta o clique como "outside" e dispara `onPointerDownOutside` → fecha o Dialog → o `onOpenChange` zera `previewRevista` e `lightboxIndex`.

## Correção

Em `src/pages/admin/RevistasDigitais.tsx`, no `<DialogContent>` do modal de preview (linha ~1398), bloquear o fechamento automático enquanto o lightbox estiver aberto:

```tsx
<DialogContent
  className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
  onPointerDownOutside={(e) => { if (lightboxIndex !== null) e.preventDefault(); }}
  onInteractOutside={(e) => { if (lightboxIndex !== null) e.preventDefault(); }}
  onEscapeKeyDown={(e) => { if (lightboxIndex !== null) e.preventDefault(); }}
>
```

Resultado:
- Setas ◀ ▶ avançam/retornam sem fechar o modal.
- Esc no lightbox fecha só o lightbox (o handler de teclado já existente já trata isso); o Esc só atinge o Dialog quando o lightbox já estiver fechado.
- Clicar fora continua fechando o Dialog normalmente quando o lightbox não está aberto.

## Restrições

- Mudança de 1 linha → 5 linhas em um único componente.
- Sem alteração de schema, query, RLS ou outro arquivo.
