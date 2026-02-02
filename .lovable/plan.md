

# Plano de Correção: Descontos não aparecem para o Autor

## Diagnóstico do Problema

Ao investigar o problema, identifiquei que:

1. **Os descontos estão corretamente cadastrados** no banco de dados para o autor Ronald:
   - `desconto_livros_proprios`: 55%
   - Descontos por categoria: 30% em todas (revistas, bíblias, livros, infantil, perfumes, outros)

2. **O problema é de segurança (RLS)**: A tabela `royalties_descontos_categoria_autor` só possui política para administradores:
   ```sql
   "Admin full access descontos autor" - USING: has_royalties_access(auth.uid())
   ```

3. **Quando o autor logado busca seus descontos**, a API retorna array vazio `[]` porque ele não é admin.

---

## Solução

Adicionar uma política RLS que permita ao autor ler seus próprios descontos cadastrados.

### Migração SQL Necessária

```sql
-- Política para autor ver seus próprios descontos
CREATE POLICY "Autor view own descontos" 
ON royalties_descontos_categoria_autor 
FOR SELECT 
TO authenticated 
USING (
  autor_id = public.get_autor_id_by_user(auth.uid())
);
```

Esta política usa a mesma função `get_autor_id_by_user()` já utilizada nas políticas de resgates, mantendo consistência.

---

## Resumo

| Item | Status Atual | Após Correção |
|------|--------------|---------------|
| Admin vê descontos | Funciona | Funciona |
| Autor vê próprios descontos | Não funciona | Funciona |

A correção é simples: apenas uma migração de banco de dados para adicionar a política RLS faltante.

