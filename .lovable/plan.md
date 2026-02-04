
# Plano: Corrigir Validação de Duplicidade para CPF

## Problema

O sistema de detecção de clientes duplicados funciona corretamente para CNPJ, mas não para CPF. Quando um vendedor tenta cadastrar um cliente com CPF já existente de outro vendedor, o sistema deveria:

1. Bloquear o cadastro
2. Mostrar mensagem informando que o cliente pertence a outro vendedor  
3. Oferecer opção de solicitar transferência ao gerente

Isso funciona para CNPJ porque existe um índice único, mas não funciona para CPF porque esse índice não existe.

## Causa Raiz

- Existe: `ebd_clientes_cnpj_unique_not_null` (índice único para CNPJ)
- Não existe: índice único equivalente para CPF

O código atual depende do erro de banco `23505` (violação de unicidade) para acionar o fluxo de "cliente já pertence a outro vendedor". Sem o índice único em CPF, esse erro nunca ocorre.

## Solução

Criar um índice único parcial para CPF, igual ao que já existe para CNPJ.

## O que será alterado

| Componente | Alteração |
|------------|-----------|
| Banco de dados | Criar índice único `ebd_clientes_cpf_unique_not_null` |

## Resultado esperado

Após a correção, quando um vendedor tentar cadastrar um cliente com CPF já existente:
1. O banco retornará erro `23505`
2. O sistema buscará o cliente existente  
3. Exibirá o alerta com o nome do vendedor atual
4. Permitirá solicitar transferência ao gerente

O fluxo será idêntico ao que já funciona para CNPJ.

---

## Seção Técnica

**SQL a ser executado:**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ebd_clientes_cpf_unique_not_null 
ON public.ebd_clientes (cpf) 
WHERE (cpf IS NOT NULL);
```

**Nota sobre dados duplicados:**

Antes de criar o índice, os 4 cadastros duplicados da cliente VANIA FERNANDES CALIXTO ACCIOLY (CPF 754.359.777-20) precisam ser removidos, pois a criação do índice falhará se existirem duplicatas. Serão mantidos apenas os registros originais.

**Limpeza necessária:**

```sql
-- Remover duplicatas, mantendo apenas o registro mais antigo de cada CPF
DELETE FROM ebd_clientes 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY cpf 
      ORDER BY created_at ASC
    ) as rn 
    FROM ebd_clientes 
    WHERE cpf IS NOT NULL
  ) sub 
  WHERE rn > 1
);
```
