

# Plano: Adicionar Checkbox "Trabalha na Penha" no Formulário de Vendedores

## Objetivo
Simplificar a definição de acesso à Loja Penha com um checkbox simples, ao invés de um Select com múltiplas opções.

---

## Implementação

### 1. Atualizar o estado do formulário em AdminEBD.tsx

Adicionar `trabalha_penha: false` no estado inicial do formulário:

```typescript
const [formData, setFormData] = useState({
  // ... campos existentes
  trabalha_penha: false,  // NOVO - checkbox simples
});
```

### 2. Atualizar resetForm e handleEdit

- `resetForm`: adicionar `trabalha_penha: false`
- `handleEdit`: carregar `trabalha_penha: vendedor.polo === 'penha'`

### 3. Adicionar Checkbox no formulário

Após o checkbox "É Gerente", adicionar:

```typescript
<div className="flex items-center space-x-2">
  <Checkbox
    id="trabalha_penha"
    checked={formData.trabalha_penha}
    onCheckedChange={(checked) => 
      setFormData({ ...formData, trabalha_penha: !!checked })
    }
  />
  <Label htmlFor="trabalha_penha" className="cursor-pointer">
    Trabalha na Loja Penha
  </Label>
</div>
<p className="text-xs text-muted-foreground">
  Vendedores da Penha têm acesso ao PDV Balcão e opção "Pagar na Loja"
</p>
```

### 4. Converter checkbox para campo polo no envio

Ao criar/atualizar vendedor, converter o boolean para o valor do polo:

```typescript
polo: formData.trabalha_penha ? 'penha' : null
```

### 5. Atualizar Edge Function create-vendedor

Adicionar `polo` na criação do vendedor (já previsto no plano anterior).

---

## Arquivos a Modificar

1. **`src/pages/admin/AdminEBD.tsx`**
   - Estado inicial: adicionar `trabalha_penha: false`
   - `resetForm`: adicionar `trabalha_penha: false`
   - `handleEdit`: converter `polo === 'penha'` para boolean
   - Formulário: adicionar Checkbox
   - Envio: converter boolean para `polo`

2. **`supabase/functions/create-vendedor/index.ts`**
   - Adicionar `polo` nos parâmetros e no insert

---

## Resultado

Um checkbox simples "Trabalha na Loja Penha" que, quando marcado, dá ao vendedor o mesmo acesso que Gloria e Antonio possuem (PDV Balcão e pagamento na loja).

