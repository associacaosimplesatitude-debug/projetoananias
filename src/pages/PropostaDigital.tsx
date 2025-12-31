import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, Loader2, MapPin, Building2, Package, ShoppingCart, Truck, CreditCard } from "lucide-react";

interface PropostaItem {
  variantId: string;
  quantity: number;
  title: string;
  price: string;
  imageUrl?: string;
}

interface ShippingOption {
  type: string;
  label: string;
  cost: number;
  days?: number;
  endereco?: string;
  horario?: string;
}

interface Proposta {
  id: string;
  token: string;
  cliente_id: string | null;
  cliente_nome: string;
  cliente_cnpj: string | null;
  cliente_email: string | null; // Email do cliente (via ebd_clientes)
  cliente_telefone: string | null; // Telefone do cliente (via ebd_clientes)
  cliente_endereco: {
    rua?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  } | null;
  itens: PropostaItem[];
  valor_produtos: number;
  valor_frete: number;
  valor_total: number;
  desconto_percentual: number;
  status: string;
  created_at: string;
  confirmado_em: string | null;
  metodo_frete: string | null;
  pode_faturar: boolean;
  prazo_faturamento_selecionado: string | null;
  vendedor_nome: string | null;
  prazos_disponiveis: string[] | null;
  payment_link: string | null;
}

