

## Plano: Adicionar tipo de conteúdo "Infográficos"

### O que será feito

Adicionar a opção **"Infográficos"** no seletor de Tipo de Conteúdo da página de Revistas Digitais, funcionando exatamente como "Livro Digital" (leitura contínua, sem lições, upload de páginas).

### Implementação

**Arquivo único: `src/pages/admin/RevistasDigitais.tsx`**

1. **Adicionar opção no Select** (linha ~946): incluir `<SelectItem value="infografico">Infográficos</SelectItem>`

2. **Atualizar todas as condições `livro_digital`** para incluir `infografico` — são ~10 pontos no código onde `tipoConteudo === 'livro_digital'` ou `tipo_conteudo === 'livro_digital'` controla:
   - Ocultar campos de tipo/trimestre/total de lições
   - Definir `leitura_continua: true`
   - Habilitar upload de páginas
   - Exibir "páginas" em vez de "lições" na tabela
   - Ocultar botão "Gerir Lições"
   - Validação do formulário

3. **Criar helper para simplificar**: `const isLivroOuInfo = tipoConteudo === 'livro_digital' || tipoConteudo === 'infografico'` e substituir todas as comparações por essa variável.

4. **Tabela de listagem**: mostrar ícone/label adequado para infográficos (ex: 📊) ao lado de 📖 (livro) e 📰 (revista).

### Nenhuma alteração no banco de dados
O campo `tipo_conteudo` já é `text`, aceita qualquer valor.

