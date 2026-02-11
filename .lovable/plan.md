
# Corrigir vinculacao do user_id ao registro do autor

## Problema
Ao cadastrar um autor, a edge function `create-autor-user` cria o usuario de autenticacao e retorna o `userId`. O dialogo chama `setFormData({ ...formData, user_id: userId })` para salvar esse ID. Porem, como `setFormData` e uma atualizacao de estado React (assincrona), quando o `handleSubmit` continua executando e monta o `payload` na linha seguinte, ele ainda le o valor antigo de `formData.user_id` (null).

Resultado: o registro em `royalties_autores` e salvo com `user_id = NULL`. O hook `useRoyaltiesAuth` busca por `user_id` e nunca encontra o autor, deixando a pagina `/autor` em loading infinito.

## Solucao
Fazer `createUserAccount` retornar o `userId` diretamente, e usar esse valor ao montar o payload, sem depender da atualizacao de estado React.

## Detalhes tecnicos

**Arquivo:** `src/components/royalties/AutorDialog.tsx`

### Alteracao 1: createUserAccount retorna userId
Alterar a funcao `createUserAccount` para retornar o `userId` como string (em vez de depender apenas de `setFormData`):

```typescript
const createUserAccount = async (): Promise<string | null> => {
  // ... logica existente ...
  const userId = response.data.userId;
  setFormData({ ...formData, user_id: userId, senha: "" });
  return userId;  // <-- retornar o userId
};
```

### Alteracao 2: handleSubmit usa o retorno
No `handleSubmit`, capturar o retorno de `createUserAccount` e usar na montagem do payload:

```typescript
let effectiveUserId = formData.user_id;

if (formData.senha && formData.senha.length >= 6 && !formData.user_id) {
  const newUserId = await createUserAccount();
  if (newUserId) {
    effectiveUserId = newUserId;
  }
}

const payload = {
  // ...
  user_id: effectiveUserId,  // <-- usar valor correto
  // ...
};
```

### Alteracao 3: Corrigir registro existente
Tambem e necessario corrigir o registro atual do autor "Cleuton Teste 3" que ja esta com `user_id = NULL`. A migracao SQL fara o update:

```sql
UPDATE royalties_autores
SET user_id = '93f132b7-6923-4cfe-a155-1964ddf6c58b'
WHERE email = 'lftennisstore@gmail.com'
AND user_id IS NULL;
```

### Resultado esperado
1. A funcao retorna o userId diretamente
2. O payload usa o valor correto sem depender de re-render do React
3. O registro do autor fica vinculado ao usuario de autenticacao
4. O hook `useRoyaltiesAuth` encontra o autor e carrega o dashboard
