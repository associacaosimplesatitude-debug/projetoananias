

# Correção: Buscar NF-e pelo Bling Order ID (Quando nfe_id é NULL)

## Problema Identificado

Os registros das NF-es 019146 e 019147 foram inseridos manualmente com os seguintes campos:
- `bling_order_id`: ✅ Preenchido (24939744400 e 24939829731)
- `nfe_id`: ❌ NULL  
- `nota_fiscal_numero`: ❌ NULL
- `nota_fiscal_url`: ❌ NULL
- `status_nfe`: 'CRIADA'

A função `handleCheckNfeStatus` na página "Notas Emitidas" faz o seguinte filtro:

```typescript
const notasProcessando = notas?.filter(
  n => n.nfe_id && ['PROCESSANDO', 'ENVIADA', 'CRIADA'].includes(n.status_nfe || '')
);
```

**Problema**: Como `nfe_id` é NULL, as notas são **ignoradas** e nunca atualizadas!

---

## Solução

Modificar a função `handleCheckNfeStatus` para:
1. Se a nota tiver `nfe_id` → usar `bling-check-nfe-status` (atual)
2. Se a nota não tiver `nfe_id` mas tiver `bling_order_id` → usar `bling-get-nfe-by-order-id` para buscar os dados

### Alterações no arquivo `src/pages/vendedor/VendedorNotasEmitidas.tsx`

```typescript
const handleCheckNfeStatus = async () => {
  // Incluir notas que têm nfe_id OU bling_order_id
  const notasProcessando = notas?.filter(n => 
    (n.nfe_id || n.order_number) && 
    ['PROCESSANDO', 'ENVIADA', 'CRIADA'].includes(n.status_nfe || '')
  );

  if (!notasProcessando || notasProcessando.length === 0) {
    toast.info("Nenhuma nota em processamento para verificar");
    refetch();
    return;
  }

  setIsCheckingStatus(true);
  let atualizadas = 0;

  try {
    for (const nota of notasProcessando) {
      // Se tem nfe_id, usar bling-check-nfe-status
      if (nota.nfe_id) {
        const { data, error } = await supabase.functions.invoke('bling-check-nfe-status', {
          body: { nfe_id: nota.nfe_id, venda_id: nota.id, source: nota.source }
        });

        if (!error && data?.updated) {
          atualizadas++;
        }
      } 
      // Se não tem nfe_id, buscar pelo bling_order_id
      else if (nota.order_number) {
        const { data, error } = await supabase.functions.invoke('bling-get-nfe-by-order-id', {
          body: { blingOrderId: parseInt(nota.order_number) }
        });

        if (!error && data?.found && data?.linkDanfe) {
          // Atualizar o registro com os dados encontrados
          const updateTable = nota.source === 'shopify' ? 'ebd_shopify_pedidos' : 'vendas_balcao';
          
          await supabase
            .from(updateTable)
            .update({
              nota_fiscal_numero: data.nfeNumero,
              nota_fiscal_url: data.linkDanfe,
              nota_fiscal_chave: data.chave,
              nfe_id: data.nfeId,
              status_nfe: 'AUTORIZADA',
            })
            .eq('id', nota.id);

          atualizadas++;
        }
      }
    }

    if (atualizadas > 0) {
      toast.success(`${atualizadas} nota(s) atualizada(s)`);
    } else {
      toast.info("Notas ainda em processamento no Bling");
    }
    
    refetch();
  } catch (error: any) {
    console.error("Erro ao verificar status:", error);
    toast.error("Erro ao verificar status das notas");
  } finally {
    setIsCheckingStatus(false);
  }
};
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/vendedor/VendedorNotasEmitidas.tsx` | Modificar `handleCheckNfeStatus` para buscar NF-e por `bling_order_id` quando `nfe_id` for NULL |

---

## Resultado Esperado

Após a correção:
1. Clicar em "Atualizar" na página Notas Emitidas
2. O sistema detecta que as notas 019146 e 019147 não têm `nfe_id`
3. Usa `bling-get-nfe-by-order-id` com o `bling_order_id` (24939744400 e 24939829731)
4. Busca os dados da NF-e diretamente no Bling
5. Atualiza os registros com `nota_fiscal_numero`, `nota_fiscal_url` e `nfe_id`
6. Status muda para "Autorizada" e botão DANFE fica disponível

