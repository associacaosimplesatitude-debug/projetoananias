
# Plano: Melhorias no Registro de Vendas Manuais e Historico

## Resumo das Solicitacoes

| # | Solicitacao | Situacao |
|---|-------------|----------|
| 1 | Trocar data unica por periodo (data inicial e final) | Novo |
| 2 | Corrigir vendas com comissao R$ 0,00 | Bug a corrigir |
| 3 | Adicionar coluna NF/DANFE com link no historico | Novo |

---

## 1. Formulario com Periodo de Vendas

### Problema Atual
O formulario usa uma unica "Data da Venda" que nao faz sentido para vendas retroativas em lote.

### Solucao
Trocar por dois campos: "Periodo Inicial" e "Periodo Final" para indicar o intervalo das vendas.

### Alteracao no Campo de Data

De:
```
Data da Venda *
[30/01/2026]
```

Para:
```
Periodo das Vendas *
De: [01/01/2026]  Ate: [31/01/2026]
```

O sistema salvara a data final como `data_venda` e adicionara o periodo na observacao automaticamente.

---

## 2. Corrigir Vendas com Comissao R$ 0,00

### Problema Identificado
Duas vendas importadas automaticamente do Bling tem `valor_comissao_total = 0.00`:
- ID: `db676c47-6d51-4339-a638-563cc052b59a` (criada em 30/01/2026)
- ID: `b86867d5-916c-46b7-b241-858285357310` (criada em 30/01/2026)

### Causa
As vendas foram sincronizadas antes da comissao ou valor de capa serem configurados corretamente no cadastro do livro.

### Solucao
1. Criar uma migration SQL para recalcular as comissoes baseado no percentual atual (5%)
2. O livro "O Cativeiro Babilonico" tem percentual de 5% e valor de capa R$ 22,45 corretamente configurados

### Query de Correcao
```sql
UPDATE royalties_vendas rv
SET 
  valor_comissao_unitario = (rv.valor_unitario * rc.percentual / 100),
  valor_comissao_total = (rv.valor_unitario * rc.percentual / 100) * rv.quantidade
FROM royalties_comissoes rc
WHERE rv.livro_id = rc.livro_id
  AND rv.valor_comissao_total = 0;
```

Resultado esperado: 
- 1 unidade x R$ 22,45 x 5% = R$ 1,12 por venda

---

## 3. Adicionar Coluna NF/DANFE no Historico

### Situacao Atual
A tabela `royalties_vendas` ja tem os campos `bling_order_id` e `bling_order_number`, mas nao tem campos para NF/DANFE.

### Solucao

#### Etapa 1: Adicionar campos no banco
```sql
ALTER TABLE public.royalties_vendas 
ADD COLUMN IF NOT EXISTS nota_fiscal_numero TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS nota_fiscal_url TEXT DEFAULT NULL;
```

#### Etapa 2: Atualizar a pagina de Vendas
Adicionar coluna "NF" na tabela com:
- Se tiver `nota_fiscal_url`: Link clicavel "NF XXXXX" com icone externo
- Se tiver apenas `bling_order_id`: Mostrar "Aguardando"
- Se for venda manual: Mostrar "-"

### Design Visual (referencia da area de Comissoes)

```
+--------+------------------+--------+-----+----------+----------+
| Data   | Livro            | Autor  | Qtd | Comissao | NF       |
+--------+------------------+--------+-----+----------+----------+
| 27/01  | O Cativeiro...   | Ronald | 1   | R$ 1,12  | NF 030538 [→] |
| 28/01  | O Cativeiro...   | Ronald | 6   | R$ 6,74  | NF 000356 [→] |
| 28/01  | Venda Manual     | Ronald | 10  | R$ 11,23 | -            |
+--------+------------------+--------+-----+----------+----------+
```

---

## Secao Tecnica

### Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/royalties/VendaDialog.tsx` | Campos de periodo (data_inicio, data_fim) |
| `src/pages/royalties/Vendas.tsx` | Coluna NF/DANFE com link externo |
| Nova migracao SQL | Campos NF + correcao comissoes 0 |

### Migracao SQL

```sql
-- 1. Adicionar campos de nota fiscal
ALTER TABLE public.royalties_vendas 
ADD COLUMN IF NOT EXISTS nota_fiscal_numero TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS nota_fiscal_url TEXT DEFAULT NULL;

-- 2. Recalcular comissoes zeradas
UPDATE royalties_vendas rv
SET 
  valor_comissao_unitario = (rv.valor_unitario * rc.percentual / 100),
  valor_comissao_total = (rv.valor_unitario * rc.percentual / 100) * rv.quantidade
FROM royalties_comissoes rc
WHERE rv.livro_id = rc.livro_id
  AND rv.valor_comissao_total = 0;
```

### Alteracoes no VendaDialog.tsx

```typescript
// Estado do formulario - trocar data_venda por periodo
const [formData, setFormData] = useState({
  livro_id: "",
  quantidade: "",
  valor_unitario: "",
  data_inicio: format(new Date(), "yyyy-MM-dd"),
  data_fim: format(new Date(), "yyyy-MM-dd"),
  observacao: "",
});

// No submit - salvar data_fim como data_venda e adicionar periodo na obs
const observacaoCompleta = `Periodo: ${format(new Date(formData.data_inicio), "dd/MM/yyyy")} a ${format(new Date(formData.data_fim), "dd/MM/yyyy")}${formData.observacao ? ` - ${formData.observacao}` : ""}`;

const payload = {
  ...
  data_venda: formData.data_fim, // Data final do periodo
  observacao: observacaoCompleta,
};
```

### Alteracoes na Vendas.tsx

```typescript
// Importar ExternalLink
import { Plus, Search, ExternalLink } from "lucide-react";

// Nova coluna no TableHeader
<TableHead>NF</TableHead>

// Nova celula no TableBody
<TableCell>
  {venda.nota_fiscal_url ? (
    <a
      href={venda.nota_fiscal_url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
    >
      NF {venda.nota_fiscal_numero || venda.bling_order_number || ""}
      <ExternalLink className="h-3 w-3" />
    </a>
  ) : venda.bling_order_id ? (
    <span className="text-xs text-amber-600">Aguardando</span>
  ) : (
    <span className="text-muted-foreground">-</span>
  )}
</TableCell>
```

### Atualizacao da Edge Function de Sincronizacao

Modificar `bling-sync-royalties-sales` para buscar e salvar dados da NF:
- `nota_fiscal_numero`: Numero da NF-e
- `nota_fiscal_url`: Link DANFE (linkPDF ou linkDanfe)

---

## Fluxo Final

```
+------------------------------------------+
|      REGISTRAR VENDA MANUAL              |
+------------------------------------------+
| Livro: [Selecione...]                    |
|                                          |
| Periodo das Vendas:                      |
| De: [01/01/2026]  Ate: [31/01/2026]     |
|                                          |
| Quantidade: [50]  Valor Unit: [22.45]   |
|                                          |
| Observacao: [Feira do Livro 2024]       |
|                                          |
| [Cancelar]  [Registrar Venda]           |
+------------------------------------------+
```

### Resultado Esperado

1. Formulario com periodo (De/Ate) em vez de data unica
2. Vendas com comissao corrigida de R$ 0,00 para R$ 1,12 cada
3. Coluna NF clicavel no historico, abrindo DANFE em nova aba
