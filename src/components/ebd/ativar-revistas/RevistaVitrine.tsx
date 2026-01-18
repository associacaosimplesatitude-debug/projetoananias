import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ShoppingCart, Loader2 } from "lucide-react";
import { ShopifyProduct } from "@/lib/shopify";

interface RevistaVitrineProps {
  revistas: ShopifyProduct[];
  revistasSelecionadas: ShopifyProduct[];
  onSelecionar: (produto: ShopifyProduct) => void;
  onAtivar: () => void;
  isLoading: boolean;
}

// Categorização por faixa etária
const FAIXAS_ETARIAS = [
  { id: 'jovens-adultos', nome: 'Jovens e Adultos', keywords: ['jovens', 'adultos', 'jovens e adultos'] },
  { id: 'adolescente-15-17', nome: 'Adolescente+ 15 a 17 Anos', keywords: ['15', '17', 'adolescentes+'] },
  { id: 'adolescente-12-14', nome: 'Adolescente 12 a 14 Anos', keywords: ['12', '14', 'adolescentes'] },
  { id: 'juniores', nome: 'Juniores 9 a 11 Anos', keywords: ['juniores', 'junior', '9 a 11'] },
  { id: 'primarios', nome: 'Primários 7 a 8 Anos', keywords: ['primários', 'primarios', '7 a 8'] },
  { id: 'jardim', nome: 'Jardim de Infância 4 a 6 Anos', keywords: ['jardim', 'infância', 'infancia', '4 a 6'] },
  { id: 'maternal', nome: 'Maternal 2 a 3 Anos', keywords: ['maternal', '2 a 3'] },
  { id: 'outros', nome: 'Outras Revistas', keywords: [] },
];

function categorizarRevista(title: string): string {
  const lowerTitle = title.toLowerCase();
  
  // Adolescente+ 15 a 17 - precisa ser verificado antes de adolescente genérico
  if ((lowerTitle.includes('adolescentes+') || lowerTitle.includes('adolescente+')) || 
      (lowerTitle.includes('adolescent') && (lowerTitle.includes('15') || lowerTitle.includes('17')))) {
    return 'adolescente-15-17';
  }
  
  // Adolescente 12 a 14
  if (lowerTitle.includes('adolescent') && (lowerTitle.includes('12') || lowerTitle.includes('14'))) {
    return 'adolescente-12-14';
  }
  
  // Jovens e Adultos
  if (lowerTitle.includes('jovens') || lowerTitle.includes('adultos')) {
    return 'jovens-adultos';
  }
  
  // Juniores
  if (lowerTitle.includes('junior') || lowerTitle.includes('juniores')) {
    return 'juniores';
  }
  
  // Primários
  if (lowerTitle.includes('primário') || lowerTitle.includes('primarios') || lowerTitle.includes('primários')) {
    return 'primarios';
  }
  
  // Jardim de Infância
  if (lowerTitle.includes('jardim') || lowerTitle.includes('infância') || lowerTitle.includes('infancia')) {
    return 'jardim';
  }
  
  // Maternal
  if (lowerTitle.includes('maternal')) {
    return 'maternal';
  }
  
  return 'outros';
}

export function RevistaVitrine({
  revistas,
  revistasSelecionadas,
  onSelecionar,
  onAtivar,
  isLoading,
}: RevistaVitrineProps) {
  
  // Agrupar revistas por categoria
  const revistasPorCategoria = FAIXAS_ETARIAS.map(faixa => ({
    ...faixa,
    revistas: revistas.filter(r => categorizarRevista(r.node.title) === faixa.id),
  })).filter(grupo => grupo.revistas.length > 0);

  const isSelecionada = (produto: ShopifyProduct) => 
    revistasSelecionadas.some(r => r.node.id === produto.node.id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando revistas...</span>
      </div>
    );
  }

  if (revistas.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma revista de aluno encontrada.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {revistasPorCategoria.map(grupo => (
        <div key={grupo.id}>
          <h3 className="text-lg font-semibold mb-4 border-b pb-2">{grupo.nome}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {grupo.revistas.map(produto => {
              const imagem = produto.node.images.edges[0]?.node.url;
              const selecionada = isSelecionada(produto);
              const preco = parseFloat(produto.node.priceRange.minVariantPrice.amount);
              
              return (
                <Card 
                  key={produto.node.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selecionada ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => onSelecionar(produto)}
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
                          Sem imagem
                        </div>
                      )}
                      {selecionada && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="bg-primary text-primary-foreground rounded-full p-2">
                            <Check className="h-6 w-6" />
                          </div>
                        </div>
                      )}
                    </div>
                    <h4 className="text-sm font-medium line-clamp-2 mb-1">
                      {produto.node.title}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      R$ {preco.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Botão flutuante para ativar */}
      {revistasSelecionadas.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button 
            size="lg" 
            onClick={onAtivar}
            className="shadow-lg"
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            Ativar {revistasSelecionadas.length} Revista{revistasSelecionadas.length > 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  );
}
