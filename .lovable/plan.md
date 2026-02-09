

# Plano: Melhorar Contraste dos Botoes no Sistema EBD

## Problema

O dominio EBD aplica `#FFC107` (amarelo vivo) como cor primaria via CSS variables. Todos os botoes que usam `bg-primary text-primary-foreground` ficam **amarelo com texto branco** — contraste muito baixo e dificil leitura.

A causa esta no arquivo `src/contexts/DomainBrandingContext.tsx` (linha 44), que sobrescreve `--primary` com o valor de `#FFC107`, mas **nao atualiza** `--primary-foreground` para uma cor escura.

## Solucao

Duas mudancas simples que resolvem o problema em **todo o sistema** de uma vez:

### 1. Escurecer a cor primaria (de amarelo vivo para dourado escuro)

**Arquivo:** `src/hooks/useDomainBranding.tsx`

Mudar a `primaryColor` do EBD de `#FFC107` (amarelo vivo) para `#B8860B` (dourado escuro / "DarkGoldenrod"). Isso mantem a identidade visual dourada, mas com contraste muito melhor com texto branco.

| Antes | Depois |
|-------|--------|
| `#FFC107` (amarelo vivo, contraste 1.9:1 com branco) | `#B8860B` (dourado escuro, contraste 3.8:1 com branco) |

### 2. Aplicar foreground escuro como fallback

**Arquivo:** `src/contexts/DomainBrandingContext.tsx`

Alem de aplicar `--primary`, tambem aplicar `--primary-foreground` com cor escura (`0 0% 100%` branco se o primario for escuro o suficiente, ou `0 0% 10%` preto se o primario for claro). Isso garante contraste adequado independente do tom escolhido.

Adicionar na linha 45:
```tsx
root.style.setProperty('--primary-foreground', '0 0% 100%');
```

### 3. Ajustar accentColor para combinar

**Arquivo:** `src/hooks/useDomainBranding.tsx`

Mudar `accentColor` de `#FFC107` para `#D4A017` (dourado medio) para manter harmonia visual nos elementos de destaque sem problemas de contraste.

## Resultado Esperado

- Botoes como "Lancamento Manual" ficarao com fundo dourado escuro e texto branco legivel
- Toda a identidade visual dourada do EBD e mantida
- A mudanca afeta automaticamente **todos os botoes e elementos** que usam a cor primaria em todo o sistema
- Nenhuma alteracao em componentes individuais necessaria

## Arquivos Alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useDomainBranding.tsx` | Atualizar `primaryColor` e `accentColor` para tons mais escuros |
| `src/contexts/DomainBrandingContext.tsx` | Aplicar `--primary-foreground` junto com `--primary` |