export default function PropostaDigital() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);
  const [selectedPrazo, setSelectedPrazo] = useState<string>("30");
  const [selectedFrete, setSelectedFrete] = useState<string>("");
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);

  const { data: proposta, isLoading, error } = useQuery({
    queryKey: ["proposta", token],
    queryFn: async () => {
      // Buscar proposta com join no cliente para pegar email/telefone
      const { data, error } = await supabase
        .from("vendedor_propostas")
        .select(`
          *,
          ebd_clientes:cliente_id (
            email_superintendente,
            telefone
          )
        `)
        .eq("token", token!)
        .single();

      if (error) throw error;
      
      // Parse itens from JSON if necessary
      const clienteData = data.ebd_clientes as { email_superintendente: string | null; telefone: string | null } | null;
      
      const parsedData = {
        ...data,
        itens: typeof data.itens === 'string' ? JSON.parse(data.itens) : data.itens,
        cliente_endereco: typeof data.cliente_endereco === 'string' 
          ? JSON.parse(data.cliente_endereco) 
          : data.cliente_endereco,
        cliente_email: clienteData?.email_superintendente || null,
        cliente_telefone: clienteData?.telefone || null,
      };
      
      return parsedData as Proposta;
    },
    enabled: !!token,
  });

  // Fetch shipping options for standard payment
  useEffect(() => {
    if (proposta && !proposta.pode_faturar && proposta.status === "PROPOSTA_PENDENTE" && proposta.cliente_endereco?.cep) {
      fetchShippingOptions();
    }
  }, [proposta]);

  // Auto-select first available prazo for B2B
  useEffect(() => {
    if (proposta?.pode_faturar && proposta.prazos_disponiveis?.length) {
      setSelectedPrazo(proposta.prazos_disponiveis[0]);
    }
  }, [proposta]);

  const fetchShippingOptions = async () => {
    if (!proposta?.cliente_endereco?.cep) return;

    setIsLoadingShipping(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-shipping', {
        body: {
          cep: proposta.cliente_endereco.cep,
          items: proposta.itens.map(item => ({ quantity: item.quantity })),
        }
      });

      if (error) throw error;

      const options: ShippingOption[] = [];
      
      // Add PAC option
      if (data?.pac) {
        options.push({
          type: 'pac',
          label: `PAC - ${data.pac.days} dias úteis`,
          cost: data.pac.cost,
          days: data.pac.days,
        });
      }

      // Add SEDEX option
      if (data?.sedex) {
        options.push({
          type: 'sedex',
          label: `SEDEX - ${data.sedex.days} dias úteis`,
          cost: data.sedex.cost,
          days: data.sedex.days,
        });
      }

      // Add Retirada na Matriz - always free
      options.push({
        type: 'retirada',
        label: 'Retirada na Matriz',
        cost: 0,
        endereco: 'Estrada do Guerenguê, 1851 - Taquara, Rio de Janeiro - RJ',
        horario: 'Segunda a Sexta: 9h às 18h'
      });

      // Add free shipping if total >= R$199,90
      const valorComDesconto = proposta.valor_produtos - (proposta.valor_produtos * (proposta.desconto_percentual || 0) / 100);
      if (valorComDesconto >= 199.90) {
        // Insert free shipping before retirada
        const retiradaOption = options.pop();
        options.push({ type: 'free', label: 'Frete Grátis (compras acima de R$199,90)', cost: 0 });
        if (retiradaOption) options.push(retiradaOption);
      }

      setShippingOptions(options);
      
      // Auto-select free if available, otherwise first option
      if (valorComDesconto >= 199.90) {
        setSelectedFrete('free');
      } else if (options.length > 0) {
        setSelectedFrete(options[0].type);
      }
    } catch (error) {
      console.error('Error fetching shipping:', error);
      // Fallback options
      const valorComDesconto = proposta.valor_produtos - (proposta.valor_produtos * (proposta.desconto_percentual || 0) / 100);
      const fallbackOptions: ShippingOption[] = [
        { type: 'pac', label: 'PAC - 8 dias úteis', cost: 15, days: 8 },
        { type: 'sedex', label: 'SEDEX - 3 dias úteis', cost: 25, days: 3 },
        { 
          type: 'retirada', 
          label: 'Retirada na Matriz', 
          cost: 0,
          endereco: 'Estrada do Guerenguê, 1851 - Taquara, Rio de Janeiro - RJ',
          horario: 'Segunda a Sexta: 9h às 18h'
        },
      ];
      if (valorComDesconto >= 199.90) {
        fallbackOptions.splice(2, 0, { type: 'free', label: 'Frete Grátis (compras acima de R$199,90)', cost: 0 });
      }
      setShippingOptions(fallbackOptions);
      if (valorComDesconto >= 199.90) {
        setSelectedFrete('free');
      } else {
        setSelectedFrete('pac');
      }
    } finally {
      setIsLoadingShipping(false);
    }
  };

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const updateData: any = { 
        status: "PROPOSTA_ACEITA",
        confirmado_em: new Date().toISOString()
      };
      
      // If B2B, save selected prazo
      if (proposta?.pode_faturar) {
        updateData.prazo_faturamento_selecionado = selectedPrazo;
      } else {
        // For standard payment, save selected shipping
        const selectedShipping = shippingOptions.find(opt => opt.type === selectedFrete);
        if (selectedShipping) {
          updateData.metodo_frete = selectedFrete;
          updateData.valor_frete = selectedShipping.cost;
          // Recalculate total with selected shipping
          const valorComDesconto = proposta!.valor_produtos - (proposta!.valor_produtos * (proposta!.desconto_percentual || 0) / 100);
          updateData.valor_total = valorComDesconto + selectedShipping.cost;
        }
      }

      const { data, error } = await supabase
        .from("vendedor_propostas")
        .update(updateData)
        .eq("token", token!)
        .select()
        .single();

      if (error) throw error;
      
      // For standard payment (not B2B), automatically create draft order and open checkout
      if (!proposta?.pode_faturar) {
        const clienteData = {
          id: proposta!.cliente_id || "",
          nome_igreja: proposta!.cliente_nome,
          cnpj: proposta!.cliente_cnpj || "",
          email_superintendente: proposta!.cliente_email || null,
          telefone: proposta!.cliente_telefone || null,
          nome_responsavel: proposta!.cliente_nome,
          endereco_cep: proposta!.cliente_endereco?.cep || null,
          endereco_rua: proposta!.cliente_endereco?.rua || null,
          endereco_numero: proposta!.cliente_endereco?.numero || null,
          endereco_bairro: proposta!.cliente_endereco?.bairro || null,
          endereco_cidade: proposta!.cliente_endereco?.cidade || null,
          endereco_estado: proposta!.cliente_endereco?.estado || null,
        };

        const selectedShipping = shippingOptions.find(opt => opt.type === selectedFrete);

        const { data: orderData, error: orderError } = await supabase.functions.invoke('ebd-shopify-order-create', {
          body: {
            cliente: clienteData,
            items: proposta!.itens,
            valor_frete: (selectedShipping?.cost || 0).toString(),
            metodo_frete: selectedFrete || 'free',
            desconto_percentual: (proposta!.desconto_percentual || 0).toString(),
          }
        });

        if (orderError) {
          console.error("Error creating order:", orderError);
          throw new Error("Erro ao criar pedido. Entre em contato com o vendedor.");
        }

        if (orderData?.error) {
          throw new Error(orderData.error);
        }

        // Save checkout URL and update status to AGUARDANDO_PAGAMENTO
        const checkoutUrl = orderData?.checkoutUrl || orderData?.cartUrl || orderData?.invoiceUrl;
        console.log("Checkout URL received from backend:", checkoutUrl);

        if (checkoutUrl) {
          console.log("Saving payment_link and updating status...");
          const { error: updateError } = await supabase
            .from("vendedor_propostas")
            .update({
              status: "AGUARDANDO_PAGAMENTO",
              payment_link: checkoutUrl,
            })
            .eq("token", token!);

          if (updateError) {
            console.error("Error saving payment_link:", updateError);
          } else {
            console.log("Payment link saved, redirecting to:", checkoutUrl);
          }

          // Redirect direto para a página de carrinho/pagamento (checkout)
          window.location.assign(checkoutUrl);
          return data; // Return early since we're redirecting
        } else {
          console.error("No checkoutUrl received from backend:", orderData);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposta", token] });
      if (proposta?.pode_faturar) {
        toast.success("Proposta confirmada com sucesso!");
      } else {
        toast.success("Proposta confirmada! Redirecionando para pagamento...");
      }
    },
    onError: (error: any) => {
      toast.error("Erro ao confirmar proposta: " + error.message);
    },
  });

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await confirmMutation.mutateAsync();
    } finally {
      setIsConfirming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  if (error || !proposta) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-bold mb-2">Proposta não encontrada</h2>
            <p className="text-muted-foreground">
              Este link pode ter expirado ou a proposta já foi removida.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPending = proposta.status === "PROPOSTA_PENDENTE";
  const isAccepted = proposta.status === "PROPOSTA_ACEITA";
  const isAguardandoPagamento = proposta.status === "AGUARDANDO_PAGAMENTO";

  // Calculate installment values
  const valorComDesconto = proposta.valor_produtos - (proposta.valor_produtos * proposta.desconto_percentual / 100);
  const valorTotalFinal = valorComDesconto + proposta.valor_frete;
  const parcela2x = valorTotalFinal / 2;
  const parcela3x = valorTotalFinal / 3;

  // Format shipping method name
  const getFreteLabel = () => {
    if (!proposta.metodo_frete || proposta.metodo_frete === 'free') return 'Frete Grátis';
    if (proposta.metodo_frete === 'pac') return 'PAC (Correios)';
    if (proposta.metodo_frete === 'sedex') return 'SEDEX (Correios)';
    if (proposta.metodo_frete === 'retirada') return 'Retirada na Matriz';
    return proposta.metodo_frete;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Logo */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <img 
            src="/logos/logo-central-gospel.png" 
            alt="Central Gospel Editora" 
            className="h-16 object-contain"
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Status Banner */}
        {isAccepted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">Proposta Confirmada!</p>
              <p className="text-sm text-green-600">
                Confirmada em {new Date(proposta.confirmado_em!).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
                {proposta.prazo_faturamento_selecionado && (
                  <> • Prazo selecionado: {proposta.prazo_faturamento_selecionado} dias</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Aguardando Pagamento Banner with Payment Button */}
        {isAguardandoPagamento && proposta.payment_link && (
          <Card className="border-2 border-yellow-400 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4">
                <div className="text-center">
                  <p className="font-semibold text-yellow-800 text-lg">Proposta Confirmada - Aguardando Pagamento</p>
                  <p className="text-sm text-yellow-700">
                    Clique no botão abaixo para finalizar sua compra
                  </p>
                </div>
                <Button
                  onClick={() => window.open(proposta.payment_link!, '_blank')}
                  className="w-full h-14 text-lg bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                  size="lg"
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Ir para Pagamento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Dados do Cliente
              </CardTitle>
              <Badge variant={isPending ? "secondary" : isAguardandoPagamento ? "outline" : "default"}>
                {isPending ? "Pendente" : isAguardandoPagamento ? "Aguardando Pagamento" : "Confirmada"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold text-lg">{proposta.cliente_nome}</p>
              {proposta.cliente_cnpj && (
                <p className="text-muted-foreground">CNPJ: {proposta.cliente_cnpj}</p>
              )}
            </div>
            
            {proposta.cliente_endereco && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  {proposta.cliente_endereco.rua && `${proposta.cliente_endereco.rua}, `}
                  {proposta.cliente_endereco.numero && `${proposta.cliente_endereco.numero} - `}
                  {proposta.cliente_endereco.bairro && `${proposta.cliente_endereco.bairro}, `}
                  {proposta.cliente_endereco.cidade && `${proposta.cliente_endereco.cidade}`}
                  {proposta.cliente_endereco.estado && `/${proposta.cliente_endereco.estado}`}
                  {proposta.cliente_endereco.cep && ` - CEP: ${proposta.cliente_endereco.cep}`}
                </p>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Proposta criada em {new Date(proposta.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
              {proposta.vendedor_nome && <> • Vendedor: {proposta.vendedor_nome}</>}
            </p>
          </CardContent>
        </Card>

        {/* Items List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Itens da Proposta ({proposta.itens.length} {proposta.itens.length === 1 ? 'item' : 'itens'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proposta.itens.map((item, index) => {
                const precoOriginal = parseFloat(item.price) * item.quantity;
                const precoComDesconto = proposta.desconto_percentual > 0 
                  ? precoOriginal * (1 - proposta.desconto_percentual / 100)
                  : precoOriginal;
                const temDesconto = proposta.desconto_percentual > 0;
                
                return (
                  <div 
                    key={`${item.variantId}-${index}`}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                  >
                    {item.imageUrl ? (
                      <img 
                        src={item.imageUrl} 
                        alt={item.title}
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                        <ShoppingCart className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Quantidade: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      {temDesconto ? (
                        <>
                          <p className="text-sm text-muted-foreground line-through">
                            R$ {precoOriginal.toFixed(2)}
                          </p>
                          <p className="font-semibold text-green-600">
                            R$ {precoComDesconto.toFixed(2)}
                          </p>
                        </>
                      ) : (
                        <p className="font-semibold">
                          R$ {precoOriginal.toFixed(2)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        R$ {parseFloat(item.price).toFixed(2)} cada
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="mt-6 pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal dos produtos:</span>
                <span className={proposta.desconto_percentual > 0 ? "text-muted-foreground line-through" : ""}>
                  R$ {proposta.valor_produtos.toFixed(2)}
                </span>
              </div>
              
              {proposta.desconto_percentual > 0 && (
                <>
                  <div className="flex justify-between text-sm text-green-600 font-medium">
                    <span>Desconto ({proposta.desconto_percentual}%):</span>
                    <span>- R$ {(proposta.valor_produtos * proposta.desconto_percentual / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span>Subtotal com desconto:</span>
                    <span>R$ {valorComDesconto.toFixed(2)}</span>
                  </div>
                </>
              )}
              
              {/* Shipping Section - Only show for B2B or when already confirmed */}
              {(proposta.pode_faturar || !isPending) && (
                <div className="flex justify-between text-sm items-center">
                  <span className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    {getFreteLabel()}:
                  </span>
                  <span className={proposta.valor_frete === 0 ? "text-green-600 font-medium" : ""}>
                    {proposta.valor_frete === 0 ? "Grátis" : `R$ ${proposta.valor_frete.toFixed(2)}`}
                  </span>
                </div>
              )}
              
              {/* For standard payment pending, show that shipping will be selected below */}
              {!proposta.pode_faturar && isPending && (
                <div className="flex justify-between text-sm items-center text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Frete:
                  </span>
                  <span className="italic">Selecione abaixo</span>
                </div>
              )}
              
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span>
                  R$ {proposta.pode_faturar || !isPending 
                    ? proposta.valor_total.toFixed(2)
                    : (valorComDesconto + (shippingOptions.find(opt => opt.type === selectedFrete)?.cost || 0)).toFixed(2)
                  }
                </span>
              </div>
              
              {/* "Você economizou" section */}
              {proposta.desconto_percentual > 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">
                      Você economizou: R$ {(proposta.valor_produtos * proposta.desconto_percentual / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Address Section - Show for standard payment */}
        {!proposta.pode_faturar && isPending && proposta.cliente_endereco && (
          <Card className="border-2 border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <MapPin className="h-5 w-5" />
                Endereço de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-white rounded-lg border border-blue-200">
                <p className="font-medium text-foreground">
                  {proposta.cliente_endereco.rua}, {proposta.cliente_endereco.numero}
                  {proposta.cliente_endereco.bairro && ` - ${proposta.cliente_endereco.bairro}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {proposta.cliente_endereco.cidade}/{proposta.cliente_endereco.estado} - CEP: {proposta.cliente_endereco.cep}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shipping Selection for Standard Payment */}
        {!proposta.pode_faturar && isPending && (
          <Card className="border-2 border-green-200 bg-green-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Truck className="h-5 w-5" />
                Escolha a Forma de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-700 mb-4">
                Selecione a opção de frete de sua preferência:
              </p>
              
              {isLoadingShipping ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                  <span className="ml-2 text-sm text-green-700">Calculando opções de frete...</span>
                </div>
              ) : (
                <RadioGroup
                  value={selectedFrete}
                  onValueChange={setSelectedFrete}
                  className="space-y-3"
                >
                  {shippingOptions.map((option) => (
                    <div 
                      key={option.type}
                      className={`flex items-start space-x-3 p-3 bg-white rounded-lg border transition-colors ${
                        option.type === 'retirada' 
                          ? 'border-green-300 hover:border-green-500' 
                          : 'border-green-200 hover:border-green-400'
                      }`}
                    >
                      <RadioGroupItem value={option.type} id={`frete-${option.type}`} className="mt-1" />
                      <Label htmlFor={`frete-${option.type}`} className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium flex items-center gap-2">
                              {option.type === 'retirada' && <MapPin className="h-4 w-4 text-green-600" />}
                              {option.label}
                              {option.cost === 0 && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                  Frete Grátis
                                </Badge>
                              )}
                            </span>
                            {option.endereco && (
                              <p className="text-xs text-muted-foreground mt-1">{option.endereco}</p>
                            )}
                            {option.horario && (
                              <p className="text-xs text-muted-foreground">{option.horario}</p>
                            )}
                          </div>
                          <span className={option.cost === 0 ? "text-green-600 font-semibold" : "font-semibold"}>
                            {option.cost === 0 ? 'Grátis' : `R$ ${option.cost.toFixed(2)}`}
                          </span>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
              
              {shippingOptions.length === 0 && !isLoadingShipping && (
                <p className="text-sm text-amber-600">
                  Não foi possível calcular o frete. Entre em contato com o vendedor.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* B2B Payment Conditions */}
        {proposta.pode_faturar && isPending && (
          <Card className="border-2 border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <CreditCard className="h-5 w-5" />
                Condições de Pagamento (Faturamento B2B)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-700 mb-4">
                {(proposta.prazos_disponiveis?.length || 0) > 1 
                  ? "Escolha o prazo de pagamento de sua preferência:"
                  : "Prazo de pagamento disponível:"}
              </p>
              
              <RadioGroup
                value={selectedPrazo}
                onValueChange={setSelectedPrazo}
                className="space-y-3"
              >
                {/* Only show the prazos that were selected by the seller */}
                {(proposta.prazos_disponiveis || ['30', '60', '90']).includes('30') && (
                  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-400 transition-colors">
                    <RadioGroupItem value="30" id="prazo-30" />
                    <Label htmlFor="prazo-30" className="flex-1 cursor-pointer">
                      <span className="font-medium">30 dias</span>
                      <span className="text-muted-foreground ml-2">
                        - 1x de R$ {valorTotalFinal.toFixed(2)}
                      </span>
                    </Label>
                  </div>
                )}
                
                {(proposta.prazos_disponiveis || ['30', '60', '90']).includes('60') && (
                  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-400 transition-colors">
                    <RadioGroupItem value="60" id="prazo-60" />
                    <Label htmlFor="prazo-60" className="flex-1 cursor-pointer">
                      <span className="font-medium">60 dias</span>
                      <span className="text-muted-foreground ml-2">
                        - 2x de R$ {parcela2x.toFixed(2)} (30/60 dias)
                      </span>
                    </Label>
                  </div>
                )}
                
                {(proposta.prazos_disponiveis || ['30', '60', '90']).includes('90') && (
                  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-400 transition-colors">
                    <RadioGroupItem value="90" id="prazo-90" />
                    <Label htmlFor="prazo-90" className="flex-1 cursor-pointer">
                      <span className="font-medium">90 dias</span>
                      <span className="text-muted-foreground ml-2">
                        - 3x de R$ {parcela3x.toFixed(2)} (30/60/90 dias)
                      </span>
                    </Label>
                  </div>
                )}
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {/* Confirm Button */}
        {isPending && (
          <Card className="border-2 border-primary/20">
            <CardContent className="pt-6">
              <Button
                onClick={handleConfirm}
                disabled={isConfirming || (!proposta.pode_faturar && !selectedFrete)}
                className="w-full h-14 text-lg bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                size="lg"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Confirmar Compra
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-3">
                Ao confirmar, você aceita os termos desta proposta comercial.
                {proposta.pode_faturar && (
                  <> O pagamento será faturado em {selectedPrazo} dias.</>
                )}
                {!proposta.pode_faturar && (
                  <> O pagamento será processado via checkout padrão.</>
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground pt-8 pb-4">
          <p>Central Gospel Editora © {new Date().getFullYear()}</p>
          <p>Em caso de dúvidas, entre em contato com seu vendedor.</p>
        </footer>
      </main>
    </div>
  );
}
