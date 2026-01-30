
# Plano: Enriquecer a Landing Page do Livro "O Cativeiro Babilônico"

## Resumo do Problema
A landing page atual está muito básica/vazia, mostrando apenas:
- Título e capa do livro
- Nome do autor (sem foto ou bio)
- Preço genérico do banco de dados (não o correto de R$ 49,90)
- Descrição simples (se existir no banco)

Você forneceu um conteúdo **muito rico** que precisa ser exibido na página:
- Descrição completa do livro
- Biografia do autor (Pr. Ronald Gustavo)
- Especificações técnicas (páginas, formato, ISBN, SKU, etc.)
- Diferenciais do produto
- Fotos profissionais da capa e do autor

## Estratégia de Implementação

### 1. Upload das Imagens para o Projeto
Copiar as 3 imagens fornecidas para a pasta de assets:
- `LATERAL.webp` → imagem principal da capa 3D
- `FRENTE-E-VERSO-1.webp` → imagem alternativa (frente e verso)
- `ronald.jpg` → foto do autor

### 2. Redesenhar a Landing Page com Seções Ricas

A nova estrutura terá:

```text
+------------------------------------------+
|  HEADER (Logo + Botão Comprar)           |
+------------------------------------------+
|                                          |
|  HERO: Capa 3D + Título + Subtítulo      |
|  "Setenta Anos de Exílio, Fé e Esperança"|
|  Preço: R$ 49,90 + Botão CTA             |
|                                          |
+------------------------------------------+
|                                          |
|  SOBRE O LIVRO (descrição completa)      |
|  - 2 parágrafos do conteúdo fornecido    |
|                                          |
+------------------------------------------+
|                                          |
|  DIFERENCIAIS (cards ou bullets)         |
|  • Estudo completo e acessível...        |
|  • Conteúdo sólido para professores...   |
|  • Contexto histórico, profético...      |
|  • Excelente complemento para EBD...     |
|  • Material ideal para aulas...          |
|                                          |
+------------------------------------------+
|                                          |
|  SOBRE O AUTOR                           |
|  [Foto do Pr. Ronald] + Bio completa     |
|                                          |
+------------------------------------------+
|                                          |
|  ESPECIFICAÇÕES TÉCNICAS (tabela/grid)   |
|  Páginas: 208 | Formato: 15,5x23cm       |
|  ISBN: 978-65-5760-142-6 | SKU: 33476    |
|                                          |
+------------------------------------------+
|                                          |
|  VÍDEO (se existir no link)              |
|                                          |
+------------------------------------------+
|                                          |
|  CTA FINAL (banner verde)                |
|  "Adquira seu exemplar agora!"           |
|  Botão: Comprar por R$ 49,90             |
|                                          |
+------------------------------------------+
|  FOOTER                                  |
+------------------------------------------+
```

### 3. Abordagem Híbrida para os Dados

Para este livro específico, vamos:
1. **Usar dados dinâmicos do banco** para: título, link de compra, vídeo (se tiver), código do afiliado
2. **Usar o campo `descricao_lp`** do affiliate link para a descrição customizada (vamos atualizar no banco)
3. **Adicionar campos extras no banco** para suportar especificações técnicas e bio do autor

### 4. Alterações no Banco de Dados

Criar novos campos para armazenar as informações extras:

**Tabela `royalties_livros`:**
- `subtitulo` (text) - "Setenta Anos de Exílio, Fé e Esperança"
- `especificacoes` (jsonb) - páginas, formato, ISBN, SKU, acabamento, categoria
- `diferenciais` (text[]) - lista de diferenciais

**Tabela `royalties_autores`:**
- `foto_url` (text) - URL da foto do autor
- `bio` (text) - biografia completa

### 5. Design Visual Aprimorado

- Cores inspiradas na capa do livro (tons de bordô/marsala + dourado)
- Tipografia elegante para combinar com o tema histórico/bíblico
- Ícones decorativos (BookOpen, Star, Award, etc.)
- Sombras e profundidade nas imagens

## Arquivos que Serão Modificados

1. **Novo:** `src/assets/livros/cativeiro-babilonico-capa.webp`
2. **Novo:** `src/assets/autores/ronald-gustavo.jpg`
3. **Modificado:** `src/pages/public/LivroLandingPage.tsx` - layout totalmente redesenhado
4. **Migration SQL:** adicionar campos `subtitulo`, `especificacoes`, `diferenciais` em livros + `foto_url`, `bio` em autores

## Detalhes Técnicos

### Estrutura do JSONB `especificacoes`:
```json
{
  "paginas": 208,
  "formato": "15,5 x 23 cm",
  "acabamento": "Brochura (capa em papel supremo e miolo em pólen)",
  "categoria": "Estudo Bíblico / Teologia",
  "isbn": "978-65-5760-142-6",
  "sku": "33476"
}
```

### Componentes da Nova Landing Page:
- `HeroSection` - capa 3D + título + subtítulo + preço + CTA
- `AboutBookSection` - descrição completa
- `DiferenciaisSection` - cards com ícones
- `AboutAuthorSection` - foto + bio
- `SpecsSection` - tabela de especificações
- `VideoSection` - embed do YouTube (se existir)
- `FinalCTASection` - banner verde final

### RLS para novos campos:
Os novos campos herdam as políticas RLS existentes, então não precisam de configuração adicional.

## Resultado Esperado

Uma landing page profissional e completa que:
- Mostra todas as informações do livro de forma organizada
- Tem design visual atraente e compatível com a identidade da Central Gospel
- Funciona bem em desktop e mobile
- Converte visitantes em compradores com múltiplos CTAs estratégicos
- Pode ser reutilizada para outros livros (basta preencher os campos no banco)
