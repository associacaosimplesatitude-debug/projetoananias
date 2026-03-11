

## Diagnóstico

A revista "Revista EBD N07" (id `503e5583-...`) existe no banco, e o usuário `teste@revistas.com` está vinculado à igreja "Igreja Teste - Revista Virtual" (id `b2c3d4e5-...`). Porém, **não existe nenhum registro em `revista_assinaturas`** conectando essa igreja a essa revista. O código atual em `AlunoRevistaVirtual.tsx` busca a assinatura ativa do cliente — sem ela, mostra "sem assinatura".

## Solução

Inserir um registro em `revista_assinaturas` vinculando a igreja de teste à revista recém-criada:

| Campo | Valor |
|-------|-------|
| `cliente_id` | `b2c3d4e5-f6a7-8901-bcde-f12345678901` (Igreja Teste) |
| `revista_id` | `503e5583-2f3f-4b75-819e-bd241c590bc4` (Revista EBD N07) |
| `status` | `ativa` |
| `plano` | `trimestral` |
| `inicio_em` | hoje |

Isso é apenas uma inserção de dados — nenhuma alteração de código ou schema é necessária. O leitor já funciona corretamente, só faltava o vínculo no banco.

