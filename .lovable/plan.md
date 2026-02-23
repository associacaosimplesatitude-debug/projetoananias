

# Correções no Painel Google Ads

## Problemas identificados

### 1. Linha duplicada na Edge Function (bug critico)
No arquivo `supabase/functions/google-ads-data/index.ts`, linha 77 tem um `return` duplicado que foi introduzido no ultimo edit. Isso pode causar comportamento inesperado.

### 2. Notas fiscais - busca apenas mes atual
O painel busca invoices apenas do mes atual (fevereiro 2026), mas provavelmente nao existem notas para este mes ainda. Precisa permitir selecionar o mes/ano para buscar notas de meses anteriores.

### 3. "Adicionar Fundos" nao funciona
O botao usa `window.open()` que e bloqueado dentro do iframe do preview. Precisa usar uma tag `<a>` com `target="_blank"` e `rel="noopener noreferrer"` em vez de `window.open`.

## Alteracoes

### Arquivo 1: `supabase/functions/google-ads-data/index.ts`
- Remover a linha 77 duplicada (`return new Response(null, ...)`)

### Arquivo 2: `src/pages/admin/GoogleAdsPanel.tsx`

1. **Seletor de mes/ano para invoices**: Adicionar dois selects (mes e ano) na secao de Documentos Fiscais, permitindo buscar notas de qualquer mes. Default: mes anterior (janeiro 2026).

2. **Corrigir botao "Adicionar Fundos"**: Trocar o `<Button onClick={window.open(...)}` por um `<a href="..." target="_blank">` estilizado como botao, para funcionar corretamente dentro de iframes.

3. **Corrigir botoes de download PDF das notas**: Mesmo problema - trocar `window.open` por tags `<a>` com `target="_blank"`.

4. **Buscar ultimo mes por padrao**: Alterar `fetchInvoices` para buscar o mes anterior por padrao (onde e mais provavel ter notas), com opcao de mudar.

