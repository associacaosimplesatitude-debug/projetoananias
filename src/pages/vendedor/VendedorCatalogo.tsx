import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2,
  Check,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';

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

interface CartItem {
  revista: Revista;
  quantidade: number;
}

interface Cliente {
  id: string;
  nome_igreja: string;
  cnpj: string;
}

export default function VendedorCatalogo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clienteId = searchParams.get('clienteId');
  const clienteNome = searchParams.get('clienteNome');
  
  const [faixaSelecionada, setFaixaSelecionada] = useState<string>(FAIXAS_ETARIAS[0]);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Load cart from sessionStorage on mount
  useEffect(() => {
    const savedCart = sessionStorage.getItem('vendedor-cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Error loading cart:', e);
      }
    }
  }, []);

  // Save cart to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('vendedor-cart', JSON.stringify(cart));
  }, [cart]);

  const { data: revistas, isLoading } = useQuery({
    queryKey: ['ebd-revistas-catalogo-vendedor', faixaSelecionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_revistas')
        .select('id, titulo, faixa_etaria_alvo, sinopse, autor, imagem_url, num_licoes, preco_cheio, estoque, possui_plano_leitura')
        .eq('faixa_etaria_alvo', faixaSelecionada)
        .gt('estoque', 0)
        .order('titulo');

      if (error) throw error;
      return data as Revista[];
    },
  });

  const addToCart = (revista: Revista) => {
    const existing = cart.find((item) => item.revista.id === revista.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.revista.id === revista.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { revista, quantidade: 1 }]);
    }
    toast.success(`${revista.titulo} adicionada ao pedido`);
  };

  const removeFromCart = (revistaId: string) => {
    setCart(cart.filter((item) => item.revista.id !== revistaId));
  };

  const updateQuantity = (revistaId: string, quantidade: number) => {
    if (quantidade <= 0) {
      removeFromCart(revistaId);
      return;
    }
    setCart(
      cart.map((item) =>
        item.revista.id === revistaId ? { ...item, quantidade } : item
      )
    );
  };

  const cartTotal = cart.reduce(
    (total, item) => total + (item.revista.preco_cheio || 0) * item.quantidade,
    0
  );

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantidade, 0);

  const getCartQuantity = (revistaId: string) => {
    const item = cart.find((c) => c.revista.id === revistaId);
    return item ? item.quantidade : 0;
  };

  const handleVoltar = () => {
    // Clear cart and go back
    sessionStorage.removeItem('vendedor-cart');
    navigate('/vendedor');
  };

  const handleFinalizarPedido = () => {
    if (cart.length === 0) {
      toast.error('Adicione pelo menos um produto ao pedido');
      return;
    }
    
    // Navigate to activation step with cart data
    navigate(`/vendedor?step=ativacao&clienteId=${clienteId}&clienteNome=${encodeURIComponent(clienteNome || '')}`);
  };

  if (!clienteId || !clienteNome) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nenhum cliente selecionado. Volte e selecione um cliente primeiro.
            </p>
            <Button 
              className="mt-4"
              onClick={() => navigate('/vendedor')}
            >
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleVoltar}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Catálogo de Revistas</h1>
            <p className="text-muted-foreground">
              Cliente: <span className="font-medium text-foreground">{clienteNome}</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-base px-4 py-2">
            <ShoppingCart className="w-4 h-4 mr-2" />
            {cartItemCount} {cartItemCount === 1 ? 'item' : 'itens'} - R$ {cartTotal.toFixed(2)}
          </Badge>
          <Button 
            size="lg"
            onClick={handleFinalizarPedido}
            disabled={cart.length === 0}
          >
            <Check className="w-4 h-4 mr-2" />
            Finalizar Pedido e Ativação
          </Button>
        </div>
      </div>

      {/* Age Range Filter */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Filtrar por Faixa Etária:
        </h2>
        <div className="flex flex-wrap gap-2">
          {FAIXAS_ETARIAS.map((faixa) => (
            <Button
              key={faixa}
              variant={faixaSelecionada === faixa ? 'default' : 'outline'}
              onClick={() => setFaixaSelecionada(faixa)}
              size="sm"
            >
              {faixa}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Product Grid */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="text-center py-12">Carregando revistas...</div>
          ) : !revistas || revistas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma revista encontrada para esta faixa etária.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {revistas.map((revista) => {
                const inCart = getCartQuantity(revista.id);
                return (
                  <Card key={revista.id} className="overflow-hidden">
                    <div className="aspect-[3/4] bg-muted relative">
                      {revista.imagem_url ? (
                        <img
                          src={revista.imagem_url}
                          alt={revista.titulo}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="h-16 w-16 text-muted-foreground/30" />
                        </div>
                      )}
                      {inCart > 0 && (
                        <Badge className="absolute top-2 right-2 bg-primary">
                          {inCart} no pedido
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold line-clamp-2 mb-1">{revista.titulo}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {revista.faixa_etaria_alvo} • {revista.num_licoes} lições
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-primary">
                          R$ {(revista.preco_cheio || 0).toFixed(2)}
                        </span>
                        {inCart > 0 ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(revista.id, inCart - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-medium">{inCart}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(revista.id, inCart + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => addToCart(revista)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Adicionar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Pedido Atual
              </h3>
              
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum produto adicionado
                </p>
              ) : (
                <>
                  <ScrollArea className="h-[300px] pr-2">
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div
                          key={item.revista.id}
                          className="flex items-start gap-3 p-2 rounded-lg bg-muted/50"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-1">
                              {item.revista.titulo}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              R$ {(item.revista.preco_cheio || 0).toFixed(2)} × {item.quantidade}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateQuantity(item.revista.id, item.quantidade - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm">{item.quantidade}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateQuantity(item.revista.id, item.quantidade + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => removeFromCart(item.revista.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  <div className="border-t mt-4 pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-medium">Total:</span>
                      <span className="text-xl font-bold text-primary">
                        R$ {cartTotal.toFixed(2)}
                      </span>
                    </div>
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleFinalizarPedido}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Finalizar e Ativar
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
