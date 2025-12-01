import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Eye } from 'lucide-react';

interface RevistaCardProps {
  revista: {
    id: string;
    titulo: string;
    imagem_url: string | null;
    preco_cheio: number | null;
    autor: string | null;
  };
  onVerConteudo: () => void;
  onAddToCart: () => void;
}

export function RevistaCard({ revista, onVerConteudo, onAddToCart }: RevistaCardProps) {
  const precoNormal = revista.preco_cheio || 0;
  const precoComDesconto = precoNormal * 0.7; // 30% de desconto

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="p-0">
        <div className="aspect-[3/4] bg-muted relative overflow-hidden">
          {revista.imagem_url ? (
            <img
              src={revista.imagem_url}
              alt={revista.titulo}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              Sem imagem
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
          {revista.titulo}
        </h3>
        
        {revista.autor && (
          <p className="text-xs text-muted-foreground mb-3">
            Autor: {revista.autor}
          </p>
        )}
        
        <div className="space-y-1">
          {precoNormal > 0 ? (
            <>
              <p className="text-sm text-muted-foreground line-through">
                De: R$ {precoNormal.toFixed(2)}
              </p>
              <p className="text-xl font-bold text-primary">
                Por: R$ {precoComDesconto.toFixed(2)}
              </p>
            </>
          ) : (
            <p className="text-xl font-bold text-primary">GRATUITO</p>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onVerConteudo}
          className="flex-1"
        >
          <Eye className="w-4 h-4 mr-1" />
          Ver Conteúdo
        </Button>
        <Button
          size="sm"
          onClick={onAddToCart}
          className="flex-1"
        >
          <ShoppingCart className="w-4 h-4 mr-1" />
          Adicionar
        </Button>
      </CardFooter>
    </Card>
  );
}
