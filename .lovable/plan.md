

## Plano: Mover upload de PDF para o modal da revista

### Problema
O upload de PDF está em cada lição individualmente, mas o PDF é um arquivo único da revista inteira. Deve ficar no modal de edição/criação da revista.

### Solução

**Arquivo: `src/pages/admin/RevistasDigitais.tsx`**

1. **No modal da revista** (Dialog, linhas 522-647): Adicionar botão "Subir PDF Completo" abaixo do painel de capa. Ao selecionar o PDF:
   - Renderiza todas as páginas via `pdfjs-dist`
   - Distribui automaticamente as páginas entre as lições existentes (ex: PDF de 52 páginas ÷ 13 lições = 4 páginas por lição)
   - Se for criação (nova revista), salva a revista primeiro, cria as lições, depois distribui
   - Se for edição, distribui nas lições já existentes

2. **Na gestão de lições** (linhas 449-471): Remover o botão "Subir PDF" de cada lição individual. Manter apenas o upload de imagens avulsas e o botão "Gerar Quiz IA".

3. **Novo estado**: `pdfFile` e `uploadingPdfGlobal` no componente principal para controlar o upload global.

4. **Nova função `handleGlobalPdfUpload`**: 
   - Recebe o arquivo PDF e o ID da revista
   - Busca as lições da revista
   - Renderiza cada página do PDF como PNG
   - Distribui páginas sequencialmente entre as lições (páginas extras vão para a última lição)
   - Upload de cada imagem para `revistas/{revistaId}/licao-{n}/{ordem}.png`
   - Atualiza o campo `paginas` de cada lição

### Fluxo visual no modal

```text
┌─────────────────────────────────────────┐
│  [Formulário]          [Capa da Revista]│
│  Título...                  [imagem]    │
│  Tipo / Trimestre          Remover capa │
│  Descrição                              │
│  ...                   ┌──────────────┐ │
│                        │ PDF Completo │ │
│  [Salvar Revista]      │ 📄 Subir PDF │ │
│                        └──────────────┘ │
└─────────────────────────────────────────┘
```

O botão de PDF fica no painel direito, abaixo da capa. Ao clicar, seleciona o arquivo. Após salvar a revista, as páginas do PDF são processadas e distribuídas.

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `RevistasDigitais.tsx` | Mover PDF upload para modal, remover de cada lição, nova função de distribuição |

