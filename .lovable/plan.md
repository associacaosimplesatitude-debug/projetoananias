## Diagnóstico

Consultei o banco e confirmei que **as imagens existem** — o problema é apenas de **exibição**:

| Item | `total_licoes` (BD) | Páginas reais em `revista_licoes.paginas` |
|---|---|---|
| Infográfico Cativeiro Babilônico | 0 | **16** |
| Infográfico 4º Tri 2025 | 0 | **15** |
| Infográfico 3º Tri 2025 | 0 | **13** |
| Livro Autoridade Espiritual (Malafaia) | 0 | **144** |
| Livro Senhor Ensina-nos a Orar (Cerullo) | 0 | **376** |
| Livro O Líder Acolhedor | 0 | **272** |
| Livro Cartas da Prisão | 0 | **200** |
| ... (todos livros/infográficos) | **0** | dezenas a centenas |

### Causas

1. **Coluna "Lições" vazia (`—`)**: o código (linha 1213-1214) lê `r.total_licoes`, mas todos os livros/infográficos antigos foram migrados com `total_licoes = 0`. O upload novo já grava certo (linha 549), mas os legados ficaram desatualizados.
2. **Modal de edição não mostra páginas**: o bloco "Páginas do Livro / Páginas do Infográfico" (linha 1124-1165) tem **só o botão "Selecionar Páginas"** — não lista nem conta o que já está salvo. Por isso "aparece vazio" ao editar, mesmo com 144/376/200 imagens no banco.
3. Revistas comuns NÃO têm esse problema porque usam o fluxo de "Gerir Lições" separado, que lista as páginas. Não vou tocar em nada delas.

## O que fazer

### 1. Migration de backfill (corrige todos os legados de uma vez)

Atualizar `revistas_digitais.total_licoes` para igualar à soma de `array_length(paginas)` das lições associadas, **somente** onde `tipo_conteudo IN ('livro_digital','infografico')`. Não toca em nenhum registro de `revista`.

```sql
UPDATE revistas_digitais rd
SET total_licoes = sub.total
FROM (
  SELECT revista_id, SUM(COALESCE(array_length(paginas,1),0))::int AS total
  FROM revista_licoes GROUP BY revista_id
) sub
WHERE rd.id = sub.revista_id
  AND rd.tipo_conteudo IN ('livro_digital','infografico');
```

Após rodar: a coluna "Lições" da listagem passa a mostrar "16 páginas", "144 páginas", "376 páginas" etc. (a lógica de exibição já existe na linha 1213-1214, só faltava o dado).

### 2. Modal de edição — bloco "Páginas do Livro / Infográfico"

No componente `src/pages/admin/RevistasDigitais.tsx`, dentro do bloco `(tipoConteudo === 'livro_digital' || tipoConteudo === 'infografico') && editingRevista` (linha 1124), adicionar **acima** do botão "Selecionar Páginas":

- **Card-resumo visual** com:
  - Ícone + número grande: `📄 144 páginas cadastradas` (lê de `editingRevista.total_licoes` ou faz `count` direto da query).
  - Texto auxiliar: "Última atualização: dd/mm/aaaa".
  - Badge colorido (âmbar se 0, verde se > 0).
- **Grid de miniaturas** (responsivo, ~6-8 colunas) das primeiras N páginas (sugiro 12) com:
  - `<img>` da URL pública.
  - Numeração sobreposta (1, 2, 3…).
  - Se `total > 12`: card final "+132 páginas" clicável que expande para mostrar todas.
- **Botão "🗑️ Substituir todas as páginas"** (perigoso, com `confirm`) — opcional, ajuda quando o usuário quer recarregar.
- O botão atual "🖼️ Selecionar Páginas" passa a ter o rótulo "Adicionar mais páginas" quando já existem páginas, e "Selecionar Páginas" quando vazio.

Para alimentar o grid: adicionar uma `useQuery` que busca `revista_licoes` (numero=1) da revista em edição quando `editingRevista` muda e o tipo é livro/infográfico — independente do `managingLicoes`. Cache key: `["revista-livro-paginas", editingRevista.id]`.

### 3. Listagem (tabela) — pequeno polimento opcional

Manter a coluna "Lições" como está (já mostra "X páginas" depois do backfill), mas trocar o ícone do botão de ação para livros/infográficos: hoje o botão "Gerir Lições" fica oculto para esses tipos (linha 1224). Adicionar no lugar um botão `🖼️` que abre direto o modal de edição já focado no bloco de páginas (mesma ação do `Pencil`, só por affordance).

## Restrições respeitadas

- **NÃO** toca em revistas (`tipo_conteudo = 'revista'`) — nem em código, nem em dados.
- **NÃO** mexe em `RevistaLicencasAdmin.tsx`, painel do superintendente, edge functions, etc.
- **NÃO** apaga dados — backfill é só `UPDATE` baseado nas páginas existentes.
- Sem mudança de schema.

## Arquivos afetados

- `supabase/migrations/<timestamp>_backfill_total_licoes_livros_infograficos.sql` (novo)
- `src/pages/admin/RevistasDigitais.tsx` (editado: bloco do modal + ação da tabela)

## Resultado esperado

- Listagem `/admin/ebd/revistas-digitais`: cada livro/infográfico mostra "144 páginas", "16 páginas" etc. em vez de "—".
- Modal de edição: ao abrir um livro/infográfico, vê na hora um card "📄 144 páginas cadastradas" + grid com miniaturas das páginas reais do storage, com numeração.
- Revistas comuns: inalteradas.
