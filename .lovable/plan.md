

# Plano: Baixa Automatica de Comissoes via Extrato Bancario (usando OpenAI)

## Resumo

Upload de PDFs de extratos bancarios (Santander, Delta, Credifort) para dar baixa automatica nas parcelas pendentes. O sistema usa a API da OpenAI (ja configurada) para extrair dados dos PDFs e cruza com as parcelas no banco.

## Alteracoes

### 1. Nova Edge Function: `parse-bank-statement`

**Arquivo:** `supabase/functions/parse-bank-statement/index.ts`

- Recebe o PDF como base64 + nome do banco
- Usa a API da OpenAI (`gpt-4o`) com vision para extrair dados estruturados do PDF
- Retorna JSON com array de titulos: sacado, valor, data_vencimento, data_pagamento, numero_titulo
- Segue o padrao existente no projeto (cors headers, `OPENAI_API_KEY` via `Deno.env.get`)

### 2. Novo Componente: `ImportarExtratoBancario.tsx`

**Arquivo:** `src/components/admin/comissoes/ImportarExtratoBancario.tsx`

Dialog com:
- Seletor de banco (Santander, Delta, Credifort)
- Upload de PDF
- Apos processamento: tabela mostrando cada titulo do extrato com a parcela encontrada (ou "Sem match")
- Matching por: **valor exato (tolerancia R$ 0,01) + data de vencimento**
- Nome do cliente exibido lado a lado para conferencia visual
- Checkboxes para selecionar quais matches confirmar
- Botao "Confirmar Baixa" que atualiza parcelas selecionadas:
  - `status` → `paga`
  - `comissao_status` → `liberada`
  - `data_liberacao` → data atual
  - `data_pagamento` → data do pagamento do extrato

### 3. Integracao no `GestaoComissoes.tsx`

**Arquivo:** `src/pages/admin/GestaoComissoes.tsx`

- Adicionar botao "Importar Extrato" na aba de pendentes/futuras
- Importar e renderizar o dialog `ImportarExtratoBancario`

### 4. Atualizar `config.toml`

Adicionar entrada para a nova function:
```toml
[functions.parse-bank-statement]
verify_jwt = true
```

## Fluxo do Usuario

```text
1. Admin clica "Importar Extrato" na aba pendentes
2. Seleciona o banco e faz upload do PDF
3. Sistema envia PDF para edge function → OpenAI extrai dados
4. Frontend busca parcelas pendentes e cruza por valor + vencimento
5. Exibe tabela de preview com matches (verde) e sem match (vermelho)
6. Admin revisa, seleciona os corretos e clica "Confirmar Baixa"
7. Parcelas selecionadas sao atualizadas em lote
```

## Detalhes Tecnicos

- A edge function usa `OPENAI_API_KEY` ja configurada, com modelo `gpt-4o` para leitura de PDF via vision (imagem base64)
- O PDF sera convertido para base64 no frontend antes do envio
- Matching usa tolerancia de R$ 0,01 no valor para cobrir arredondamentos
- Titulos com multiplos matches possiveis (mesmo valor e vencimento) sao sinalizados para selecao manual
- Nenhuma alteracao no banco de dados necessaria

