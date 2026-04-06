

## Diagnóstico

O screenshot mostra **"Erro ao carregar o PDF"** no iPhone. O problema é claro:

- O livro "Autoridade Espiritual" tem `pdf_url` preenchido **e** 144 imagens na `revista_licoes`
- O código atual prioriza PDF **sempre** (`usePdf = !!pdfUrl`)
- `react-pdf` falha no Safari mobile com PDFs grandes (80MB+)
- As 144 imagens existem mas nunca são usadas porque o PDF tem prioridade

## Solução

Adicionar detecção de mobile em `LivroDigitalLeitura.tsx` e inverter a prioridade: **no mobile, usar imagens primeiro; PDF só como fallback**.

## Passos

1. **Adicionar detecção mobile** usando o mesmo padrão já existente no projeto: `window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)`

2. **Ajustar lógica de prioridade** (linhas 93-95):
   - Desktop: PDF primeiro, imagens como fallback (comportamento atual)
   - Mobile: imagens primeiro, PDF só se não houver imagens

```
const isMobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const hasImages = !!paginasImagens && paginasImagens.length > 0;

const usePdf = isMobile ? (!hasImages && !!pdfUrl) : !!pdfUrl;
const useImages = isMobile ? hasImages : (!usePdf && hasImages);
```

3. **Arquivo alterado**: apenas `src/pages/ebd/aluno/LivroDigitalLeitura.tsx`

