
# Plano: Atualizar Dashboard Automaticamente Após Edição de Livro

## Problema Identificado

Quando você edita o valor de um livro (como "Teologia para Pentecostais"), o Dashboard não atualiza automaticamente porque o sistema atual só invalida a lista de livros, mas não os dados exibidos no Dashboard.

## Solução

Adicionar invalidação de todas as queries relevantes do Dashboard quando um livro é salvo ou atualizado.

## Alteração Necessária

**Arquivo:** `src/components/royalties/LivroDialog.tsx`

**Linha 180** - Após o toast de sucesso, adicionar invalidação de múltiplas queries:

```typescript
toast({ title: livro ? "Livro atualizado com sucesso!" : "Livro cadastrado com sucesso!" });
queryClient.invalidateQueries({ queryKey: ["royalties-livros"] });
// Invalidar queries do Dashboard para atualização imediata
queryClient.invalidateQueries({ queryKey: ["royalties-livros-count"] });
queryClient.invalidateQueries({ queryKey: ["royalties-total-a-pagar"] });
queryClient.invalidateQueries({ queryKey: ["royalties-top-livros"] });
queryClient.invalidateQueries({ queryKey: ["royalties-vendas-mensal"] });
queryClient.invalidateQueries({ queryKey: ["royalties-top-autores"] });
onOpenChange(false);
```

## Resultado Esperado

Após salvar qualquer alteração em um livro, o Dashboard será automaticamente recarregado com os dados atualizados, incluindo:
- Contador de livros cadastrados
- Royalties a pagar
- Top 5 livros mais vendidos
- Gráficos de vendas mensais
- Top 5 autores

---

## Seção Técnica

### Query Keys Invalidadas

| Query Key | Componente Afetado | Dado Exibido |
|-----------|-------------------|--------------|
| `royalties-livros` | Lista de Livros | Tabela de livros |
| `royalties-livros-count` | Dashboard KPI | Contador "Livros Cadastrados" |
| `royalties-total-a-pagar` | Dashboard KPI | Valor "Royalties a Pagar" |
| `royalties-top-livros` | Dashboard Charts/Table | Top 5 livros vendidos |
| `royalties-vendas-mensal` | Dashboard Chart | Gráfico de vendas por mês |
| `royalties-top-autores` | Dashboard Table | Top 5 autores |

### Padrão Utilizado

Esta abordagem segue o padrão recomendado do React Query para garantir consistência entre mutações e visualizações de dados, forçando um refetch imediato após alterações no banco de dados.
