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
import { ArrowLeft, CreditCard, FileText, QrCode } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

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

export default function Checkout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<'boleto' | 'card' | 'pix'>('pix');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cart, setCart] = useState<{ [key: string]: number }>(() => {
    const saved = localStorage.getItem('ebd-cart');
    return saved ? JSON.parse(saved) : {};
  });

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

  const calculateTotal = () => {
    if (!revistas) return 0;
    return revistas.reduce((sum, revista) => {
      const precoComDesconto = (revista.preco_cheio || 0) * 0.7;
      return sum + precoComDesconto * (cart[revista.id] || 0);
    }, 0);
  };

  const total = calculateTotal();

  const handleCEPBlur = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        if (!data.erro) {
          form.setValue('rua', data.logradouro);
          form.setValue('bairro', data.bairro);
          form.setValue('cidade', data.localidade);
          form.setValue('estado', data.uf);
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const onSubmit = async (data: AddressForm) => {
    setIsProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Erro',
          description: 'Você precisa estar logado para finalizar a compra',
          variant: 'destructive',
        });
        return;
      }

      const { data: churchData } = await supabase
        .from('churches')
        .select('id')
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

      // Simular processamento de pagamento
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Registrar compras
      const purchases = revistaIds.map(revistaId => ({
        church_id: churchData.id,
        revista_id: revistaId,
        preco_pago: ((revistas?.find(r => r.id === revistaId)?.preco_cheio || 0) * 0.7) * cart[revistaId],
      }));

      const { error: insertError } = await supabase
        .from('ebd_revistas_compradas')
        .insert(purchases);

      if (insertError) throw insertError;

      // Limpar carrinho
      localStorage.removeItem('ebd-cart');
      
      toast({
        title: 'Pedido confirmado!',
        description: `Seu pedido no valor de R$ ${total.toFixed(2)} foi processado com sucesso.`,
      });

      navigate('/ebd/catalogo');
    } catch (error) {
      console.error('Erro ao processar pedido:', error);
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
            <Card>
              <CardHeader>
                <CardTitle>Endereço de Entrega</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <Card>
              <CardHeader>
                <CardTitle>Forma de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="pix" id="pix" />
                    <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer flex-1">
                      <QrCode className="w-5 h-5" />
                      <div>
                        <div className="font-semibold">PIX</div>
                        <div className="text-sm text-muted-foreground">Aprovação instantânea</div>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                      <CreditCard className="w-5 h-5" />
                      <div>
                        <div className="font-semibold">Cartão de Crédito</div>
                        <div className="text-sm text-muted-foreground">Em até 12x sem juros</div>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="boleto" id="boleto" />
                    <Label htmlFor="boleto" className="flex items-center gap-2 cursor-pointer flex-1">
                      <FileText className="w-5 h-5" />
                      <div>
                        <div className="font-semibold">Boleto Bancário</div>
                        <div className="text-sm text-muted-foreground">Vencimento em 3 dias úteis</div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
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

                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-primary">R$ {total.toFixed(2)}</span>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processando...' : 'Confirmar Pedido'}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Ao confirmar, você concorda com nossos termos de uso
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
