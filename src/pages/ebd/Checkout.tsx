import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';

const addressSchema = z.object({
  cep: z.string().min(8, 'CEP inválido').max(9),
  rua: z.string().min(3, 'Rua é obrigatória'),
  numero: z.string().min(1, 'Número é obrigatório'),
  complemento: z.string().optional(),
  bairro: z.string().min(2, 'Bairro é obrigatório'),
  cidade: z.string().min(2, 'Cidade é obrigatória'),
  estado: z.string().length(2, 'Estado deve ter 2 letras'),
});

type AddressForm = z.infer<typeof addressSchema>;

interface Revista {
  id: string;
  titulo: string;
  imagem_url: string | null;
  preco_cheio: number | null;
}

// Chave pública do Mercado Pago vinda do .env
const PUBLIC_KEY = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY as string | undefined;

export default function Checkout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'free' | 'pac' | 'sedex'>('pac');
  const [pacCost, setPacCost] = useState<number>(0);
  const [sedexCost, setSedexCost] = useState<number>(0);
  const [pacDays, setPacDays] = useState<number>(0);
  const [sedexDays, setSedexDays] = useState<number>(0);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [orderId, setOrderId] = useState<string>('');
  const [cart, setCart] = useState<{ [key: string]: number }>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ebd-cart') : null;
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    if (!PUBLIC_KEY) {
      console.error('MERCADO_PAGO_PUBLIC_KEY não configurada');
      toast({
        title: 'Erro de pagamento',
        description: 'Configuração de pagamento indisponível no momento.',
        variant: 'destructive',
      });
      return;
    }

    initMercadoPago(PUBLIC_KEY, { locale: 'pt-BR' });
  }, [toast]);

  const form = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      cep: '',
      rua: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
    },
  });

  const revistaIds = Object.keys(cart);

  const { data: revistas } = useQuery({
    queryKey: ['ebd-revistas-checkout', revistaIds],
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

  const calculateSubtotal = () => {
    if (!revistas) return 0;
    return revistas.reduce((sum, revista) => {
      const precoComDesconto = (revista.preco_cheio || 0) * 0.7;
      return sum + precoComDesconto * (cart[revista.id] || 0);
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const hasFreeShipping = subtotal >= 200;
  const shippingCost = hasFreeShipping && shippingMethod === 'free' 
    ? 0 
    : shippingMethod === 'sedex' 
    ? sedexCost 
    : pacCost;
  const total = subtotal + shippingCost;

  const handleCEPBlur = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      try {
        // Buscar endereço
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        if (!data.erro) {
          form.setValue('rua', data.logradouro);
          form.setValue('bairro', data.bairro);
          form.setValue('cidade', data.localidade);
          form.setValue('estado', data.uf);
        }

        // Calcular frete
        setIsCalculatingShipping(true);
        const items = revistaIds.map(revistaId => ({
          id: revistaId,
          quantity: cart[revistaId],
        }));

        const { data: shippingData, error: shippingError } = await supabase.functions.invoke(
          'calculate-shipping',
          {
            body: { cep: cleanCEP, items },
          }
        );

        if (shippingError) {
          console.error('Erro ao calcular frete:', shippingError);
          toast({
            title: 'Erro ao calcular frete',
            description: 'Não foi possível calcular o frete. Tente novamente.',
            variant: 'destructive',
          });
        } else if (shippingData) {
          setPacCost(shippingData.pac.cost);
          setPacDays(shippingData.pac.days);
          setSedexCost(shippingData.sedex.cost);
          setSedexDays(shippingData.sedex.days);
          
          if (subtotal >= 200) {
            setShippingMethod('free');
          }
          
          toast({
            title: 'Frete calculado',
            description: 'Opções de frete disponíveis',
          });
        }
      } catch (error) {
        console.error('Erro ao processar CEP:', error);
      } finally {
        setIsCalculatingShipping(false);
      }
    }
  };

  const onContinueToPayment = async (data: AddressForm) => {
    setIsProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Erro',
          description: 'Você precisa estar logado',
          variant: 'destructive',
        });
        return;
      }

      const { data: churchData } = await supabase
        .from('churches')
        .select('id, pastor_email, pastor_name')
        .eq('user_id', user.id)
        .single();

      if (!churchData) {
        toast({
          title: 'Erro',
          description: 'Igreja não encontrada',
          variant: 'destructive',
        });
        return;
      }

      // Criar pedido
      const { data: pedido, error: pedidoError } = await supabase
        .from('ebd_pedidos')
        .insert({
          church_id: churchData.id,
          valor_produtos: subtotal,
          valor_frete: shippingCost,
          valor_total: total,
          metodo_frete: shippingMethod,
          status: 'pending',
          endereco_rua: data.rua,
          endereco_numero: data.numero,
          endereco_complemento: data.complemento,
          endereco_bairro: data.bairro,
          endereco_cidade: data.cidade,
          endereco_estado: data.estado,
          endereco_cep: data.cep,
        })
        .select()
        .single();

      if (pedidoError || !pedido) {
        throw new Error('Erro ao criar pedido');
      }

      // Criar itens do pedido
      const itens = revistaIds.map(revistaId => {
        const revista = revistas?.find(r => r.id === revistaId);
        const precoUnitario = (revista?.preco_cheio || 0) * 0.7;
        return {
          pedido_id: pedido.id,
          revista_id: revistaId,
          quantidade: cart[revistaId],
          preco_unitario: precoUnitario,
          preco_total: precoUnitario * cart[revistaId],
        };
      });

      const { error: itensError } = await supabase
        .from('ebd_pedidos_itens')
        .insert(itens);

      if (itensError) {
        throw new Error('Erro ao criar itens do pedido');
      }

      setOrderId(pedido.id);
      setShowPayment(true);

      toast({
        title: 'Pedido criado',
        description: 'Prossiga com o pagamento',
      });
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      toast({
        title: 'Erro ao processar pedido',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (revistaIds.length === 0) {
    navigate('/ebd/carrinho');
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/ebd/carrinho')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Carrinho
          </Button>
          <h1 className="text-3xl font-bold">Finalizar Pedido</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {!showPayment ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Endereço de Entrega</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onContinueToPayment)} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="cep"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CEP</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="00000-000"
                                    onBlur={(e) => handleCEPBlur(e.target.value)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="estado"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Estado</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="UF" maxLength={2} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="rua"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rua</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Nome da rua" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="numero"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Número</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="123" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="complemento"
                            render={({ field }) => (
                              <FormItem className="md:col-span-2">
                                <FormLabel>Complemento (opcional)</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Apto, Bloco, etc." />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="bairro"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Bairro</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Bairro" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="cidade"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Cidade</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Cidade" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Pagamento</CardTitle>
                </CardHeader>
                <CardContent>
                  {!PUBLIC_KEY ? (
                    <p className="text-sm text-muted-foreground">
                      Configuração de pagamento indisponível. Entre em contato com o suporte.
                    </p>
                  ) : (
                    <div id="payment-brick-container" className="min-h-[400px]">
                      {typeof window === 'undefined' ? (
                        <p className="text-sm text-muted-foreground">
                          Carregando formulário de pagamento...
                        </p>
                      ) : (
                        <CardPayment
                          initialization={{
                            amount: total,
                          }}
                          customization={{
                            paymentMethods: {
                              maxInstallments: 12,
                            },
                          }}
                          onSubmit={async (cardData: any) => {
                            setIsProcessing(true);
                            try {
                              console.log('Dados do formulário:', cardData);

                              const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
                                'process-transparent-payment',
                                {
                                  body: {
                                    token: cardData.token,
                                    payment_method_id: cardData.payment_method_id,
                                    order_id: orderId,
                                    installments: cardData.installments || 1,
                                    payer: {
                                      email: cardData.payer?.email,
                                      identification: cardData.payer?.identification,
                                    },
                                  },
                                }
                              );

                              if (paymentError) {
                                throw paymentError;
                              }

                              if (paymentData.status === 'approved') {
                                localStorage.removeItem('ebd-cart');
                                navigate(`/ebd/checkout/success?order_id=${orderId}&status=approved`);
                              } else if (paymentData.status === 'pending' || paymentData.status === 'in_process') {
                                navigate(`/ebd/checkout/success?order_id=${orderId}&status=pending`);
                              } else {
                                toast({
                                  title: 'Pagamento não aprovado',
                                  description: paymentData.status_detail || 'Tente novamente',
                                  variant: 'destructive',
                                });
                              }
                            } catch (error) {
                              console.error('Erro ao processar pagamento:', error);
                              toast({
                                title: 'Erro no pagamento',
                                description: 'Tente novamente',
                                variant: 'destructive',
                              });
                            } finally {
                              setIsProcessing(false);
                            }
                          }}
                          onError={(error: any) => {
                            console.error('Erro no Card Payment Brick:', error);
                            toast({
                              title: 'Erro no formulário',
                              description: 'Verifique os dados e tente novamente',
                              variant: 'destructive',
                            });
                          }}
                          onReady={() => {
                            console.log('Card Payment Brick carregado');
                          }}
                        />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {revistas?.map((revista) => (
                    <div key={revista.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {revista.titulo} (x{cart[revista.id]})
                      </span>
                      <span className="font-medium">
                        R$ {(((revista.preco_cheio || 0) * 0.7) * cart[revista.id]).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                </div>

                {!showPayment && !isCalculatingShipping && pacCost > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">Escolha o frete:</Label>
                      <RadioGroup value={shippingMethod} onValueChange={(value: any) => setShippingMethod(value)}>
                        {hasFreeShipping && (
                          <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                            <RadioGroupItem value="free" id="free" />
                            <Label htmlFor="free" className="cursor-pointer flex-1">
                              <div className="flex justify-between">
                                <span className="font-semibold text-green-700 dark:text-green-400">Frete Grátis</span>
                                <span className="text-xs text-muted-foreground">15 dias</span>
                              </div>
                            </Label>
                          </div>
                        )}
                        <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                          <RadioGroupItem value="pac" id="pac" />
                          <Label htmlFor="pac" className="cursor-pointer flex-1">
                            <div className="flex justify-between">
                              <span className="font-semibold">PAC: R$ {pacCost.toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground">{pacDays} dias</span>
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                          <RadioGroupItem value="sedex" id="sedex" />
                          <Label htmlFor="sedex" className="cursor-pointer flex-1">
                            <div className="flex justify-between">
                              <span className="font-semibold">Sedex: R$ {sedexCost.toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground">{sedexDays} dias</span>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </>
                )}

                {isCalculatingShipping && (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    Calculando frete...
                  </div>
                )}

                {!showPayment && !isCalculatingShipping && pacCost === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    Informe o CEP para calcular o frete
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Frete:</span>
                    <span>R$ {shippingCost.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-primary">R$ {total.toFixed(2)}</span>
                </div>

                {!showPayment && (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={form.handleSubmit(onContinueToPayment)}
                    disabled={isProcessing || pacCost === 0 || isCalculatingShipping}
                  >
                    {isProcessing ? 'Processando...' : 'Continuar para Pagamento'}
                  </Button>
                )}

                {showPayment && isProcessing && (
                  <div className="text-center text-sm text-muted-foreground">
                    Processando pagamento...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
