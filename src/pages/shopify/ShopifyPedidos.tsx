import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ShoppingCart, Search, Plus, Minus, Trash2, ExternalLink, Loader2, ArrowLeft, Users } from "lucide-react";
import { fetchShopifyProducts, ShopifyProduct, CartItem } from "@/lib/shopify";
import { useShopifyCartStore } from "@/stores/shopifyCartStore";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useVendedor } from "@/hooks/useVendedor";
import { FaturamentoSelectionDialog } from "@/components/shopify/FaturamentoSelectionDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface Cliente {
  id: string;
  nome_igreja: string;
  cnpj: string;
  email_superintendente: string | null;
  telefone: string | null;
  nome_responsavel: string | null;
  endereco_cep: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  pode_faturar: boolean;
}

export default function ShopifyPedidos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Read client info from URL params (for vendedor flow)
  const urlClienteId = searchParams.get('clienteId');
  const urlClienteNome = searchParams.get('clienteNome');
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [showFaturamentoDialog, setShowFaturamentoDialog] = useState(false);
  const [faturamentoConfig, setFaturamentoConfig] = useState<{
    prazo: string;
    desconto: number;
    frete: { type: string; cost: number };
  } | null>(null);
  
  // Get vendedor info for the logged-in user
  const { vendedor, isLoading: isLoadingVendedor } = useVendedor();
  
  // Check if user is a vendedor
  const isVendedor = !!vendedor;
  
  const { 
    items, 
    addItem, 
    updateQuantity, 
    removeItem, 
    clearCart,
    isLoading: isCheckoutLoading 
  } = useShopifyCartStore();

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['shopify-products-all'],
    queryFn: () => fetchShopifyProducts(500), // Buscar até 500 produtos (paginação automática)
  });

  // Fetch client from URL param (for vendedor flow)
  const { data: urlCliente, isLoading: isLoadingUrlCliente } = useQuery({
    queryKey: ['ebd-cliente-url', urlClienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_clientes')
        .select('*')
        .eq('id', urlClienteId!)
        .single();
      
      if (error) throw error;
      return data as Cliente;
    },
    enabled: !!urlClienteId,
  });

  // Only fetch clients if user is a vendedor and no URL param
  const { data: clientes, isLoading: isLoadingClientes } = useQuery({
    queryKey: ['ebd-clientes-shopify'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_clientes')
        .select('*')
        .order('nome_igreja');
      
      if (error) throw error;
      return data as Cliente[];
    },
    enabled: isVendedor && !urlClienteId,
  });

  // Get logged-in user's client data if not a vendedor
  const { data: userCliente, isLoading: isLoadingUserCliente } = useQuery({
    queryKey: ['user-cliente-shopify'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return null;
      
      const { data, error } = await supabase
        .from('ebd_clientes')
        .select('*')
        .eq('email_superintendente', user.email)
        .maybeSingle();
      
      if (error) throw error;
      return data as Cliente | null;
    },
    enabled: !isVendedor && !isLoadingVendedor && !urlClienteId,
  });
  
  // Check if still loading client info
  const isLoadingClientInfo = isLoadingVendedor || isLoadingUrlCliente || (!isVendedor && !urlClienteId && isLoadingUserCliente);

  // Auto-select client based on: URL param > user client (non-vendedor) 
  useEffect(() => {
    if (urlCliente) {
      setSelectedCliente(urlCliente);
    } else if (!isLoadingVendedor && !isVendedor && userCliente) {
      setSelectedCliente(userCliente);
    }
  }, [urlCliente, isLoadingVendedor, isVendedor, userCliente]);

  const filteredProducts = products?.filter(product =>
    product.node.title.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);

  const handleAddToCart = (product: ShopifyProduct) => {
    const variant = product.node.variants.edges[0]?.node;
    if (!variant) {
      toast.error("Produto sem variante disponível");
      return;
    }

    const cartItem: CartItem = {
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions || []
    };
    
    addItem(cartItem);
    toast.success("Produto adicionado ao carrinho", { position: "top-center" });
  };

  const handleCheckoutClick = () => {
    if (!selectedCliente) {
      toast.error("Selecione um cliente");
      return;
    }

    if (items.length === 0) {
      toast.error("Adicione produtos ao carrinho");
      return;
    }

    // Check if client can use B2B invoicing
    if (selectedCliente.pode_faturar && isVendedor) {
      setShowFaturamentoDialog(true);
    } else {
      // Normal checkout flow
      handleCreateDraftOrder(null, 0, null);
    }
  };

  const handleSelectFaturamento = (prazo: string, desconto: number, frete: { type: string; cost: number }) => {
    setFaturamentoConfig({ prazo, desconto, frete });
    setShowFaturamentoDialog(false);
    handleCreateDraftOrder(prazo, desconto, frete);
  };

  const handleSelectPagamentoPadrao = () => {
    setShowFaturamentoDialog(false);
    handleCreateDraftOrder(null, 0, null);
  };

  const handleCreateDraftOrder = async (
    faturamentoPrazo: string | null, 
    descontoPercent: number = 0, 
    frete: { type: string; cost: number } | null = null
  ) => {
    if (!selectedCliente) {
      toast.error("Selecione um cliente");
      return;
    }

    if (items.length === 0) {
      toast.error("Adicione produtos ao carrinho");
      return;
    }

    setIsCreatingDraft(true);

    try {
      const { data, error } = await supabase.functions.invoke('ebd-shopify-order-create', {
        body: {
          cliente: selectedCliente,
          vendedor_id: vendedor?.id,
          vendedor_nome: vendedor?.nome,
          items: items.map(item => ({
            variantId: item.variantId,
            quantity: item.quantity,
            title: item.product.node.title,
            price: item.price.amount
          })),
          ...(faturamentoPrazo && {
            forma_pagamento: 'FATURAMENTO',
            faturamento_prazo: faturamentoPrazo,
            desconto_percentual: descontoPercent.toString(),
            valor_frete: frete?.cost?.toString() || '0',
            metodo_frete: frete?.type || 'free',
          })
        }
      });

      if (error) throw error;
      
      // Check if response contains an error (Bling validation errors)
      if (data?.error) {
        throw new Error(data.error);
      }

      // For faturamento B2B, don't redirect to checkout - just show success
      if (data?.isFaturamento && data?.blingOrderId) {
        const blingIdentifier = data.blingOrderNumber || data.blingOrderId;
        toast.success(`Pedido faturado em ${data.faturamentoPrazo} dias criado com sucesso no Bling!`, {
          description: `Identificador do pedido Bling: ${blingIdentifier}`,
          duration: 5000,
        });
        clearCart();
        setSelectedCliente(null);
        setIsCartOpen(false);
        setFaturamentoConfig(null);

        // Navigate to vendedor orders page if vendedor
        if (isVendedor) {
          navigate('/vendedor/pedidos');
        }
      } else if (data?.invoiceUrl) {
        // Normal checkout flow
        toast.success("Pedido criado com sucesso!");
        clearCart();
        setSelectedCliente(null);
        setIsCartOpen(false);
        setFaturamentoConfig(null);
        window.open(data.invoiceUrl, '_blank');
      } else {
        throw new Error("Resposta inesperada do servidor");
      }
    } catch (error: any) {
      console.error("Erro ao criar pedido:", error);
      // Try to extract detailed error message
      let errorMessage = "Erro ao criar pedido. Tente novamente.";
      if (error?.message) {
        try {
          // Try to parse if it's a JSON string
          const parsed = JSON.parse(error.message);
          errorMessage = parsed.error || error.message;
        } catch {
          errorMessage = error.message;
        }
      }
      toast.error(errorMessage, { duration: 8000 });
    } finally {
      setIsCreatingDraft(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {urlClienteNome ? `Novo Pedido para ${urlClienteNome}` : 'Novo Pedido'}
              </h1>
              {selectedCliente && !urlClienteNome && (
                <p className="text-muted-foreground text-sm">
                  Cliente: {selectedCliente.nome_igreja}
                </p>
              )}
            </div>
          </div>

          <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="relative">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Carrinho
                {totalItems > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                    {totalItems}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            
            <SheetContent className="w-full sm:max-w-lg flex flex-col h-full">
              <SheetHeader className="flex-shrink-0">
                <SheetTitle>Carrinho de Pedido</SheetTitle>
                <SheetDescription>
                  {totalItems === 0 ? "Carrinho vazio" : `${totalItems} item${totalItems !== 1 ? 's' : ''}`}
                </SheetDescription>
              </SheetHeader>
              
              <div className="flex flex-col flex-1 pt-6 min-h-0">
                {/* Cliente Selection - Only show for vendedores when no URL param */}
                {isVendedor && !urlClienteId && (
                  <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                    <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Selecionar Cliente
                    </label>
                    <Select
                      value={selectedCliente?.id || ""}
                      onValueChange={(value) => {
                        const cliente = clientes?.find(c => c.id === value);
                        setSelectedCliente(cliente || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes?.map((cliente) => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.nome_igreja}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedCliente && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <p>CNPJ: {selectedCliente.cnpj}</p>
                        {selectedCliente.email_superintendente && (
                          <p>Email: {selectedCliente.email_superintendente}</p>
                        )}
                        {selectedCliente.pode_faturar && (
                          <Badge variant="secondary" className="mt-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            B2B - Pode Faturar 30/60/90 dias
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Show selected client info when URL param is present or for non-vendedores */}
                {(urlClienteId || (!isVendedor && selectedCliente)) && selectedCliente && (
                  <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                    <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Pedido para:
                    </label>
                    <p className="font-medium">{selectedCliente.nome_igreja}</p>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <p>CNPJ: {selectedCliente.cnpj}</p>
                      {selectedCliente.pode_faturar && isVendedor && (
                        <Badge variant="secondary" className="mt-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          B2B - Pode Faturar 30/60/90 dias
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {items.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Seu carrinho está vazio</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto pr-2 min-h-0">
                      <div className="space-y-4">
                        {items.map((item) => (
                          <div key={item.variantId} className="flex gap-4 p-2 border rounded-lg">
                            <div className="w-16 h-16 bg-secondary/20 rounded-md overflow-hidden flex-shrink-0">
                              {item.product.node.images?.edges?.[0]?.node && (
                                <img
                                  src={item.product.node.images.edges[0].node.url}
                                  alt={item.product.node.title}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm line-clamp-2">{item.product.node.title}</h4>
                              <p className="font-semibold text-sm mt-1">
                                R$ {parseFloat(item.price.amount).toFixed(2)}
                              </p>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeItem(item.variantId)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                              
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center text-sm">{item.quantity}</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 space-y-4 pt-4 border-t bg-background">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">Total</span>
                        <span className="text-xl font-bold">
                          R$ {totalPrice.toFixed(2)}
                        </span>
                      </div>
                      
                        <Button 
                          onClick={handleCheckoutClick}
                          className="w-full" 
                          size="lg"
                          disabled={items.length === 0 || !selectedCliente || isLoadingClientInfo || isCreatingDraft}
                        >
                          {isCreatingDraft ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Criando Pedido...
                            </>
                          ) : isLoadingClientInfo ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Carregando...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Criar Pedido
                            </>
                          )}
                        </Button>
                    </div>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Products Grid */}
        {isLoadingProducts ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-40 w-full mb-4" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => {
              const variant = product.node.variants.edges[0]?.node;
              const price = variant?.price.amount || "0";
              const image = product.node.images.edges[0]?.node;
              const inCart = items.find(item => item.variantId === variant?.id);

              return (
                <Card key={product.node.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-square bg-secondary/10 relative">
                    {image ? (
                      <img
                        src={image.url}
                        alt={image.altText || product.node.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    {inCart && (
                      <Badge className="absolute top-2 right-2">
                        {inCart.quantity}x
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium text-sm line-clamp-2 mb-2">
                      {product.node.title}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg">
                        R$ {parseFloat(price).toFixed(2)}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(product)}
                        disabled={!variant?.availableForSale}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                    {!variant?.availableForSale && (
                      <p className="text-xs text-destructive mt-2">Indisponível</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Faturamento Selection Dialog */}
      <FaturamentoSelectionDialog
        open={showFaturamentoDialog}
        onOpenChange={setShowFaturamentoDialog}
        clienteNome={selectedCliente?.nome_igreja || ''}
        clienteCep={selectedCliente?.endereco_cep || null}
        totalProdutos={totalPrice}
        items={items.map(item => ({ quantity: item.quantity }))}
        onSelectFaturamento={handleSelectFaturamento}
        onSelectPagamentoPadrao={handleSelectPagamentoPadrao}
      />
    </div>
  );
}
