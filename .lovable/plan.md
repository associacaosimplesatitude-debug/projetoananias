
# Plano: Melhorar Registro de Vendas Manuais/Retroativas

## Situacao Atual

O sistema ja possui a funcionalidade de registro manual de vendas:

| Funcionalidade | Status |
|----------------|--------|
| Botao "Registrar Venda" | ✅ Existe |
| VendaDialog com formulario | ✅ Funciona |
| Diferenciacao Bling vs Manual | ✅ Automatica (bling_order_id = NULL) |
| Sincronizacao automatica (CRON) | ✅ Diaria as 6h |
| Sincronizacao manual | ✅ Botao com opcoes de periodo |

## Fluxo Atual

```text
+----------------------------------+
|       PAGINA DE VENDAS          |
+----------------------------------+
|                                  |
|  [Sincronizar Bling]  [+ Registrar Venda]
|                                  |
|  Sincronizacao automatica:       |
|  - CRON diario as 6h BRT         |
|  - Busca NFe autorizadas         |
|  - Preenche bling_order_id       |
|                                  |
|  Registro manual:                |
|  - Abre VendaDialog              |
|  - bling_order_id fica NULL      |
|  - Para vendas retroativas       |
+----------------------------------+
```

## Melhorias Propostas

Para facilitar o uso e deixar mais claro o proposito, vamos fazer pequenos ajustes:

### 1. Alterar texto do botao

De: "Registrar Venda"
Para: "Venda Manual"

### 2. Melhorar titulo do dialog

De: "Registrar Venda"
Para: "Registrar Venda Manual"
Com subtitulo explicativo

### 3. Adicionar campo de observacao

Novo campo opcional para registrar notas sobre a venda retroativa (ex: "Referente a feira do livro 2024")

### 4. Indicador visual na tabela

Badge "Manual" para diferenciar vendas registradas manualmente das sincronizadas do Bling

---

## Alteracoes Necessarias

### 1. Banco de Dados

Adicionar coluna opcional para observacoes:

```sql
ALTER TABLE public.royalties_vendas 
ADD COLUMN IF NOT EXISTS observacao TEXT DEFAULT NULL;

COMMENT ON COLUMN public.royalties_vendas.observacao IS 'Observacoes sobre vendas manuais';
```

### 2. VendaDialog.tsx

- Alterar titulo para "Registrar Venda Manual"
- Adicionar subtitulo explicativo
- Adicionar campo de observacao
- Adicionar indicador de origem (manual)

### 3. Vendas.tsx

- Alterar texto do botao para "Venda Manual"
- Adicionar badge "Manual" na coluna Status para vendas sem bling_order_id

---

## Resultado Final

A pagina de vendas tera:

| Acao | Descricao |
|------|-----------|
| Sincronizar Bling | Importa NFe automaticamente (com bling_order_id) |
| Venda Manual | Registra venda retroativa (sem bling_order_id) |

Na tabela:
- Vendas do Bling: Badge "Pendente" ou "Pago"
- Vendas manuais: Badge "Manual" + "Pendente/Pago"

---

## Secao Tecnica

### Arquivos a modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/royalties/VendaDialog.tsx` | Titulo, subtitulo, campo observacao |
| `src/pages/royalties/Vendas.tsx` | Texto botao, badge "Manual" |
| Nova migracao SQL | Adicionar coluna `observacao` |

### Migracao SQL

```sql
-- Adicionar campo de observacao para vendas manuais
ALTER TABLE public.royalties_vendas 
ADD COLUMN IF NOT EXISTS observacao TEXT DEFAULT NULL;

COMMENT ON COLUMN public.royalties_vendas.observacao 
IS 'Observacoes sobre vendas manuais/retroativas';
```

### Alteracoes no VendaDialog

```typescript
// Novo campo no formData
observacao: "",

// Novo campo no formulario
<div className="space-y-2">
  <Label htmlFor="observacao">Observacao (opcional)</Label>
  <Input
    id="observacao"
    placeholder="Ex: Referente a feira do livro 2024"
    value={formData.observacao}
    onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
  />
</div>
```

### Alteracoes na tabela de vendas

```typescript
// Na coluna Status
<TableCell>
  <div className="flex gap-1">
    {!venda.bling_order_id && (
      <Badge variant="outline">Manual</Badge>
    )}
    <Badge variant={venda.pagamento_id ? "default" : "secondary"}>
      {venda.pagamento_id ? "Pago" : "Pendente"}
    </Badge>
  </div>
</TableCell>
```
