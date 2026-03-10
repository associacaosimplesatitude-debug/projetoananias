

## Plano: Validação de CNPJ/CPF com bloqueio visual e notificação ao vendedor

### Problema atual
Quando o financeiro tenta aprovar um pedido com CNPJ inválido, recebe apenas um erro genérico. O vendedor não sabe que precisa corrigir o documento.

### Solução

Criar um fluxo de validação **pré-aprovação** no frontend e na edge function, com flag visual e registro persistente.

### Mudanças

**1. Edge Function `aprovar-faturamento/index.ts`**
- Antes de chamar `bling-create-order`, validar CNPJ/CPF do cliente diretamente
- Se inválido, salvar flag `documento_invalido = true` e `documento_invalido_motivo` na proposta via update
- Retornar erro específico com código `DOCUMENTO_INVALIDO`

**2. Migração SQL — adicionar colunas na `vendedor_propostas`**
```sql
ALTER TABLE vendedor_propostas 
  ADD COLUMN IF NOT EXISTS documento_invalido boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS documento_invalido_motivo text;
```

**3. Frontend `AprovacaoFaturamento.tsx` (tela do financeiro)**
- Na listagem, verificar se `documento_invalido = true` → mostrar banner vermelho chamativo com ícone de alerta: "⚠️ CNPJ/CPF INVÁLIDO — Aguardando correção pelo vendedor"
- Desabilitar botão "Aprovar" quando documento inválido, mantendo apenas visual informativo
- Quando o financeiro clica "Aprovar" e recebe erro `DOCUMENTO_INVALIDO`, mostrar toast vermelho claro
- Adicionar botão "Revalidar" que limpa o flag e tenta aprovar novamente (para quando o vendedor já corrigiu)

**4. Frontend `VendedorPedidosPage.tsx` (tela do vendedor)**
- Na proposta com `documento_invalido = true`, mostrar alerta vermelho: "CNPJ/CPF inválido — corrija no cadastro do cliente para liberar aprovação"
- Link direto para edição do cliente

**5. Limpeza automática do flag**
- Na edge function `aprovar-faturamento`, antes de validar, sempre buscar o CNPJ/CPF atualizado do banco
- Se agora é válido, limpar `documento_invalido = false` e prosseguir normalmente
- Isso garante que basta o vendedor corrigir o cadastro — na próxima tentativa de aprovação, funciona

### Fluxo resumido

```text
Financeiro clica "Aprovar"
  → Edge function busca CNPJ/CPF atual do cliente
  → Válido? → Prossegue normalmente (limpa flag se existia)
  → Inválido? → Marca flag na proposta + retorna erro claro
     → Financeiro vê banner vermelho na proposta
     → Vendedor vê alerta na sua lista de pedidos
     → Vendedor corrige CNPJ no cadastro
     → Financeiro clica "Aprovar" novamente → funciona
```

