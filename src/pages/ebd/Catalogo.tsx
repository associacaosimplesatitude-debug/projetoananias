import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import { RevistaCard } from '@/components/ebd/RevistaCard';
import { RevistaDetailDialog } from '@/components/ebd/RevistaDetailDialog';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

const FAIXAS_ETARIAS = [
  "Jovens e Adultos",
  "Maternal: 2 a 3 Anos",
  "Jardim de Infância: 4 a 6 Anos",
  "Primários: 7 a 8 Anos",
  "Juniores: 9 a 11 Anos",
  "Adolescentes: 12 a 14 Anos",
  "Adolescentes+: 15 a 17 Anos",
] as const;

interface Revista {
  id: string;
  titulo: string;
  faixa_etaria_alvo: string;
  sinopse: string | null;
  autor: string | null;
  imagem_url: string | null;
  num_licoes: number;
  preco_cheio: number | null;
}

export default function Catalogo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const faixaSelecionada = searchParams.get('faixa') || FAIXAS_ETARIAS[0];
  const [selectedRevista, setSelectedRevista] = useState<Revista | null>(null);
  const [cart, setCart] = useState<{ [key: string]: number }>(() => {
    const saved = localStorage.getItem('ebd-cart');
    return saved ? JSON.parse(saved) : {};
  });

  const { data: revistas, isLoading } = useQuery({
    queryKey: ['ebd-revistas-catalogo', faixaSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_revistas')
        .select('*')
        .eq('faixa_etaria_alvo', faixaSelecionada)
        .order('titulo');

      if (error) throw error;
      return data as Revista[];
    },
  });

  const handleFaixaChange = (faixa: string) => {
    setSearchParams({ faixa });
  };

  const handleAddToCart = (revistaId: string) => {
    const newCart = { ...cart, [revistaId]: (cart[revistaId] || 0) + 1 };
    setCart(newCart);
    localStorage.setItem('ebd-cart', JSON.stringify(newCart));
  };

  const cartItemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🛒 Catálogo de Revistas</h1>
        <Button 
          variant="outline" 
          onClick={() => navigate('/ebd/carrinho')}
          className="relative"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Carrinho
          {cartItemCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {cartItemCount}
            </Badge>
          )}
        </Button>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Selecione a Faixa Etária:
        </h2>
        <div className="flex flex-wrap gap-2">
          {FAIXAS_ETARIAS.map((faixa) => (
            <Button
              key={faixa}
              variant={faixaSelecionada === faixa ? 'default' : 'outline'}
              onClick={() => handleFaixaChange(faixa)}
              size="sm"
            >
              {faixa}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Carregando revistas...</div>
      ) : !revistas || revistas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhuma revista encontrada para esta faixa etária.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {revistas.map((revista) => (
            <RevistaCard
              key={revista.id}
              revista={revista}
              onVerConteudo={() => setSelectedRevista(revista)}
              onAddToCart={() => handleAddToCart(revista.id)}
            />
          ))}
        </div>
      )}

      {selectedRevista && (
        <RevistaDetailDialog
          open={!!selectedRevista}
          onOpenChange={(open) => !open && setSelectedRevista(null)}
          revista={selectedRevista}
          onAddToCart={() => handleAddToCart(selectedRevista.id)}
        />
      )}
    </div>
  );
}
