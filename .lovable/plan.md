

## Diagnóstico e Plano de Correção

### Problema 1: Contador de inscritas mostra 0 no navegador

**Causa raiz**: A política RLS da tabela `sorteio_participantes` exige autenticação para SELECT:
```sql
CREATE POLICY "select_admin" ON sorteio_participantes FOR SELECT 
  USING (auth.uid() IS NOT NULL);
```
A página `/sorteio` é pública (visitante anônimo), então o `count` retorna 0. No preview do Lovable você está logado como admin, por isso mostra 1.

**Correção**: Criar nova política RLS que permita SELECT público apenas para contagem, ou alterar a política existente para permitir leitura pública (os dados de participantes não contêm informações sensíveis além de nome/email/whatsapp — mas para segurança, criaremos uma política que permite apenas `count` via SELECT público).

Na prática, o Supabase não permite restringir a "apenas count" via RLS. A solução mais segura é:
- Criar uma **database function** `get_sorteio_count()` com `SECURITY DEFINER` que retorna apenas o COUNT
- Chamar essa função no frontend em vez do `.select("*", { count: "exact", head: true })`

Alternativa mais simples (aceitável pois os dados já são públicos — inseridos via formulário público):
- Alterar a política para `USING (true)` (permitir SELECT público)

### Problema 2: Cliques não registrados (0 na tabela)

**Causa raiz**: O INSERT provavelmente está falhando silenciosamente. A análise indica que o código NÃO verifica o `error` retornado pelo Supabase. Além disso, há uma falta de política UPDATE para `embaixadoras_cliques`, o que impede a atualização com dados de geolocalização.

Possíveis causas do INSERT falhar:
- Erro de JS no carregamento da página `/r/:codigo` no domínio customizado
- O `window.location.replace` pode interromper o request antes da resposta

**Correção**:
1. Remover o `.select('id').single()` do INSERT — não é necessário para o INSERT funcionar e pode causar problemas com a política SELECT que exige autenticação
2. Usar `fetch` direto para o INSERT (via REST API) como fire-and-forget, garantindo que o redirect não interrompa
3. Adicionar política UPDATE pública para `embaixadoras_cliques` (para o update de geo funcionar)
4. Adicionar tratamento de erro no INSERT

### Alterações necessárias

**Migration SQL**:
```sql
-- Permitir SELECT público em sorteio_participantes
DROP POLICY "select_admin" ON sorteio_participantes;
CREATE POLICY "select_publico" ON sorteio_participantes FOR SELECT USING (true);

-- Permitir UPDATE público em embaixadoras_cliques (para geo data)
CREATE POLICY "update_publico_cliques" ON embaixadoras_cliques FOR UPDATE USING (true) WITH CHECK (true);
```

**`src/pages/public/EmbaixadoraRedirect.tsx`**:
- Trocar `.insert({...}).select('id').single()` por `.insert({...})` sem `.select()` — evita conflito com SELECT policy
- Guardar os dados de geo para enviar junto no INSERT inicial (em vez de fazer UPDATE depois), eliminando a necessidade da política UPDATE
- Ou: manter o fluxo atual mas sem `.select()`, e adicionar a política UPDATE

**`src/pages/public/SorteioLanding.tsx`**: Nenhuma alteração necessária (o count vai funcionar automaticamente após a correção da RLS).

### Resumo das mudanças
1. **Migration**: 2 novas políticas RLS (SELECT público para participantes, UPDATE público para cliques)
2. **EmbaixadoraRedirect.tsx**: Remover `.select('id').single()` do INSERT de cliques, adicionar log de erro

