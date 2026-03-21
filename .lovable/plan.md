

## Correção: Layout mobile da página Sorteio & Embaixadoras

### Problemas identificados
1. **TabsList com `grid-cols-4`** (linha 1418): em telas de 390px, 4 colunas comprimem o texto das abas, causando sobreposição.
2. **Cards de sessão** com botões Editar/Excluir/Ativar lado a lado (linha 230): em mobile os botões se sobrepõem.
3. **Cabeçalho "Sessões de Sorteio" + botão "Nova Sessão"** na mesma linha sem wrap.

### Alterações

**Arquivo: `src/pages/admin/SorteioAdmin.tsx`**

1. **TabsList** (linha 1418): Trocar `grid w-full grid-cols-4` por layout com scroll horizontal:
   ```
   <TabsList className="flex w-full overflow-x-auto">
   ```
   Isso permite scroll lateral em mobile sem comprimir texto.

2. **Botões dos cards de sessão** (linhas 230-278): Mudar de `flex gap-2` para `flex flex-wrap gap-2` para que os botões quebrem linha em telas menores.

3. **Cabeçalho "Sessões de Sorteio"** (linhas 150-151): Adicionar `flex-wrap` no container para que o botão "Nova Sessão" quebre para a linha de baixo em mobile.

