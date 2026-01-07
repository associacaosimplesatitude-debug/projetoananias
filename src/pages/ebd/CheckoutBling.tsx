import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  ShoppingCart, 
  FileText, 
  Building,
  MapPin,
  Loader2,
  Package
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Revista {
  id: string;
  titulo: string;
  preco_cheio: number | null;
  bling_produto_id: number | null;
}

interface Cliente {
  id: string;
  nome_igreja: string;
  cnpj: string;
  cpf: string | null;
  email_superintendente: string | null;
  telefone: string | null;
  nome_responsavel: string | null;
  endereco_cep: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  pode_faturar: boolean;
  desconto_faturamento: number | null;
}

export default function CheckoutBling() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [faturamentoPrazo, setFaturamentoPrazo] = useState<'1' | '2' | '3'>('3');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get client ID from sessionStorage
  const clienteId = sessionStorage.getItem('vendedor-cliente-id');
  const modoBling = sessionStorage.getItem('modo-bling') === 'true';

  // Load cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem('ebd-cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  // Fetch client data
  const { data: cliente, isLoading: clienteLoading } = useQuery({
    queryKey: ['cliente-checkout-bling', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from('ebd_clientes')
        .select('*')
        .eq('id', clienteId)
        .single();
      if (error) throw error;
      return data as Cliente;
    },
    enabled: !!clienteId,
  });

  // Fetch cart items
  const revistaIds = Object.keys(cart).filter(id => cart[id] > 0);
  const { data: revistas, isLoading: revistasLoading } = useQuery({
    queryKey: ['revistas-checkout-bling', revistaIds],
    queryFn: async () => {
      if (revistaIds.length === 0) return [];
      const { data, error } = await supabase
        .from('ebd_revistas')
        .select('id, titulo, preco_cheio, bling_produto_id')
        .in('id', revistaIds);
      if (error) throw error;
      return data as Revista[];
    },
    enabled: revistaIds.length > 0,
  });

  // Redirect if not in Bling mode or missing data
  useEffect(() => {
    if (!clienteId || !modoBling) {
      toast.error('Acesso inválido. Retorne ao catálogo.');
      navigate('/vendedor');
    }
  }, [clienteId, modoBling, navigate]);

  // Calculate discount: 30% base + additional client discount
  const descontoBase = 0.30; // 30% discount
  const descontoAdicional = (cliente?.desconto_faturamento || 0) / 100;
  const descontoTotal = Math.min(descontoBase + descontoAdicional, 1); // Max 100%
  const fatorDesconto = 1 - descontoTotal;

  const subtotal = revistas?.reduce((acc, revista) => {
    const quantidade = cart[revista.id] || 0;
    const precoUnitario = (revista.preco_cheio || 0) * fatorDesconto;
    return acc + precoUnitario * quantidade;
  }, 0) || 0;

  const handleEnviarParaFaturamento = async () => {
    if (!cliente || !revistas || revistas.length === 0) {
      toast.error('Dados incompletos para processar o pedido.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get payment terms based on selection
      const getPrazos = () => {
        switch (faturamentoPrazo) {
          case '1': return { parcelas: 1, texto: '30 dias', obs: '30 DIAS' };
          case '2': return { parcelas: 2, texto: '30/60 dias', obs: '30/60 DIAS' };
          case '3': return { parcelas: 3, texto: '30/60/90 dias', obs: '30/60/90 DIAS' };
          default: return { parcelas: 3, texto: '30/60/90 dias', obs: '30/60/90 DIAS' };
        }
      };
      const prazos = getPrazos();

      // Prepare items for Bling 
      const blingItems = revistas.map(revista => ({
        codigo: revista.bling_produto_id?.toString() || revista.id,
        descricao: revista.titulo,
        quantidade: cart[revista.id],
        valor: (revista.preco_cheio || 0) * fatorDesconto,
        preco_cheio: revista.preco_cheio || 0,
        unidade: 'UN',
      }));

      // Send to Bling with payment terms
      const { data: blingResult, error: blingError } = await supabase.functions.invoke(
        'bling-create-order',
        {
          body: {
            cliente: {
              nome: cliente.nome_igreja,
              cpf_cnpj: cliente.cnpj || cliente.cpf,
              email: cliente.email_superintendente,
              telefone: cliente.telefone,
            },
            endereco_entrega: {
              rua: cliente.endereco_rua,
              numero: cliente.endereco_numero,
              complemento: cliente.endereco_complemento,
              bairro: cliente.endereco_bairro,
              cidade: cliente.endereco_cidade,
              estado: cliente.endereco_estado,
              cep: cliente.endereco_cep,
            },
            itens: blingItems,
            valor_produtos: subtotal,
            valor_frete: 0,
            valor_total: subtotal,
            forma_pagamento: 'FATURAMENTO',
            faturamento_prazo: (prazos.parcelas * 30).toString(), // 30, 60, or 90
            // ✅ Enviar email do usuário logado para vincular vendedor no Bling
            vendedor_email: user?.email,
          },
        }
      );

      if (blingError) {
        console.error('Erro Bling:', blingError);
        // Tentar extrair a mensagem real do erro, similar à tela de Pedidos Admin
        let errorMsg = '';

        // 1) Verificar se o backend retornou o erro no body
        if ((blingResult as any)?.error) {
          errorMsg = (blingResult as any).error as string;
        } else if ((blingError as any).message) {
          // 2) A mensagem geralmente vem no formato: "Edge function returned 400: Error, { ... }"
          const rawMessage = (blingError as any).message as string;
          const jsonMatch = rawMessage.match(/\{.*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              errorMsg = parsed.error || rawMessage;
            } catch {
              errorMsg = rawMessage;
            }
          } else {
            errorMsg = rawMessage;
          }
        }

        // Se for erro de estoque, deixar bem claro para o usuário
        if (errorMsg && errorMsg.toLowerCase().includes('estoque') && errorMsg.toLowerCase().includes('insuficiente')) {
          throw new Error(errorMsg);
        }

        throw new Error(errorMsg || 'Erro ao enviar pedido para o Bling.');
      }

      // Clear cart and session data
      localStorage.removeItem('ebd-cart');
      sessionStorage.removeItem('modo-bling');
      
      // Navigate to success page
      navigate(`/ebd/order-success?faturamento=true&prazo=${prazos.texto}`);

    } catch (error: any) {
      console.error('Erro ao processar faturamento:', error);
      toast.error(error.message || 'Erro ao processar faturamento. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!modoBling || !clienteId) {
    return null;
  }

  const isLoading = clienteLoading || revistasLoading;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-500" />
            Checkout - Faturamento B2B
          </h1>
          <p className="text-muted-foreground">
            Pedido será enviado para o Bling com condição de pagamento parcelada
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Client Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Dados do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-semibold text-lg">{cliente?.nome_igreja}</p>
                  <p className="text-sm text-muted-foreground">
                    {cliente?.cnpj ? `CNPJ: ${cliente.cnpj}` : `CPF: ${cliente?.cpf}`}
                  </p>
                </div>
                <div className="text-sm">
                  <p>{cliente?.email_superintendente}</p>
                  <p>{cliente?.telefone}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {cliente?.endereco_rua}, {cliente?.endereco_numero}
                  {cliente?.endereco_complemento && ` - ${cliente.endereco_complemento}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {cliente?.endereco_bairro} - {cliente?.endereco_cidade}/{cliente?.endereco_estado}
                </p>
                <p className="text-sm text-muted-foreground">CEP: {cliente?.endereco_cep}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Condição de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={faturamentoPrazo}
                  onValueChange={(v) => setFaturamentoPrazo(v as '1' | '2' | '3')}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="1" id="prazo-1" />
                    <Label htmlFor="prazo-1" className="cursor-pointer flex-1">
                      <span className="font-medium">30 dias</span>
                      <p className="text-sm text-muted-foreground">
                        1 boleto: pagamento em 30 dias
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="2" id="prazo-2" />
                    <Label htmlFor="prazo-2" className="cursor-pointer flex-1">
                      <span className="font-medium">30/60 dias</span>
                      <p className="text-sm text-muted-foreground">
                        2 boletos: 1ª parcela em 30 dias
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="3" id="prazo-3" />
                    <Label htmlFor="prazo-3" className="cursor-pointer flex-1">
                      <span className="font-medium">30/60/90 dias</span>
                      <p className="text-sm text-muted-foreground">
                        3 boletos: 1ª parcela em 30 dias
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Resumo do Pedido
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3 pr-2">
                    {revistas?.map(revista => {
                      const quantidade = cart[revista.id];
                      const precoUnitario = (revista.preco_cheio || 0) * 0.7;
                      return (
                        <div key={revista.id} className="flex gap-3 p-2 bg-muted/50 rounded-lg">
                          <Package className="h-8 w-8 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-2">{revista.titulo}</p>
                            <p className="text-xs text-muted-foreground">
                              {quantidade}x R$ {((revista.preco_cheio || 0) * fatorDesconto).toFixed(2)}
                            </p>
                          </div>
                          <span className="font-medium text-sm">
                            R$ {((revista.preco_cheio || 0) * fatorDesconto * quantidade).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Frete</span>
                    <span>A calcular</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">R$ {subtotal.toFixed(2)}</span>
                  </div>
                </div>

                <Badge variant="outline" className="w-full justify-center py-2 text-blue-600 border-blue-300 bg-blue-50">
                  <FileText className="h-4 w-4 mr-2" />
                  Pagamento: {faturamentoPrazo === '1' ? '30 dias' : faturamentoPrazo === '2' ? '30/60 dias' : '30/60/90 dias'}
                </Badge>

                {cliente?.desconto_faturamento && cliente.desconto_faturamento > 0 && (
                  <Badge variant="secondary" className="w-full justify-center py-2 bg-cyan-50 text-cyan-700 border-cyan-200">
                    Desconto do Vendedor: {(descontoTotal * 100).toFixed(0)}% (30% base + {cliente.desconto_faturamento}% adicional)
                  </Badge>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleEnviarParaFaturamento}
                  disabled={isSubmitting || !revistas || revistas.length === 0}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Enviar para Faturamento
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  A equipe financeira aplicará as condições de pagamento e enviará os boletos por e-mail.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
