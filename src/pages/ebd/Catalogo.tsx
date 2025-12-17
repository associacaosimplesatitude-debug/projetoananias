import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { RevistaCard } from '@/components/ebd/RevistaCard';
import { RevistaDetailDialog } from '@/components/ebd/RevistaDetailDialog';
import { FaturamentoModeDialog } from '@/components/ebd/FaturamentoModeDialog';
import { ShoppingCart, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
  estoque: number | null;
  possui_plano_leitura: boolean;
}

export default function Catalogo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const faixaSelecionada = searchParams.get('faixa') || FAIXAS_ETARIAS[0];
  const [selectedRevista, setSelectedRevista] = useState<Revista | null>(null);
  const [showFaturamentoModal, setShowFaturamentoModal] = useState(false);
  const [cart, setCart] = useState<{ [key: string]: number }>(() => {
    const saved = localStorage.getItem('ebd-cart');
    return saved ? JSON.parse(saved) : {};
  });

  // Verificar se cliente pode faturar e buscar vendedor
  const { data: clienteData } = useQuery({
    queryKey: ['cliente-pode-faturar'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('ebd_clientes')
        .select(`
          id, 
          pode_faturar,
          vendedor:vendedores(id, nome, foto_url)
        `)
        .eq('superintendente_user_id', user.id)
        .single();

      if (error) {
        console.log('Cliente não encontrado:', error);
        return null;
      }
      return data;
    },
  });

  const podeFaturar = clienteData?.pode_faturar || false;
  const vendedor = clienteData?.vendedor as { id: string; nome: string; foto_url: string | null } | null;
  const { data: revistas, isLoading } = useQuery({
    queryKey: ['ebd-revistas-catalogo', faixaSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_revistas')
        .select('id, titulo, faixa_etaria_alvo, sinopse, autor, imagem_url, num_licoes, preco_cheio, estoque, possui_plano_leitura')
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

  const handleGoToCart = () => {
    if (cartItemCount === 0) {
      navigate('/ebd/carrinho');
      return;
    }

    // Se cliente pode faturar, mostrar modal de escolha
    if (podeFaturar) {
      setShowFaturamentoModal(true);
    } else {
      // Fluxo normal
      navigate('/ebd/carrinho');
    }
  };

  const handleSelectBling = () => {
    setShowFaturamentoModal(false);
    // Navegar para checkout Bling
    localStorage.setItem('ebd-checkout-mode', 'bling');
    navigate('/ebd/checkout-bling');
  };

  const handleSelectNormal = () => {
    setShowFaturamentoModal(false);
    // Fluxo normal
    localStorage.setItem('ebd-checkout-mode', 'normal');
    navigate('/ebd/carrinho');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">🛒 Catálogo de Revistas</h1>
          {vendedor && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={vendedor.foto_url || undefined} alt={vendedor.nome} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                Consultor(a): <span className="font-medium text-foreground">{vendedor.nome}</span>
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => navigate('/ebd/my-orders')}
          >
            Meus Pedidos
          </Button>
          <Button 
            variant="outline" 
            onClick={handleGoToCart}
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

      <FaturamentoModeDialog
        open={showFaturamentoModal}
        onOpenChange={setShowFaturamentoModal}
        onSelectBling={handleSelectBling}
        onSelectNormal={handleSelectNormal}
      />
    </div>
  );
}
