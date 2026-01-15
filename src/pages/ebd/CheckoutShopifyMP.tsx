import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft, CreditCard, QrCode, MapPin, Check, Edit, Loader2, ShoppingCart, Truck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useShopifyCartStore } from '@/stores/shopifyCartStore';
import { useVendedor } from '@/hooks/useVendedor';

// Validação CPF
const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleanCPF[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleanCPF[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF[10])) return false;
  return true;
};

// Validação CNPJ
const validateCNPJ = (cnpj: string): boolean => {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  if (cleanCNPJ.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(cleanCNPJ[i]) * weights1[i];
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleanCNPJ[12])) return false;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(cleanCNPJ[i]) * weights2[i];
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleanCNPJ[13])) return false;
  return true;
};

const validateCPFOrCNPJ = (value: string): boolean => {
  const cleanValue = value.replace(/\D/g, '');
  if (cleanValue.length === 11) return validateCPF(cleanValue);
  if (cleanValue.length === 14) return validateCNPJ(cleanValue);
  return false;
};

const formatCPFOrCNPJ = (value: string): string => {
  const cleanValue = value.replace(/\D/g, '');
  if (cleanValue.length <= 11) {
    return cleanValue
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    return cleanValue
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
};

const formatCEP = (value: string): string => {
  const cleanValue = value.replace(/\D/g, '').slice(0, 8);
  return cleanValue.replace(/(\d{5})(\d)/, '$1-$2');
};

const addressSchema = z.object({
  nome: z.string().min(3, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  sobrenome: z.string().min(2, 'Sobrenome é obrigatório').max(100, 'Sobrenome muito longo'),
  cpf: z.string()
    .min(11, 'CPF/CNPJ inválido')
    .max(18, 'CPF/CNPJ inválido')
    .refine(validateCPFOrCNPJ, { message: 'CPF ou CNPJ inválido' }),
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
  telefone: z.string().min(10, 'Telefone inválido').max(20, 'Telefone muito longo'),
  cep: z.string().min(8, 'CEP inválido').max(9),
  rua: z.string().min(3, 'Rua é obrigatória').max(200, 'Endereço muito longo'),
  numero: z.string().min(1, 'Número é obrigatório').max(20, 'Número muito longo'),
  complemento: z.string().max(100, 'Complemento muito longo').optional(),
  bairro: z.string().min(2, 'Bairro é obrigatório').max(100, 'Bairro muito longo'),
  cidade: z.string().min(2, 'Cidade é obrigatória').max(100, 'Cidade muito longa'),
  estado: z.string().length(2, 'Estado deve ter 2 letras'),
});

type AddressForm = z.infer<typeof addressSchema>;

export default function CheckoutShopifyMP() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propostaToken = searchParams.get('proposta');
  
  const { vendedor, isLoading: vendedorLoading } = useVendedor();
  const { items: cartItems, clearCart } = useShopifyCartStore();
  
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [isProcessing, setIsProcessing] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'pac' | 'sedex' | 'manual'>('pac');
  const [pacCost, setPacCost] = useState<number>(0);
  const [sedexCost, setSedexCost] = useState<number>(0);
  const [pacDays, setPacDays] = useState<number>(0);
  const [sedexDays, setSedexDays] = useState<number>(0);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [isCepValid, setIsCepValid] = useState<boolean | null>(null);
  const [showPixDialog, setShowPixDialog] = useState(false);
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixCode, setPixCode] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(true);

  // Cliente selecionado pelo vendedor (para carrinho Shopify)
  const vendedorClienteId = sessionStorage.getItem('vendedor-cliente-id');
  const vendedorClienteNome = sessionStorage.getItem('vendedor-cliente-nome');

  // Buscar proposta se token existir
  const { data: proposta, isLoading: isLoadingProposta } = useQuery({
    queryKey: ['proposta-checkout-mp', propostaToken],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedor_propostas')
        .select(`
          *,
          ebd_clientes:cliente_id (
            email_superintendente,
            telefone,
            cnpj,
            cpf
          ),
          vendedores:vendedor_id (
            id,
            email,
            nome
          )
        `)
        .eq('token', propostaToken!)
        .single();
      
      if (error) throw error;
      
      // Parse dados
      const parsedData = {
        ...data,
        itens: typeof data.itens === 'string' ? JSON.parse(data.itens) : data.itens,
        cliente_endereco: typeof data.cliente_endereco === 'string' 
          ? JSON.parse(data.cliente_endereco) 
          : data.cliente_endereco,
      };
      
      return parsedData;
    },
    enabled: !!propostaToken,
  });

  const form = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      nome: '',
      sobrenome: '',
      cpf: '',
      email: '',
      telefone: '',
      cep: '',
      rua: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
    },
  });

  // Preencher dados da proposta
  useEffect(() => {
    if (proposta && propostaToken) {
      const clienteData = proposta.ebd_clientes as any;
      const endereco = proposta.cliente_endereco || {};
      const nomeCompleto = proposta.cliente_nome || '';
      const partesNome = nomeCompleto.split(' ');
      const primeiroNome = partesNome[0] || '';
      const sobrenome = partesNome.slice(1).join(' ') || '';
      
      form.reset({
        nome: primeiroNome,
        sobrenome: sobrenome,
        cpf: clienteData?.cnpj || clienteData?.cpf || proposta.cliente_cnpj || '',
        email: clienteData?.email_superintendente || '',
        telefone: clienteData?.telefone || '',
        cep: endereco.cep || '',
        rua: endereco.rua || '',
        numero: endereco.numero || '',
        complemento: endereco.complemento || '',
        bairro: endereco.bairro || '',
        cidade: endereco.cidade || '',
        estado: endereco.estado || '',
      });
      
      // Frete já vem da proposta
      if (proposta.metodo_frete === 'manual' || proposta.frete_tipo === 'manual') {
        setShippingMethod('manual');
        setPacCost(proposta.valor_frete || 0);
        setSedexCost(proposta.valor_frete || 0);
      } else {
        // Recalcular frete se necessário
        if (endereco.cep) {
          handleCEPBlur(endereco.cep);
        }
      }
      
      setIsCepValid(true);
      setShowAddressForm(false); // Dados preenchidos, mostrar resumo
    }
  }, [proposta, propostaToken]);

  // Buscar dados do cliente do vendedor (fluxo carrinho)
  const { data: vendedorCliente, isLoading: isLoadingVendedorCliente } = useQuery({
    queryKey: ['vendedor-cliente-checkout-mp', vendedorClienteId],
    queryFn: async () => {
      if (!vendedorClienteId) return null;
      const { data, error } = await supabase
        .from('ebd_clientes')
        .select('*')
        .eq('id', vendedorClienteId)
        .maybeSingle();
      if (error) {
        console.error('Erro ao buscar cliente:', error);
        return null;
      }
      return data;
    },
    enabled: !!vendedorClienteId && !propostaToken,
  });

  // Preencher dados do cliente (fluxo carrinho)
  useEffect(() => {
    if (vendedorCliente && !isLoadingVendedorCliente && !propostaToken) {
      const nomeCompleto = vendedorCliente.nome_responsavel || vendedorCliente.nome_superintendente || vendedorCliente.nome_igreja || '';
      const partesNome = nomeCompleto.split(' ');
      const primeiroNome = partesNome[0] || '';
      const sobrenome = partesNome.slice(1).join(' ') || '';
      
      form.reset({
        nome: primeiroNome,
        sobrenome: sobrenome,
        cpf: vendedorCliente.cpf || vendedorCliente.cnpj || '',
        email: vendedorCliente.email_superintendente || '',
        telefone: vendedorCliente.telefone || '',
        cep: vendedorCliente.endereco_cep || '',
        rua: vendedorCliente.endereco_rua || '',
        numero: vendedorCliente.endereco_numero || '',
        complemento: vendedorCliente.endereco_complemento || '',
        bairro: vendedorCliente.endereco_bairro || '',
        cidade: vendedorCliente.endereco_cidade || '',
        estado: vendedorCliente.endereco_estado || '',
      });
      
      if (vendedorCliente.endereco_cep) {
        handleCEPBlur(vendedorCliente.endereco_cep);
      }
    }
  }, [vendedorCliente, isLoadingVendedorCliente, propostaToken]);

  // Itens: da proposta ou do carrinho
  const checkoutItems = useMemo(() => {
    if (proposta?.itens && propostaToken) {
      // Itens da proposta
      return proposta.itens.map((item: any) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        title: item.title,
        price: item.price,
        imageUrl: item.imageUrl,
        sku: item.sku,
        descontoItem: item.descontoItem,
      }));
    }
    // Itens do carrinho Shopify
    return cartItems;
  }, [proposta, propostaToken, cartItems]);

  // Calcular valores
  const subtotal = useMemo(() => {
    if (proposta && propostaToken) {
      // Usar valores da proposta (já com desconto aplicado)
      const valorProdutos = proposta.valor_produtos || 0;
      const descontoTotal = proposta.itens?.reduce((total: number, item: any) => {
        const precoOriginal = parseFloat(item.price) * item.quantity;
        const descontoDoItem = item.descontoItem ?? proposta.desconto_percentual ?? 0;
        return total + (precoOriginal * (descontoDoItem / 100));
      }, 0) || 0;
      return valorProdutos - descontoTotal;
    }
    // Carrinho Shopify
    return cartItems.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  }, [proposta, propostaToken, cartItems]);

  const shippingCost = useMemo(() => {
    if (proposta && propostaToken && (proposta.metodo_frete === 'manual' || proposta.frete_tipo === 'manual')) {
      return proposta.valor_frete || 0;
    }
    return shippingMethod === 'sedex' ? sedexCost : pacCost;
  }, [proposta, propostaToken, shippingMethod, sedexCost, pacCost]);

  const total = subtotal + shippingCost;

  const handleCEPBlur = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      try {
        setIsCalculatingShipping(true);
        setIsCepValid(null);
        
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        
        if (data.erro) {
          setIsCepValid(false);
          toast.error('CEP não encontrado');
          return;
        }
        
        setIsCepValid(true);
        form.setValue('rua', data.logradouro || '');
        form.setValue('bairro', data.bairro || '');
        form.setValue('cidade', data.localidade || '');
        form.setValue('estado', data.uf || '');

        // Calcular frete usando peso estimado dos produtos
        const itemsParaCalculo = propostaToken && proposta?.itens 
          ? proposta.itens 
          : cartItems;
        const totalWeight = itemsParaCalculo.reduce((sum: number, item: any) => sum + (0.3 * (item.quantity || 1)), 0); // 300g por item
        
        const { data: shippingData, error: shippingError } = await supabase.functions.invoke(
          'calculate-shipping',
          {
            body: { 
              cep: cleanCEP, 
              items: itemsParaCalculo.map((item: any) => ({ id: item.variantId, quantity: item.quantity })),
              pesoTotal: totalWeight
            },
          }
        );

        if (shippingError) {
          console.error('Erro ao calcular frete:', shippingError);
          toast.error('Erro ao calcular frete');
        } else if (shippingData) {
          setPacCost(shippingData.pac?.cost || 25);
          setPacDays(shippingData.pac?.days || 10);
          setSedexCost(shippingData.sedex?.cost || 45);
          setSedexDays(shippingData.sedex?.days || 5);
          toast.success('Frete calculado!');
        }
      } catch (error) {
        console.error('Erro ao processar CEP:', error);
        setIsCepValid(false);
        toast.error('Erro ao buscar CEP');
      } finally {
        setIsCalculatingShipping(false);
      }
    }
  };

  const processPixPayment = async (data: AddressForm) => {
    setIsProcessing(true);
    
    try {
      // Determinar vendedor: da proposta ou do contexto atual
      const vendedorInfo = propostaToken && proposta?.vendedores 
        ? proposta.vendedores as { id: string; email: string; nome: string }
        : vendedor;
        
      if (!vendedorInfo) {
        toast.error('Vendedor não identificado');
        return;
      }

      // Preparar itens para o pagamento - suportar ambos os formatos
      const paymentItems = propostaToken && proposta?.itens
        ? proposta.itens.map((item: any) => ({
            id: item.variantId,
            title: item.title,
            quantity: item.quantity,
            unit_price: parseFloat(item.price),
          }))
        : cartItems.map(item => ({
            id: item.variantId,
            title: item.product.node.title,
            quantity: item.quantity,
            unit_price: parseFloat(item.price.amount),
          }));

      // Preparar itens para salvar no pedido
      const itemsParaSalvar = propostaToken && proposta?.itens
        ? proposta.itens.map((item: any) => ({
            variantId: item.variantId,
            productId: item.variantId.split('/').pop(),
            title: item.title,
            variantTitle: item.title,
            quantity: item.quantity,
            price: item.price,
            image: item.imageUrl || null,
            sku: item.sku || null,
          }))
        : cartItems.map(item => ({
            variantId: item.variantId,
            productId: item.product.node.id,
            title: item.product.node.title,
            variantTitle: item.variantTitle,
            quantity: item.quantity,
            price: item.price.amount,
            image: item.product.node.images.edges[0]?.node.url || null,
            sku: item.sku,
          }));

      // Criar pedido na tabela nova
      const { data: pedido, error: pedidoError } = await supabase
        .from('ebd_shopify_pedidos_mercadopago')
        .insert({
          vendedor_id: vendedorInfo.id,
          vendedor_email: vendedorInfo.email,
          vendedor_nome: vendedorInfo.nome,
          cliente_id: propostaToken ? proposta?.cliente_id : vendedorClienteId || null,
          cliente_nome: `${data.nome} ${data.sobrenome}`.trim(),
          cliente_cpf_cnpj: data.cpf.replace(/\D/g, ''),
          cliente_email: data.email,
          cliente_telefone: data.telefone,
          valor_produtos: subtotal,
          valor_frete: shippingCost,
          valor_total: total,
          metodo_frete: shippingMethod,
          prazo_entrega_dias: shippingMethod === 'sedex' ? sedexDays : pacDays,
          endereco_cep: data.cep.replace(/\D/g, ''),
          endereco_rua: data.rua,
          endereco_numero: data.numero,
          endereco_complemento: data.complemento || null,
          endereco_bairro: data.bairro,
          endereco_cidade: data.cidade,
          endereco_estado: data.estado,
          items: itemsParaSalvar,
          payment_method: 'pix',
          status: 'AGUARDANDO_PAGAMENTO',
          proposta_token: propostaToken || null,
        })
        .select()
        .single();

      if (pedidoError) {
        console.error('Erro ao criar pedido:', pedidoError);
        toast.error('Erro ao criar pedido');
        return;
      }

      // Processar pagamento PIX
      const { data: pixData, error: pixError } = await supabase.functions.invoke(
        'process-transparent-payment',
        {
          body: {
            payment_method: 'pix',
            transaction_amount: Math.round(total * 100) / 100,
            description: `Pedido Shopify #${pedido.id.slice(0, 8).toUpperCase()}`,
            payer: {
              email: data.email,
              first_name: data.nome,
              last_name: data.sobrenome,
              identification: {
                type: data.cpf.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF',
                number: data.cpf.replace(/\D/g, ''),
              },
            },
            items: paymentItems,
            external_reference: pedido.id,
          },
        }
      );

      if (pixError) {
        console.error('Erro ao gerar PIX:', pixError);
        toast.error('Erro ao gerar código PIX');
        return;
      }

      // Atualizar pedido com payment_id
      await supabase
        .from('ebd_shopify_pedidos_mercadopago')
        .update({
          mercadopago_payment_id: pixData.id?.toString(),
          mercadopago_preference_id: pixData.id?.toString(),
        })
        .eq('id', pedido.id);

      // Exibir QR Code
      setPixQrCode(pixData.point_of_interaction?.transaction_data?.qr_code_base64 || '');
      setPixCode(pixData.point_of_interaction?.transaction_data?.qr_code || '');
      setShowPixDialog(true);

      toast.success('Código PIX gerado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      toast.error('Erro ao processar pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyPixCode = () => {
    navigator.clipboard.writeText(pixCode);
    toast.success('Código PIX copiado!');
  };

  const handleSubmit = async (data: AddressForm) => {
    if (paymentMethod === 'pix') {
      await processPixPayment(data);
    } else {
      toast.info('Pagamento por cartão em desenvolvimento');
    }
  };

  const handlePaymentComplete = () => {
    clearCart();
    navigate('/ebd/order-success');
  };

  if (vendedorLoading || isLoadingVendedorCliente) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Se não há proposta E carrinho está vazio, mostrar mensagem
  const hasItems = propostaToken ? (proposta?.itens?.length > 0) : (cartItems.length > 0);
  
  if (!hasItems && !isLoadingProposta) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Carrinho Vazio</h2>
          <p className="text-muted-foreground mb-6">
            Nenhum produto no carrinho para checkout.
          </p>
          <Button onClick={() => navigate('/ebd/shopify-pedidos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Catálogo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Checkout - Mercado Pago</h1>
            {propostaToken && proposta?.cliente_nome && (
              <p className="text-muted-foreground">
                Cliente: <span className="font-medium text-foreground">{proposta.cliente_nome}</span>
              </p>
            )}
            {!propostaToken && vendedorClienteNome && (
              <p className="text-muted-foreground">
                Cliente: <span className="font-medium text-foreground">{vendedorClienteNome}</span>
              </p>
            )}
            {propostaToken && proposta?.vendedores && (
              <p className="text-sm text-green-600">
                Vendedor: {(proposta.vendedores as any).nome} ({(proposta.vendedores as any).email})
              </p>
            )}
            {!propostaToken && vendedor && (
              <p className="text-sm text-green-600">
                Vendedor: {vendedor.nome} ({vendedor.email})
              </p>
            )}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Coluna esquerda: Formulário */}
              <div className="lg:col-span-2 space-y-6">
                {/* Produtos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Produtos ({checkoutItems.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {propostaToken && proposta?.itens ? (
                      // Renderizar itens da proposta
                      proposta.itens.map((item: any) => {
                        const itemPrice = parseFloat(item.price);
                        return (
                          <div key={item.variantId} className="flex gap-4 p-3 border rounded-lg">
                            <div className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                  Sem img
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.title}</p>
                              <p className="text-sm text-muted-foreground">
                                Qtd: {item.quantity} × R$ {itemPrice.toFixed(2)}
                              </p>
                              {item.descontoItem && item.descontoItem > 0 && (
                                <p className="text-xs text-green-600">
                                  Desconto: {item.descontoItem}%
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-bold">
                                R$ {(itemPrice * item.quantity * (1 - (item.descontoItem || 0) / 100)).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      // Renderizar itens do carrinho Shopify
                      cartItems.map((item) => {
                        const itemImage = item.product.node.images.edges[0]?.node.url;
                        const itemTitle = item.product.node.title;
                        const itemPrice = parseFloat(item.price.amount);
                        return (
                          <div key={item.variantId} className="flex gap-4 p-3 border rounded-lg">
                            <div className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                              {itemImage ? (
                                <img src={itemImage} alt={itemTitle} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                  Sem img
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{itemTitle}</p>
                              {item.variantTitle && item.variantTitle !== 'Default Title' && (
                                <p className="text-xs text-muted-foreground">{item.variantTitle}</p>
                              )}
                              <p className="text-sm text-muted-foreground">
                                Qtd: {item.quantity} × R$ {itemPrice.toFixed(2)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">
                                R$ {(itemPrice * item.quantity).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>

                {/* Endereço de Entrega */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Endereço de Entrega
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Nome" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sobrenome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sobrenome</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Sobrenome" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF/CNPJ</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="000.000.000-00"
                                onChange={(e) => field.onChange(formatCPFOrCNPJ(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="email@exemplo.com" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="telefone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(00) 00000-0000" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                              onChange={(e) => field.onChange(formatCEP(e.target.value))}
                              onBlur={(e) => handleCEPBlur(e.target.value)}
                            />
                          </FormControl>
                          {isCalculatingShipping && (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Calculando frete...
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <FormField
                          control={form.control}
                          name="rua"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rua</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Rua" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="numero"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Nº" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="complemento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento (opcional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Apto, bloco, etc" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
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
                  </CardContent>
                </Card>

                {/* Frete */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Forma de Envio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={shippingMethod}
                      onValueChange={(value) => setShippingMethod(value as 'pac' | 'sedex')}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="pac" id="pac" />
                          <Label htmlFor="pac" className="cursor-pointer">
                            <span className="font-medium">PAC</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              ({pacDays || 10} dias úteis)
                            </span>
                          </Label>
                        </div>
                        <span className="font-bold">R$ {pacCost.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="sedex" id="sedex" />
                          <Label htmlFor="sedex" className="cursor-pointer">
                            <span className="font-medium">SEDEX</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              ({sedexDays || 5} dias úteis)
                            </span>
                          </Label>
                        </div>
                        <span className="font-bold">R$ {sedexCost.toFixed(2)}</span>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>

                {/* Pagamento */}
                <Card>
                  <CardHeader>
                    <CardTitle>Forma de Pagamento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(value) => setPaymentMethod(value as 'pix' | 'card')}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-3 p-4 border rounded-lg">
                        <RadioGroupItem value="pix" id="pix" />
                        <Label htmlFor="pix" className="cursor-pointer flex items-center gap-2">
                          <QrCode className="h-5 w-5 text-green-600" />
                          <span className="font-medium">PIX</span>
                          <span className="text-sm text-muted-foreground">(Pagamento instantâneo)</span>
                        </Label>
                      </div>
                      <div className="flex items-center gap-3 p-4 border rounded-lg opacity-50">
                        <RadioGroupItem value="card" id="card" disabled />
                        <Label htmlFor="card" className="cursor-pointer flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-blue-600" />
                          <span className="font-medium">Cartão de Crédito</span>
                          <span className="text-sm text-muted-foreground">(Em breve)</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>
              </div>

              {/* Coluna direita: Resumo */}
              <div className="lg:col-span-1">
                <Card className="sticky top-6">
                  <CardHeader>
                    <CardTitle>Resumo do Pedido</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Produtos ({propostaToken && proposta?.itens 
                          ? proposta.itens.reduce((s: number, i: any) => s + i.quantity, 0) 
                          : cartItems.reduce((s, i) => s + i.quantity, 0)} itens):
                      </span>
                      <span className="font-medium">R$ {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete ({shippingMethod.toUpperCase()}):</span>
                      <span className="font-medium">R$ {shippingCost.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-primary">R$ {total.toFixed(2)}</span>
                    </div>
                    
                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={isProcessing || isCalculatingShipping}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Finalizar Pedido
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </Form>

        {/* Dialog PIX */}
        <Dialog open={showPixDialog} onOpenChange={setShowPixDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-green-600" />
                Pague com PIX
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Escaneie o QR Code ou copie o código para pagar
              </p>
              
              {pixQrCode && (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img
                    src={`data:image/png;base64,${pixQrCode}`}
                    alt="QR Code PIX"
                    className="max-w-[200px]"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Código PIX (Copia e Cola)</Label>
                <div className="flex gap-2">
                  <Input value={pixCode} readOnly className="text-xs" />
                  <Button variant="outline" onClick={copyPixCode}>
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="text-lg font-bold text-green-600">
                Total: R$ {total.toFixed(2)}
              </div>

              <p className="text-xs text-muted-foreground">
                Após o pagamento, o pedido será confirmado automaticamente.
              </p>

              <Button onClick={handlePaymentComplete} className="w-full">
                Já fiz o pagamento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
