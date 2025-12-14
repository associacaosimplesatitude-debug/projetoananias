import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { FaturamentoModeDialog } from '@/components/vendedor/FaturamentoModeDialog';

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
  { value: "Geral", label: "Geral" },
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
  const hasCleared = useRef(false);
  const hasShownModal = useRef(false);
  
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>("all");
  const [faixaSelecionada, setFaixaSelecionada] = useState<string>("all");
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [showFaturamentoModal, setShowFaturamentoModal] = useState(false);
  const [modoBling, setModoBling] = useState(false);

  // Fetch client data to check pode_faturar
  const { data: cliente } = useQuery({
    queryKey: ['cliente-catalogo', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from('ebd_clientes')
        .select('id, nome_igreja, pode_faturar')
        .eq('id', clienteId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });

  // Clear cart when entering from a new order (clienteId changes) and initialize
  useEffect(() => {
    if (clienteId && !hasCleared.current) {
      // Clear cart for new order
      localStorage.removeItem('ebd-cart');
      sessionStorage.removeItem('modo-bling');
      setCart({});
      setModoBling(false);
      hasCleared.current = true;
    }
  }, [clienteId]);

  // Show modal if client can be invoiced
  useEffect(() => {
    if (cliente?.pode_faturar && !hasShownModal.current && hasCleared.current) {
      setShowFaturamentoModal(true);
      hasShownModal.current = true;
    }
  }, [cliente?.pode_faturar]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (hasCleared.current) {
      localStorage.setItem('ebd-cart', JSON.stringify(cart));
    }
  }, [cart]);

  // Also save client info to sessionStorage for checkout - save clienteId to fetch full data
  useEffect(() => {
    if (clienteId && clienteNome) {
      sessionStorage.setItem('vendedor-cliente-id', clienteId);
      sessionStorage.setItem('vendedor-cliente-nome', clienteNome);
    }
  }, [clienteId, clienteNome]);

  const handleSelectFaturamento = () => {
    setModoBling(true);
    sessionStorage.setItem('modo-bling', 'true');
    setShowFaturamentoModal(false);
    toast.success('Modo Faturamento B2B ativado! O pedido será enviado para o Bling.');
  };

  const handleSelectPadrao = () => {
    setModoBling(false);
    sessionStorage.removeItem('modo-bling');
    setShowFaturamentoModal(false);
    toast.info('Usando pagamento padrão (PIX, Cartão ou Boleto).');
  };

  // Fetch all cart items info for sidebar display
  const cartItemIds = Object.keys(cart).filter(id => cart[id] > 0);
  const { data: allCartRevistas } = useQuery({
    queryKey: ['ebd-revistas-cart-sidebar', cartItemIds],
    queryFn: async () => {
      if (cartItemIds.length === 0) return [];
      const { data, error } = await supabase
        .from('ebd_revistas')
        .select('id, titulo, preco_cheio')
        .in('id', cartItemIds);
      if (error) throw error;
      return data;
    },
    enabled: cartItemIds.length > 0,
  });

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

  const cartItemCount = Object.values(cart).filter(qty => qty > 0).reduce((sum, qty) => sum + qty, 0);

  const handleVoltar = () => {
    navigate('/vendedor');
  };

  const handleIrParaCarrinho = () => {
    if (cartItemCount === 0) {
      toast.error('Adicione pelo menos um produto ao carrinho');
      return;
    }
    // If in Bling mode, go to Bling checkout
    if (modoBling) {
      navigate('/ebd/checkout-bling');
    } else {
      navigate('/ebd/carrinho');
    }
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
        
        <FaturamentoModeDialog
          open={showFaturamentoModal}
          onOpenChange={setShowFaturamentoModal}
          clienteNome={clienteNome || ''}
          onSelectFaturamento={handleSelectFaturamento}
          onSelectPadrão={handleSelectPadrao}
        />
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
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">
                Cliente: <span className="font-medium text-foreground">{clienteNome}</span>
              </p>
              {modoBling && (
                <Badge className="bg-blue-500 text-white">
                  Modo Faturamento
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <Button 
          size="lg"
          onClick={handleIrParaCarrinho}
          className={modoBling ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          {modoBling ? 'Enviar para Faturamento' : 'Ir para o Carrinho'}
          {cartItemCount > 0 && (
            <Badge variant="secondary" className="ml-2 bg-background text-foreground">
              {cartItemCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 max-w-xs">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Categoria
          </label>
          <Select value={categoriaSelecionada} onValueChange={setCategoriaSelecionada}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 max-w-xs">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Faixa Etária
          </label>
          <Select value={faixaSelecionada} onValueChange={setFaixaSelecionada}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma faixa etária" />
            </SelectTrigger>
            <SelectContent>
              {FAIXAS_ETARIAS.map((faixa) => (
                <SelectItem key={faixa.value} value={faixa.value}>
                  {faixa.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                      {allCartRevistas?.map((revista) => (
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
                      className={`w-full ${modoBling ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                      size="lg"
                      onClick={handleIrParaCarrinho}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {modoBling ? 'Enviar para Faturamento' : 'Ir para o Carrinho'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Faturamento Mode Modal */}
      <FaturamentoModeDialog
        open={showFaturamentoModal}
        onOpenChange={setShowFaturamentoModal}
        clienteNome={clienteNome || ''}
        onSelectFaturamento={handleSelectFaturamento}
        onSelectPadrão={handleSelectPadrao}
      />
    </div>
  );
}
