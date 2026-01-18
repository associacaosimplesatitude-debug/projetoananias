import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchShopifyProducts, ShopifyProduct } from "@/lib/shopify";
import { RevistaAtivarModal } from "@/components/ebd/ativar-revistas/RevistaAtivarModal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen } from "lucide-react";

// Categorização por faixa etária
const FAIXAS_ETARIAS = [
  { nome: "Maternal (0-3 anos)", keywords: ["maternal", "berçário", "bercario", "0 a 3", "0-3"] },
  { nome: "Jardim de Infância (4-5 anos)", keywords: ["jardim de infância", "jardim de infancia", "4 a 5", "4-5"] },
  { nome: "Primários (6-8 anos)", keywords: ["primário", "primario", "primários", "primarios", "6 a 8", "6-8"] },
  { nome: "Juniores (9-11 anos)", keywords: ["junior", "júnior", "juniores", "9 a 11", "9-11"] },
  { nome: "Pré-Adolescentes (12-14 anos)", keywords: ["pré-adolescente", "pre-adolescente", "preadolescente", "12 a 14", "12-14"] },
  { nome: "Adolescentes (15-17 anos)", keywords: ["adolescente", "15 a 17", "15-17"] },
  { nome: "Jovens e Adultos", keywords: ["jovens", "adultos", "jovens e adultos"] },
  { nome: "Outros", keywords: [] },
];

function categorizarRevista(title: string): string {
  const lower = title.toLowerCase();
  for (const faixa of FAIXAS_ETARIAS) {
    if (faixa.keywords.some((kw) => lower.includes(kw))) {
      return faixa.nome;
    }
  }
  return "Outros";
}

export default function AtivarRevistas() {
  const queryClient = useQueryClient();
  const [revistaSelecionada, setRevistaSelecionada] = useState<ShopifyProduct | null>(null);

  // Buscar produtos da Shopify
  const { data: produtos, isLoading } = useQuery({
    queryKey: ["shopify-products-revistas-all"],
    queryFn: () => fetchShopifyProducts(500),
  });

  // Filtrar apenas revistas de aluno
  const revistasAluno =
    produtos?.filter((produto) => {
      const title = produto.node.title.toLowerCase();

      const isRevista =
        title.includes("revista") ||
        (title.includes("estudo") && title.includes("bíblico")) ||
        (title.includes("estudo") && title.includes("biblico")) ||
        title.includes("ebd");

      const isProfessor = title.includes("professor");
      const isKit = title.includes("kit");
      const isLivroApoio = title.includes("livro de apoio") || title.includes("livro apoio");
      const isInfografico = title.includes("infográfico") || title.includes("infografico");
      const isRecurso = title.includes("recurso didático") || title.includes("recurso didatico");

      const isAluno = title.includes("aluno");

      return isRevista && !isProfessor && !isKit && !isLivroApoio && !isInfografico && !isRecurso && isAluno;
    }) || [];

  // Agrupar por faixa etária
  const revistasPorFaixa = FAIXAS_ETARIAS.map((faixa) => ({
    faixa: faixa.nome,
    revistas: revistasAluno.filter((r) => categorizarRevista(r.node.title) === faixa.nome),
  })).filter((grupo) => grupo.revistas.length > 0);

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['ebd-planejamentos-with-turmas'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando revistas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ativar Revistas</h1>
        <p className="text-muted-foreground">
          Clique em uma revista para configurar turma, data e escala de professores
        </p>
      </div>

      {revistasPorFaixa.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma revista de aluno encontrada</p>
        </div>
      ) : (
        revistasPorFaixa.map((grupo) => (
          <div key={grupo.faixa} className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Badge variant="secondary">{grupo.faixa}</Badge>
              <span className="text-sm font-normal text-muted-foreground">
                ({grupo.revistas.length} {grupo.revistas.length === 1 ? 'revista' : 'revistas'})
              </span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {grupo.revistas.map((produto) => {
                const imagem = produto.node.images.edges[0]?.node.url;
                const preco = produto.node.variants.edges[0]?.node.price.amount;

                return (
                  <Card
                    key={produto.node.id}
                    className="cursor-pointer transition-all hover:shadow-lg hover:ring-2 hover:ring-primary/50"
                    onClick={() => setRevistaSelecionada(produto)}
                  >
                    <CardContent className="p-3">
                      <div className="relative aspect-[3/4] mb-2 bg-muted rounded overflow-hidden">
                        {imagem ? (
                          <img
                            src={imagem}
                            alt={produto.node.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <BookOpen className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <h4 className="text-sm font-medium line-clamp-2 mb-1">
                        {produto.node.title}
                      </h4>
                      {preco && (
                        <p className="text-sm text-primary font-semibold">
                          R$ {parseFloat(preco).toFixed(2).replace('.', ',')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Modal de ativação */}
      <RevistaAtivarModal
        produto={revistaSelecionada}
        open={!!revistaSelecionada}
        onOpenChange={(open) => !open && setRevistaSelecionada(null)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
