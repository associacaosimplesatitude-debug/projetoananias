

# Plano: Corrigir Erro de UUID Vazio no Cadastro de Livro

## Problema Identificado

O erro `invalid input syntax for type uuid: ""` ocorre porque o campo `autor_id` está sendo enviado como string vazia (`""`) quando nenhum autor é selecionado. O banco de dados espera um UUID válido ou `null`, mas recebe uma string vazia.

## Causa Raiz

No `LivroDialog.tsx`:
- O estado inicial de `autor_id` é `""` (string vazia)
- O payload enviado ao Supabase inclui `autor_id: formData.autor_id` sem validação
- O atributo `required` no Select não impede a submissão quando o valor é string vazia

## Solução

Adicionar validação antes de enviar os dados:

1. Verificar se `autor_id` está preenchido antes de submeter
2. Exibir mensagem de erro amigável se o autor não foi selecionado
3. Impedir o envio do formulário com dados inválidos

## Alteração

**Arquivo:** `src/components/royalties/LivroDialog.tsx`

Modificar a função `handleSubmit` para incluir validação:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validação do autor
  if (!formData.autor_id) {
    toast({
      title: "Erro de validação",
      description: "Selecione um autor para o livro.",
      variant: "destructive",
    });
    return;
  }
  
  setLoading(true);
  // ... resto do código
};
```

## Resultado Esperado

- Se o usuário tentar cadastrar sem selecionar um autor, receberá uma mensagem clara: "Selecione um autor para o livro"
- O formulário só será submetido quando todos os campos obrigatórios estiverem preenchidos corretamente
- Não haverá mais erro de UUID inválido

