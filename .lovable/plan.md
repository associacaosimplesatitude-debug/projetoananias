

# Adicionar Upload Direto de Notas de Meses Anteriores

## Problema

Atualmente, o botao "Criar Pendencia do Mes" so cria registro para o mes atual. O Admin precisa subir notas de meses anteriores (como mostrado na imagem: julho/2025 a janeiro/2026) diretamente, sem precisar primeiro criar uma pendencia e depois fazer upload.

## Solucao

Adicionar um botao "Upload Nota" (separado do "Criar Pendencia") que abre o modal de upload permitindo selecionar mes/ano livremente. Ao enviar, o sistema cria o registro na tabela `google_ads_invoices` com os dados preenchidos e o PDF, ja no status `EM_VALIDACAO` (ou `GERADA` direto, a criterio do Admin).

## Alteracoes

### 1. `src/pages/admin/GoogleNotasFiscais.tsx`

- Adicionar botao "Upload Nota" ao lado do "Criar Pendencia do Mes" (somente Admin)
- Ao clicar, abrir o `InvoiceUploadModal` em modo `'create_new'` sem invoice pre-existente (invoice = null)
- O modal criara um novo registro diretamente na tabela

### 2. `src/components/google/InvoiceUploadModal.tsx`

- Adicionar dois campos novos no modal: **Mes** e **Ano** (selects), visiveis quando `invoice` e null (modo criacao de nova nota)
- Quando `invoice` e null, o submit faz `INSERT` em `google_ads_invoices` (em vez de UPDATE)
- O insert inclui: competencia_month, competencia_year, customer_id, invoice_number, issue_date, amount, notes, pdf_url, pdf_filename, status `EM_VALIDACAO`, created_by
- Quando `invoice` existe, comportamento atual permanece (UPDATE)

### Detalhes tecnicos

**InvoiceUploadModal** -- novos campos condicionais:

```text
Se invoice == null:
  - Mostrar Select "Mes" (1-12) 
  - Mostrar Select "Ano" (ultimos 5 anos)
  - No submit: INSERT na tabela google_ads_invoices
Senao:
  - Manter comportamento atual (UPDATE)
```

**GoogleNotasFiscais** -- novo botao:

```text
[Criar Pendencia do Mes]  [Upload Nota]
                              |
                    abre modal com invoice=null, mode='create'
```

## Arquivos a editar

1. `src/pages/admin/GoogleNotasFiscais.tsx` -- adicionar botao "Upload Nota"
2. `src/components/google/InvoiceUploadModal.tsx` -- adicionar campos mes/ano e logica de INSERT

