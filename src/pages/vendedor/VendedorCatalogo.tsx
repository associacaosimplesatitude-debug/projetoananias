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
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIAS = [
  { value: "all", label: "Todos os Produtos" },
  { value: "Revista EBD", label: "Revista EBD" },
  { value: "Livros", label: "Livros" },
  { value: "Devocionais", label: "Devocionais" },
  { value: "Kits", label: "Kits" },
  { value: "Outros", label: "Outros" },
] as const;

const FAIXAS_ETARIAS = [
  { value: "all", label: "Todas as Faixas" },
  { value: "Jovens e Adultos", label: "Jovens e Adultos" },
  { value: "Maternal: 2 a 3 Anos", label: "Maternal: 2 a 3 Anos" },
  { value: "Jardim de Infância: 4 a 6 Anos", label: "Jardim de Infância: 4 a 6 Anos" },
  { value: "Primários: 7 a 8 Anos", label: "Primários: 7 a 8 Anos" },
  { value: "Juniores: 9 a 11 Anos", label: "Juniores: 9 a 11 Anos" },
  { value: "Adolescentes: 12 a 14 Anos", label: "Adolescentes: 12 a 14 Anos" },
  { value: "Adolescentes+: 15 a 17 Anos", label: "Adolescentes+: 15 a 17 Anos" },
] as const;

interface Revista {
  id: string;
  titulo: string;
  faixa_etaria_alvo: string;
  categoria: string | null;
  sinopse: string | null;
  autor: string | null;
  imagem_url: string | null;
  num_licoes: number;
  preco_cheio: number | null;
  estoque: number | null;
  possui_plano_leitura: boolean;
}

export default function VendedorCatalogo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clienteId = searchParams.get('clienteId');
  const clienteNome = searchParams.get('clienteNome');
  
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>("all");
  const [faixaSelecionada, setFaixaSelecionada] = useState<string>("all");
  const [cart, setCart] = useState<{ [key: string]: number }>(() => {
    const saved = localStorage.getItem('ebd-cart');
    return saved ? JSON.parse(saved) : {};
  });

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('ebd-cart', JSON.stringify(cart));
  }, [cart]);

  // Also save client info to sessionStorage for checkout
  useEffect(() => {
    if (clienteId && clienteNome) {
      sessionStorage.setItem('vendedor-cliente', JSON.stringify({ id: clienteId, nome: clienteNome }));
    }
  }, [clienteId, clienteNome]);

  const { data: revistas, isLoading } = useQuery({
    queryKey: ['ebd-revistas-catalogo-vendedor', categoriaSelecionada, faixaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from('ebd_revistas')
        .select('id, titulo, faixa_etaria_alvo, categoria, sinopse, autor, imagem_url, num_licoes, preco_cheio, estoque, possui_plano_leitura')
        .gt('estoque', 0)
        .order('titulo');

      if (categoriaSelecionada !== "all") {
        query = query.eq('categoria', categoriaSelecionada);
      }
      
      if (faixaSelecionada !== "all") {
        query = query.eq('faixa_etaria_alvo', faixaSelecionada);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Revista[];
    },
  });

  const addToCart = (revistaId: string) => {
    const newCart = { ...cart, [revistaId]: (cart[revistaId] || 0) + 1 };
    setCart(newCart);
    toast.success('Produto adicionado ao carrinho');
  };

  const removeFromCart = (revistaId: string) => {
    const newCart = { ...cart };
    delete newCart[revistaId];
    setCart(newCart);
  };

  const updateQuantity = (revistaId: string, quantidade: number) => {
    if (quantidade <= 0) {
      removeFromCart(revistaId);
      return;
    }
    setCart({ ...cart, [revistaId]: quantidade });
  };

  const cartItemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  const handleVoltar = () => {
    navigate('/vendedor');
  };

  const handleIrParaCarrinho = () => {
    if (cartItemCount === 0) {
      toast.error('Adicione pelo menos um produto ao carrinho');
      return;
    }
    navigate('/ebd/carrinho');
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
            <h1 className="text-2xl font-bold">Catálogo de Produtos</h1>
            <p className="text-muted-foreground">
              Cliente: <span className="font-medium text-foreground">{clienteNome}</span>
            </p>
          </div>
        </div>
        
        <Button 
          size="lg"
          onClick={handleIrParaCarrinho}
          className="relative"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Ir para o Carrinho
          {cartItemCount > 0 && (
            <Badge variant="secondary" className="ml-2 bg-background text-foreground">
              {cartItemCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Category Filter */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Categoria:
          </h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((cat) => (
              <Button
                key={cat.value}
                variant={categoriaSelecionada === cat.value ? 'default' : 'outline'}
                onClick={() => setCategoriaSelecionada(cat.value)}
                size="sm"
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Subcategory Filter (Age Range) */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Subcategoria (Faixa Etária):
          </h2>
          <div className="flex flex-wrap gap-2">
            {FAIXAS_ETARIAS.map((faixa) => (
              <Button
                key={faixa.value}
                variant={faixaSelecionada === faixa.value ? 'default' : 'outline'}
                onClick={() => setFaixaSelecionada(faixa.value)}
                size="sm"
              >
                {faixa.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Product Grid */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="text-center py-12">Carregando produtos...</div>
          ) : !revistas || revistas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum produto encontrado com os filtros selecionados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {revistas.map((revista) => {
                const inCart = cart[revista.id] || 0;
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
                          {inCart} no carrinho
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold line-clamp-2 mb-1">{revista.titulo}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {revista.faixa_etaria_alvo} • {revista.num_licoes} lições
                      </p>
                      {revista.categoria && (
                        <Badge variant="outline" className="mb-2">{revista.categoria}</Badge>
                      )}
                      <div className="flex items-center justify-between mt-2">
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
                          <Button size="sm" onClick={() => addToCart(revista.id)}>
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
                Carrinho
              </h3>
              
              {cartItemCount === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum produto adicionado
                </p>
              ) : (
                <>
                  <ScrollArea className="h-[300px] pr-2">
                    <div className="space-y-3">
                      {revistas?.filter(r => cart[r.id] > 0).map((revista) => (
                        <div
                          key={revista.id}
                          className="flex items-start gap-3 p-2 rounded-lg bg-muted/50"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-1">
                              {revista.titulo}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              R$ {(revista.preco_cheio || 0).toFixed(2)} × {cart[revista.id]}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateQuantity(revista.id, cart[revista.id] - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm">{cart[revista.id]}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateQuantity(revista.id, cart[revista.id] + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => removeFromCart(revista.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  <div className="border-t mt-4 pt-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      {cartItemCount} {cartItemCount === 1 ? 'item' : 'itens'} no carrinho
                    </p>
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleIrParaCarrinho}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Ir para o Carrinho
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
