import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Minus, Plus, ShoppingBag, Trash2, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface Revista {
  id: string;
  titulo: string;
  imagem_url: string | null;
  preco_cheio: number | null;
}

export default function Carrinho() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<{ [key: string]: number }>(() => {
    const saved = localStorage.getItem('ebd-cart');
    return saved ? JSON.parse(saved) : {};
  });

  const revistaIds = Object.keys(cart);

  const { data: revistas } = useQuery({
    queryKey: ['ebd-revistas-carrinho', revistaIds],
    queryFn: async () => {
      if (revistaIds.length === 0) return [];
      const { data, error } = await supabase
        .from('ebd_revistas')
        .select('id, titulo, imagem_url, preco_cheio')
        .in('id', revistaIds);

      if (error) throw error;
      return data as Revista[];
    },
    enabled: revistaIds.length > 0,
  });

  useEffect(() => {
    localStorage.setItem('ebd-cart', JSON.stringify(cart));
  }, [cart]);

  const updateQuantity = (revistaId: string, delta: number) => {
    const newQty = (cart[revistaId] || 0) + delta;
    if (newQty <= 0) {
      const newCart = { ...cart };
      delete newCart[revistaId];
      setCart(newCart);
    } else {
      setCart({ ...cart, [revistaId]: newQty });
    }
  };

  const removeItem = (revistaId: string) => {
    const newCart = { ...cart };
    delete newCart[revistaId];
    setCart(newCart);
  };

  const calculateTotal = () => {
    if (!revistas) return { subtotal: 0, total: 0 };
    const subtotal = revistas.reduce((sum, revista) => {
      const precoComDesconto = (revista.preco_cheio || 0) * 0.7;
      return sum + precoComDesconto * (cart[revista.id] || 0);
    }, 0);
    return { subtotal, total: subtotal };
  };

  const { subtotal, total } = calculateTotal();

  if (revistaIds.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Carrinho Vazio</h2>
          <p className="text-muted-foreground mb-6">
            Você ainda não adicionou nenhuma revista ao carrinho.
          </p>
          <Button onClick={() => navigate('/ebd/catalogo')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Ir para o Catálogo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🛒 Seu Carrinho</h1>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {revistas?.map((revista) => {
              const quantidade = cart[revista.id] || 0;
              const precoUnitario = (revista.preco_cheio || 0) * 0.7;
              const subtotalItem = precoUnitario * quantidade;

              return (
                <Card key={revista.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-20 h-28 bg-muted rounded overflow-hidden flex-shrink-0">
                        {revista.imagem_url ? (
                          <img
                            src={revista.imagem_url}
                            alt={revista.titulo}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            Sem imagem
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <h3 className="font-semibold mb-2">{revista.titulo}</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          R$ {precoUnitario.toFixed(2)} por unidade
                        </p>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(revista.id, -1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              value={quantidade}
                              onChange={(e) => {
                                const newQty = parseInt(e.target.value) || 0;
                                setCart({ ...cart, [revista.id]: Math.max(0, newQty) });
                              }}
                              className="w-16 text-center"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(revista.id, 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(revista.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remover
                          </Button>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-lg">
                          R$ {subtotalItem.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">R$ {subtotal.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-primary">R$ {total.toFixed(2)}</span>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => navigate('/ebd/checkout')}
                >
                  Finalizar Pedido
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/ebd/catalogo')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Escolher Mais Revistas
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
