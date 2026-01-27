
# Plano: Corrigir Campo "Nome" em Branco no Checkout

## Diagnóstico do Problema

### Causa Raiz Identificada
O campo `nome_igreja` do cliente "Josenita da Silva Oliveira" está salvo com **espaço no início**:
- Valor no banco: `" Josenita da Silva Oliveira"` (27 caracteres)
- Valor limpo: `"Josenita da Silva Oliveira"` (26 caracteres)

### Por que o Campo "Nome" Fica Vazio?
O código no `CheckoutShopifyMP.tsx` (linha 284-287) faz:

```typescript
const nomeCompleto = proposta.cliente_nome || '';  // " Josenita da Silva Oliveira"
const partesNome = nomeCompleto.split(' ');        // ['', 'Josenita', 'da', 'Silva', 'Oliveira']
const primeiroNome = partesNome[0] || '';          // '' (string vazia!)
const sobrenome = partesNome.slice(1).join(' ');   // 'Josenita da Silva Oliveira'
```

O primeiro elemento após o `split(' ')` é uma string vazia, resultando no campo "Nome" em branco.

---

## Solução em Duas Partes

### Parte 1: Correção Imediata - Dados do Cliente
Corrigir os dados do cliente no banco (remover espaços extras):

```sql
UPDATE ebd_clientes 
SET nome_igreja = TRIM(nome_igreja),
    nome_responsavel = TRIM(nome_responsavel)
WHERE id = 'b82982df-0458-460c-a3c3-5ba83dc2e562';
```

### Parte 2: Correção Preventiva - Código do Checkout
Modificar o código para fazer `trim()` antes de processar o nome.

**Arquivo:** `src/pages/ebd/CheckoutShopifyMP.tsx`
**Local:** Linhas 284-287

**Código Atual:**
```typescript
const nomeCompleto = proposta.cliente_nome || '';
const partesNome = nomeCompleto.split(' ');
const primeiroNome = partesNome[0] || '';
const sobrenome = partesNome.slice(1).join(' ') || '';
```

**Código Corrigido:**
```typescript
const nomeCompleto = (proposta.cliente_nome || '').trim();
const partesNome = nomeCompleto.split(' ').filter(p => p.length > 0);
const primeiroNome = partesNome[0] || '';
const sobrenome = partesNome.slice(1).join(' ') || '';
```

### Parte 3: Correção no Cadastro de Cliente (Prevenção)
Modificar o formulário de cadastro para fazer `trim()` nos campos de nome antes de salvar.

**Arquivo:** `src/components/vendedor/CadastrarClienteDialog.tsx`

Na função `handleSubmit`, antes de inserir/atualizar o cliente:
```typescript
const nomeIgreja = formData.nome_igreja?.trim() || '';
const nomeResponsavel = formData.nome_responsavel?.trim() || '';
```

---

## Resumo das Alterações

| Local | Alteração |
|-------|-----------|
| Banco de dados | Corrigir espaços nos nomes dos clientes afetados |
| `CheckoutShopifyMP.tsx` | Adicionar `.trim()` e `.filter()` ao processar nome |
| `CadastrarClienteDialog.tsx` | Fazer trim nos campos antes de salvar |

---

## Resultado Esperado

1. O checkout vai funcionar corretamente mesmo se houver espaços extras nos nomes
2. Novos cadastros não terão espaços extras nos nomes
3. O cliente "Josenita da Silva Oliveira" terá dados corrigidos e poderá finalizar pedidos PIX
