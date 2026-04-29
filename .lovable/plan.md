## Objetivo

Adicionar um botão "Visualizar" (ícone de olho 👁️) na linha de cada livro digital e infográfico em `/admin/ebd/revistas-digitais`, permitindo abrir uma pré-visualização das páginas reais do conteúdo direto do admin — sem precisar entrar pelo portal do aluno.

Revistas comuns ficam intocadas.

## Onde

Arquivo único: `src/pages/admin/RevistasDigitais.tsx`.

## O que adicionar

### 1. Botão na coluna de ações (linha ~1344-1350)

Para `tipo_conteudo IN ('livro_digital', 'infografico')`, adicionar antes do botão Editar:

```
<Button size="sm" variant="ghost" onClick={() => setPreviewRevista(r)} title="Visualizar páginas">
  <Eye className="h-4 w-4" />
</Button>
```

`Eye` já está importado (linha 14).

### 2. Estado novo

```ts
const [previewRevista, setPreviewRevista] = useState<any>(null);
```

### 3. Modal de visualização

Novo `<Dialog open={!!previewRevista} onOpenChange={(o)=>!o && setPreviewRevista(null)}>` com:

- **Header**: capa pequena + título + autor + badge "X páginas".
- **Corpo (scroll vertical)**: grid responsivo (2 cols mobile, 3-4 desktop) com TODAS as páginas em ordem, numeradas (overlay no canto). Cada miniatura clicável abre um lightbox simples (estado `lightboxIndex`) que mostra a página em tamanho grande com setas ◀ ▶ pra navegar e tecla Esc/X pra fechar.
- **Loading**: spinner enquanto busca; **Vazio**: mensagem "Nenhuma página cadastrada ainda".
- `max-w-5xl max-h-[90vh] overflow-hidden` com `overflow-y-auto` no corpo.

### 4. Query das páginas

Reaproveita a mesma query `["revista-livro-paginas", id]` já criada na implementação anterior do modal de edição — só muda a key pro `previewRevista?.id`:

```ts
const { data: previewPaginas, isLoading: previewLoading } = useQuery({
  queryKey: ["revista-livro-paginas", previewRevista?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from("revista_licoes")
      .select("paginas")
      .eq("revista_id", previewRevista!.id)
      .eq("numero", 1)
      .maybeSingle();
    return (data?.paginas as string[]) || [];
  },
  enabled: !!previewRevista,
});
```

(Se já existir essa query no arquivo apontando pra `editingRevista`, deixar a do preview separada com key distinta `["revista-preview-paginas", id]` pra não conflitar.)

### 5. Lightbox interno (sem nova lib)

Estado `const [lightboxIndex, setLightboxIndex] = useState<number|null>(null);` — div fixed `inset-0 z-[60] bg-black/95` com `<img>` centralizada, botões ◀ ▶ nos lados, X no topo direito, contador "12 / 144" no rodapé. Listener de teclado (ArrowLeft/ArrowRight/Escape) via `useEffect`.

## Restrições

- Não toca em revistas (`tipo === 'revista'`) — botão só aparece pra livro/infográfico.
- Sem mudança de schema, RLS ou edge function.
- Sem nova dependência (usa `<img>` puro, mesmo padrão do `LivroDigitalLeitura.tsx`).
- Mantém shadcn/ui + Tailwind.

## Resultado

Admin abre `/admin/ebd/revistas-digitais`, vê na linha "Livro Autoridade Espiritual" três botões: 👁️ Visualizar | ✏️ Editar | 🗑️ Excluir. Clica no olho → modal abre com grid de 144 miniaturas numeradas → clica em qualquer uma → lightbox fullscreen com navegação por teclado/setas.
