

## Plano: Mover CPF entre registros

Duas operações de UPDATE na tabela `ebd_clientes`:

1. **Remover CPF do registro #2** (e-commerce):
   ```sql
   UPDATE ebd_clientes SET cpf = NULL WHERE id = '71bdb635-fe81-4860-9e25-65ea23279c88';
   ```

2. **Adicionar CPF ao registro #1** (principal):
   ```sql
   UPDATE ebd_clientes SET cpf = '01769949470' WHERE id = '93dd8b9d-558e-4e17-9e79-0968deafb6a3';
   ```

Ambas operações serão feitas via ferramenta de insert/update (sem migração, pois é alteração de dados, não de schema).

