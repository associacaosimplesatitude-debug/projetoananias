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
}

export default function CheckoutBling() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [faturamentoPrazo, setFaturamentoPrazo] = useState<'30' | '60' | '90'>('30');
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

  const subtotal = revistas?.reduce((acc, revista) => {
    const quantidade = cart[revista.id] || 0;
    const precoUnitario = (revista.preco_cheio || 0) * 0.7; // 30% discount
    return acc + precoUnitario * quantidade;
  }, 0) || 0;

  const handleEnviarParaFaturamento = async () => {
    if (!cliente || !revistas || revistas.length === 0) {
      toast.error('Dados incompletos para processar o pedido.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create local order in ebd_pedidos
      const { data: pedido, error: pedidoError } = await supabase
        .from('ebd_pedidos')
        .insert({
          church_id: clienteId!,
          status: 'faturamento_pendente',
          payment_status: 'faturamento',
          valor_produtos: subtotal,
          valor_frete: 0, // Will be calculated by Bling/logistics
          valor_total: subtotal,
          endereco_cep: cliente.endereco_cep || '',
          endereco_rua: cliente.endereco_rua || '',
          endereco_numero: cliente.endereco_numero || '',
          endereco_complemento: cliente.endereco_complemento || null,
          endereco_bairro: cliente.endereco_bairro || '',
          endereco_cidade: cliente.endereco_cidade || '',
          endereco_estado: cliente.endereco_estado || '',
          nome_cliente: cliente.nome_igreja,
          email_cliente: cliente.email_superintendente,
          cpf_cnpj_cliente: cliente.cnpj || cliente.cpf,
          telefone_cliente: cliente.telefone,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      // Create order items
      const itensData = revistas.map(revista => ({
        pedido_id: pedido.id,
        revista_id: revista.id,
        quantidade: cart[revista.id],
        preco_unitario: (revista.preco_cheio || 0) * 0.7,
        preco_total: (revista.preco_cheio || 0) * 0.7 * cart[revista.id],
      }));

      const { error: itensError } = await supabase
        .from('ebd_pedidos_itens')
        .insert(itensData);

      if (itensError) {
        console.error('Erro ao criar itens:', itensError);
      }

      // Prepare items for Bling
      const blingItems = revistas.map(revista => ({
        codigo: revista.bling_produto_id?.toString() || revista.id,
        descricao: revista.titulo,
        quantidade: cart[revista.id],
        valor: (revista.preco_cheio || 0) * 0.7,
        unidade: 'UN',
      }));

      // Send to Bling with payment terms
      const { data: blingResult, error: blingError } = await supabase.functions.invoke(
        'bling-create-order',
        {
          body: {
            cliente: {
              nome: cliente.nome_igreja,
              cnpj: cliente.cnpj,
              cpf: cliente.cpf,
              email: cliente.email_superintendente,
              telefone: cliente.telefone,
              endereco: {
                rua: cliente.endereco_rua,
                numero: cliente.endereco_numero,
                complemento: cliente.endereco_complemento,
                bairro: cliente.endereco_bairro,
                cidade: cliente.endereco_cidade,
                uf: cliente.endereco_estado,
                cep: cliente.endereco_cep,
              },
            },
            items: blingItems,
            observacao: `CONDIÇÃO DE PAGAMENTO: ${faturamentoPrazo}/${parseInt(faturamentoPrazo) + 30}/${parseInt(faturamentoPrazo) + 60} DIAS - BOLETO FATURADO`,
            formaPagamento: 'FATURAMENTO',
            condicaoPagamento: faturamentoPrazo,
          },
        }
      );

      if (blingError) {
        console.error('Erro Bling:', blingError);
        // Update local order with error status
        await supabase
          .from('ebd_pedidos')
          .update({ status: 'erro_bling' })
          .eq('id', pedido.id);
        
        throw new Error('Erro ao enviar pedido para o Bling. Verifique a integração.');
      }

      // Update local order with Bling ID
      if (blingResult?.pedidoId) {
        await supabase
          .from('ebd_pedidos')
          .update({ 
            bling_order_id: blingResult.pedidoId,
            status: 'faturamento_enviado',
          })
          .eq('id', pedido.id);
      }

      // Clear cart and session data
      localStorage.removeItem('ebd-cart');
      sessionStorage.removeItem('modo-bling');
      
      // Navigate to success page
      navigate(`/ebd/order-success?pedido=${pedido.id}&faturamento=true&prazo=${faturamentoPrazo}`);

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
                  onValueChange={(v) => setFaturamentoPrazo(v as '30' | '60' | '90')}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="30" id="prazo-30" />
                    <Label htmlFor="prazo-30" className="cursor-pointer flex-1">
                      <span className="font-medium">30/60/90 dias</span>
                      <p className="text-sm text-muted-foreground">
                        3 boletos: 1ª parcela em 30 dias
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="60" id="prazo-60" />
                    <Label htmlFor="prazo-60" className="cursor-pointer flex-1">
                      <span className="font-medium">60/90/120 dias</span>
                      <p className="text-sm text-muted-foreground">
                        3 boletos: 1ª parcela em 60 dias
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="90" id="prazo-90" />
                    <Label htmlFor="prazo-90" className="cursor-pointer flex-1">
                      <span className="font-medium">90/120/150 dias</span>
                      <p className="text-sm text-muted-foreground">
                        3 boletos: 1ª parcela em 90 dias
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
                              {quantidade}x R$ {precoUnitario.toFixed(2)}
                            </p>
                          </div>
                          <span className="font-medium text-sm">
                            R$ {(precoUnitario * quantidade).toFixed(2)}
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
                  Pagamento: {faturamentoPrazo}/{parseInt(faturamentoPrazo) + 30}/{parseInt(faturamentoPrazo) + 60} dias
                </Badge>

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
