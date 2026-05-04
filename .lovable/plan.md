## Plano: Seletor de usuários por nome/email em Nova Implementação

Substituir o campo atual de "UUIDs de usuários separados por vírgula" por um seletor com busca por nome/email.

### Mudanças (apenas em `src/pages/admin/Implementacoes.tsx`)

1. **Buscar perfis** quando `audienceType === "users"`:
   - `useQuery` em `profiles` selecionando `id, full_name, email`, ordenado por `full_name`.
   - Habilitada apenas quando o radio "Usuários específicos" estiver ativo (lazy load).
   - Admins já têm policy "Admins can view all profiles", então funciona sem mudanças no banco.

2. **Trocar estado `audienceUsers: string`** por `audienceUserIds: string[]` (Set lógico). Inicializar com `impl?.audience_user_ids || []`.

3. **UI nova** (substitui o `<Textarea>` de UUIDs):
   - `Input` de busca (filtra client-side por `full_name` ou `email`, case-insensitive).
   - Lista rolável (`ScrollArea`, max-h ~64) com cada linha: `Checkbox` + nome + email em texto pequeno.
   - Acima da lista: badges dos usuários já selecionados com botão "x" para remover, e contador "N selecionado(s)".
   - Validação no submit: exigir `audienceUserIds.length >= 1`.

4. **Submit**: enviar `audience_user_ids: audienceUserIds` direto (já é `string[]`).

### Restrições mantidas
- Sem migrations, sem mudanças em hooks, sem mudanças em outras páginas.
- Mantém aparência atual do dialog (mesmo grid, mesmo radio group acima).
- Texto em pt-BR.