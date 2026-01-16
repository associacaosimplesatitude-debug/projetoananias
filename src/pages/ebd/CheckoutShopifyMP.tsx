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
import { ArrowLeft, CreditCard, QrCode, MapPin, Check, Edit, Loader2, ShoppingCart, Truck, FileText, Copy } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const propostaToken = searchParams.get('proposta'); // Token legado
  const propostaId = searchParams.get('proposta_id'); // UUID direto (prioridade)
  
  const { vendedor, isLoading: vendedorLoading } = useVendedor();
  const { items: cartItems, clearCart } = useShopifyCartStore();
  
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'boleto'>('pix');
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
  
  // Estados para cartão de crédito
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [cardInstallments, setCardInstallments] = useState('1');
  
  // Estados para boleto
  const [showBoletoDialog, setShowBoletoDialog] = useState(false);
  const [boletoUrl, setBoletoUrl] = useState('');
  const [boletoBarcode, setBoletoBarcode] = useState('');

  // Cliente selecionado pelo vendedor (para carrinho Shopify)
  const vendedorClienteId = sessionStorage.getItem('vendedor-cliente-id');
  const vendedorClienteNome = sessionStorage.getItem('vendedor-cliente-nome');

  // Flag para saber se estamos no fluxo via proposta
  const isPropostaFlow = !!(propostaId || propostaToken);

  // Buscar dados do checkout via backend (função pública - sem RLS)
  const { data: checkoutData, isLoading: isLoadingCheckout, error: checkoutError } = useQuery({
    queryKey: ['mp-checkout-init', propostaId, propostaToken],
    queryFn: async () => {
      console.log('[Checkout] Buscando dados via mp-checkout-init...');
      const { data, error } = await supabase.functions.invoke('mp-checkout-init', {
        body: {
          proposta_id: propostaId || undefined,
          proposta_token: propostaToken || undefined,
        },
      });

      if (error) {
        console.error('[Checkout] Erro ao buscar dados:', error);
        throw error;
      }

      console.log('[Checkout] Dados recebidos:', {
        email: data?.email,
        telefone: data?.telefone,
        proposta_id: data?.proposta_id,
      });
      
      return data;
    },
    enabled: isPropostaFlow,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Compatibilidade: usar checkoutData como proposta
  const proposta = checkoutData ? {
    id: checkoutData.proposta_id,
    token: checkoutData.token,
    cliente_id: null, // Não precisamos mais, dados já vieram
    cliente_nome: checkoutData.cliente_nome,
    cliente_cnpj: checkoutData.cliente_cnpj,
    cliente_endereco: checkoutData.endereco,
    valor_produtos: checkoutData.valor_produtos,
    valor_frete: checkoutData.valor_frete,
    metodo_frete: checkoutData.metodo_frete,
    frete_tipo: checkoutData.metodo_frete,
    desconto_percentual: checkoutData.desconto_percentual,
    itens: checkoutData.itens,
    vendedor_id: checkoutData.vendedor?.id,
    vendedor_email: checkoutData.vendedor?.email,
    vendedor_nome: checkoutData.vendedor?.nome,
    // Dados do cliente já incluídos diretamente
    _email: checkoutData.email,
    _telefone: checkoutData.telefone,
  } : null;

  const isLoadingProposta = isLoadingCheckout;

  // clienteDireto não é mais necessário - dados vêm do backend
  const clienteDireto = null;

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

  // Preencher dados da proposta - dados já vêm do backend mp-checkout-init
  useEffect(() => {
    if (!proposta || !isPropostaFlow) return;
    
    // Dados do cliente já vêm direto do backend (proposta._email, proposta._telefone)
    const endereco = proposta.cliente_endereco || {};
    const nomeCompleto = proposta.cliente_nome || '';
    const partesNome = nomeCompleto.split(' ');
    const primeiroNome = partesNome[0] || '';
    const sobrenome = partesNome.slice(1).join(' ') || '';
    
    console.log('[Checkout] Preenchendo formulário com dados do backend:', {
      email: proposta._email,
      telefone: proposta._telefone,
    });
    
    form.reset({
      nome: primeiroNome,
      sobrenome: sobrenome,
      cpf: proposta.cliente_cnpj || '',
      email: proposta._email || '',
      telefone: proposta._telefone || '',
      cep: endereco.cep || '',
      rua: endereco.rua || '',
      numero: endereco.numero || '',
      complemento: endereco.complemento || '',
      bairro: endereco.bairro || '',
      cidade: endereco.cidade || '',
      estado: endereco.estado || '',
    });
    
    // Frete já vem da proposta - verificar método escolhido
    const metodoFrete = proposta.metodo_frete;
    
    if (metodoFrete === 'manual' || proposta.frete_tipo === 'manual') {
      // Frete manual definido pelo vendedor
      setShippingMethod('manual');
      setPacCost(proposta.valor_frete || 0);
      setSedexCost(proposta.valor_frete || 0);
    } else if (metodoFrete?.startsWith('retirada')) {
      // Retirada na matriz/polo - frete R$0
      setShippingMethod('manual'); // Usar manual para indicar valor fixo
      setPacCost(0);
      setSedexCost(0);
      // Nota: seção de frete será escondida no render quando for retirada
    } else if (metodoFrete === 'pac') {
      setShippingMethod('pac');
      setPacCost(proposta.valor_frete || 0);
    } else if (metodoFrete === 'sedex') {
      setShippingMethod('sedex');
      setSedexCost(proposta.valor_frete || 0);
    } else if (metodoFrete === 'free') {
      // Frete grátis
      setShippingMethod('manual');
      setPacCost(0);
      setSedexCost(0);
    } else {
      // Fallback: recalcular frete se necessário
      const enderecoData = proposta.cliente_endereco || {};
      if (enderecoData.cep) {
        handleCEPBlur(enderecoData.cep);
      }
    }
    
    setIsCepValid(true);
    setShowAddressForm(false); // Dados preenchidos, mostrar resumo
  }, [proposta, isPropostaFlow]);

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
    enabled: !!vendedorClienteId && !isPropostaFlow,
  });

  // Preencher dados do cliente (fluxo carrinho)
  useEffect(() => {
    if (vendedorCliente && !isLoadingVendedorCliente && !isPropostaFlow) {
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
  }, [vendedorCliente, isLoadingVendedorCliente, isPropostaFlow]);

  // Itens: da proposta ou do carrinho
  const checkoutItems = useMemo(() => {
    if (proposta?.itens && isPropostaFlow) {
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
  }, [proposta, isPropostaFlow, cartItems]);

  // Calcular valores
  const subtotal = useMemo(() => {
    if (proposta && isPropostaFlow) {
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
  }, [proposta, isPropostaFlow, cartItems]);

  const shippingCost = useMemo(() => {
    if (proposta && isPropostaFlow && (proposta.metodo_frete === 'manual' || proposta.frete_tipo === 'manual')) {
      return proposta.valor_frete || 0;
    }
    return shippingMethod === 'sedex' ? sedexCost : pacCost;
  }, [proposta, isPropostaFlow, shippingMethod, sedexCost, pacCost]);

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
        const itemsParaCalculo = isPropostaFlow && proposta?.itens 
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

  // Processar pagamento via backend (função pública mp-create-order-and-pay)
  const processPaymentViaBackend = async (data: AddressForm, method: 'pix' | 'card' | 'boleto', cardData?: any) => {
    if (!isPropostaFlow || !proposta) {
      toast.error('Proposta não encontrada');
      return null;
    }

    console.log('[Checkout] Processando pagamento via backend:', { method, proposta_id: proposta.id });

    const requestBody: any = {
      proposta_id: proposta.id,
      proposta_token: propostaToken || undefined,
      payment_method: method,
      payer: {
        nome: data.nome,
        sobrenome: data.sobrenome,
        email: data.email,
        telefone: data.telefone,
        cpf_cnpj: data.cpf,
      },
      endereco: {
        cep: data.cep,
        rua: data.rua,
        numero: data.numero,
        complemento: data.complemento || '',
        bairro: data.bairro,
        cidade: data.cidade,
        estado: data.estado,
      },
      frete: {
        metodo: shippingMethod,
        valor: shippingCost,
        prazo_dias: shippingMethod === 'sedex' ? sedexDays : pacDays,
      },
    };

    // Adicionar dados do cartão se for pagamento com cartão
    if (method === 'card' && cardData) {
      requestBody.card = cardData;
      requestBody.installments = parseInt(cardInstallments);
    }

    const { data: result, error } = await supabase.functions.invoke('mp-create-order-and-pay', {
      body: requestBody,
    });

    if (error) {
      console.error('[Checkout] Erro na função:', error);
      throw new Error(error.message || 'Erro ao processar pagamento');
    }

    if (!result?.success) {
      console.error('[Checkout] Erro retornado:', result?.error, 'request_id:', result?.request_id);
      throw new Error(result?.error || 'Erro ao criar pedido');
    }

    console.log('[Checkout] Pagamento processado:', result);
    return result;
  };

  const processPixPayment = async (data: AddressForm) => {
    setIsProcessing(true);
    
    try {
      const result = await processPaymentViaBackend(data, 'pix');
      
      if (!result) return;

      // Exibir QR Code
      setPixQrCode(result.qr_code_base64 || '');
      setPixCode(result.qr_code || '');
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

  const copyBoletoBarcode = () => {
    navigator.clipboard.writeText(boletoBarcode);
    toast.success('Código de barras copiado!');
  };

  // Formatar número do cartão
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 16);
    return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  // Formatar validade do cartão
  const formatCardExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length > 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    return cleaned;
  };

  // Processar pagamento com cartão de crédito
  const processCardPayment = async (data: AddressForm) => {
    setIsProcessing(true);
    
    try {
      // Validar campos do cartão
      if (cardNumber.replace(/\s/g, '').length < 16) {
        toast.error('Número do cartão inválido');
        return;
      }
      if (!cardHolder.trim()) {
        toast.error('Nome do titular é obrigatório');
        return;
      }
      if (cardExpiry.length < 5) {
        toast.error('Data de validade inválida');
        return;
      }
      if (cardCVV.length < 3) {
        toast.error('CVV inválido');
        return;
      }

      const [expiryMonth, expiryYear] = cardExpiry.split('/');
      
      const cardData = {
        card_number: cardNumber.replace(/\s/g, ''),
        cardholder_name: cardHolder,
        expiration_month: expiryMonth,
        expiration_year: `20${expiryYear}`,
        security_code: cardCVV,
      };

      const result = await processPaymentViaBackend(data, 'card', cardData);
      
      if (!result) return;

      if (result.status === 'approved') {
        toast.success('Pagamento aprovado!');
        clearCart();
        navigate('/ebd/order-success');
      } else if (result.status === 'in_process') {
        toast.info('Pagamento em análise. Você será notificado quando for aprovado.');
        clearCart();
        navigate('/ebd/order-success');
      } else {
        toast.error('Pagamento não aprovado. Por favor, tente novamente.');
      }
      
    } catch (error) {
      console.error('Erro ao processar cartão:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  // Processar pagamento com boleto
  const processBoletoPayment = async (data: AddressForm) => {
    setIsProcessing(true);
    
    try {
      const result = await processPaymentViaBackend(data, 'boleto');
      
      if (!result) return;

      // Exibir boleto
      setBoletoUrl(result.external_resource_url || '');
      setBoletoBarcode(result.barcode || '');
      setShowBoletoDialog(true);

      toast.success('Boleto gerado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao gerar boleto:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar boleto');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (data: AddressForm) => {
    if (paymentMethod === 'pix') {
      await processPixPayment(data);
    } else if (paymentMethod === 'card') {
      await processCardPayment(data);
    } else if (paymentMethod === 'boleto') {
      await processBoletoPayment(data);
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
        {/* Header com Logo */}
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/logos/logo-central-gospel.png" 
            alt="Central Gospel" 
            className="h-16 mb-4"
          />
          <h1 className="text-2xl font-bold text-center">Checkout - Mercado Pago</h1>
          {(propostaToken && proposta?.cliente_nome) || vendedorClienteNome ? (
            <p className="text-muted-foreground text-center">
              Cliente: <span className="font-medium text-foreground">{proposta?.cliente_nome || vendedorClienteNome}</span>
            </p>
          ) : null}
          {(propostaToken && proposta?.vendedor_email) ? (
            <p className="text-sm text-green-600 text-center">
              Vendedor: {proposta.vendedor_nome || 'N/A'} ({proposta.vendedor_email})
            </p>
          ) : (!propostaToken && vendedor) ? (
            <p className="text-sm text-green-600 text-center">
              Vendedor: {vendedor.nome} ({vendedor.email})
            </p>
          ) : null}
        </div>

        {/* Botão voltar */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

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

                {/* Frete - esconder se for retirada, frete grátis ou frete manual */}
                {isPropostaFlow && proposta?.metodo_frete?.startsWith('retirada') ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Retirada no Local
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="font-medium text-green-800">
                          {proposta.metodo_frete === 'retirada' && 'Retirada na Matriz - Rio de Janeiro'}
                          {proposta.metodo_frete === 'retirada_pe' && 'Retirada no Polo - Pernambuco'}
                          {proposta.metodo_frete === 'retirada_penha' && 'Retirada no Polo - Penha / RJ'}
                        </p>
                        <p className="text-sm text-green-700 mt-1">
                          {proposta.metodo_frete === 'retirada' && 'Estrada do Guerenguê, 1851 - Taquara, Rio de Janeiro - RJ'}
                          {proposta.metodo_frete === 'retirada_pe' && 'Rua Adalberto Coimbra, 211, Galpão B - Jardim Jordão, Jaboatão dos Guararapes - PE'}
                          {proposta.metodo_frete === 'retirada_penha' && 'R. Honório Bicalho, 102 - Penha, Rio de Janeiro - RJ'}
                        </p>
                        <p className="text-sm text-green-600 mt-1">Segunda a Sexta: 9h às 18h</p>
                        <p className="text-sm font-bold text-green-800 mt-2">Frete: Grátis</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : isPropostaFlow && (proposta?.metodo_frete === 'free' || proposta?.metodo_frete === 'manual' || proposta?.frete_tipo === 'manual') ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Forma de Envio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="font-medium text-green-800">
                          {proposta?.metodo_frete === 'free' ? 'Frete Grátis' : 'Frete Definido pelo Vendedor'}
                        </p>
                        <p className="text-sm font-bold text-green-800 mt-2">
                          Valor: R$ {(proposta?.valor_frete || 0).toFixed(2)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
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
                )}

                {/* Pagamento */}
                <Card>
                  <CardHeader>
                    <CardTitle>Forma de Pagamento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(value) => setPaymentMethod(value as 'pix' | 'card' | 'boleto')}
                      className="space-y-3"
                    >
                      <div className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'pix' ? 'border-green-500 bg-green-50' : ''}`}>
                        <RadioGroupItem value="pix" id="pix" />
                        <Label htmlFor="pix" className="cursor-pointer flex items-center gap-2 flex-1">
                          <QrCode className="h-5 w-5 text-green-600" />
                          <div>
                            <span className="font-medium">PIX</span>
                            <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
                          </div>
                        </Label>
                      </div>
                      <div className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50' : ''}`}>
                        <RadioGroupItem value="card" id="card" />
                        <Label htmlFor="card" className="cursor-pointer flex items-center gap-2 flex-1">
                          <CreditCard className="h-5 w-5 text-blue-600" />
                          <div>
                            <span className="font-medium">Cartão de Crédito</span>
                            <p className="text-sm text-muted-foreground">Parcelamento em até 12x</p>
                          </div>
                        </Label>
                      </div>
                      <div className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'boleto' ? 'border-orange-500 bg-orange-50' : ''}`}>
                        <RadioGroupItem value="boleto" id="boleto" />
                        <Label htmlFor="boleto" className="cursor-pointer flex items-center gap-2 flex-1">
                          <FileText className="h-5 w-5 text-orange-600" />
                          <div>
                            <span className="font-medium">Boleto Bancário</span>
                            <p className="text-sm text-muted-foreground">Vencimento em 3 dias úteis</p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>

                    {/* Formulário de Cartão */}
                    {paymentMethod === 'card' && (
                      <div className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-4">
                        <h4 className="font-medium text-sm">Dados do Cartão</h4>
                        
                        <div className="space-y-2">
                          <Label htmlFor="cardNumber">Número do Cartão</Label>
                          <Input
                            id="cardNumber"
                            placeholder="0000 0000 0000 0000"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                            maxLength={19}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="cardHolder">Nome do Titular</Label>
                          <Input
                            id="cardHolder"
                            placeholder="Nome como está no cartão"
                            value={cardHolder}
                            onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                          />
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="cardExpiry">Validade</Label>
                            <Input
                              id="cardExpiry"
                              placeholder="MM/AA"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(formatCardExpiry(e.target.value))}
                              maxLength={5}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cardCVV">CVV</Label>
                            <Input
                              id="cardCVV"
                              placeholder="000"
                              value={cardCVV}
                              onChange={(e) => setCardCVV(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              maxLength={4}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cardInstallments">Parcelas</Label>
                            <Select value={cardInstallments} onValueChange={setCardInstallments}>
                              <SelectTrigger>
                                <SelectValue placeholder="Parcelas" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1x de R$ {total.toFixed(2)}</SelectItem>
                                <SelectItem value="2">2x de R$ {(total / 2).toFixed(2)}</SelectItem>
                                <SelectItem value="3">3x de R$ {(total / 3).toFixed(2)}</SelectItem>
                                <SelectItem value="4">4x de R$ {(total / 4).toFixed(2)}</SelectItem>
                                <SelectItem value="5">5x de R$ {(total / 5).toFixed(2)}</SelectItem>
                                <SelectItem value="6">6x de R$ {(total / 6).toFixed(2)}</SelectItem>
                                <SelectItem value="7">7x de R$ {(total / 7).toFixed(2)}</SelectItem>
                                <SelectItem value="8">8x de R$ {(total / 8).toFixed(2)}</SelectItem>
                                <SelectItem value="9">9x de R$ {(total / 9).toFixed(2)}</SelectItem>
                                <SelectItem value="10">10x de R$ {(total / 10).toFixed(2)}</SelectItem>
                                <SelectItem value="11">11x de R$ {(total / 11).toFixed(2)}</SelectItem>
                                <SelectItem value="12">12x de R$ {(total / 12).toFixed(2)}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}
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

        {/* Dialog Boleto */}
        <Dialog open={showBoletoDialog} onOpenChange={setShowBoletoDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600" />
                Boleto Bancário Gerado
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Seu boleto foi gerado com sucesso! Você pode imprimir ou copiar o código de barras.
              </p>
              
              {boletoBarcode && (
                <div className="space-y-2">
                  <Label>Código de Barras</Label>
                  <div className="flex gap-2">
                    <Input value={boletoBarcode} readOnly className="text-xs font-mono" />
                    <Button variant="outline" onClick={copyBoletoBarcode}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="text-lg font-bold text-orange-600">
                Total: R$ {total.toFixed(2)}
              </div>

              <p className="text-xs text-muted-foreground">
                O boleto vence em 3 dias úteis. Após o pagamento, a confirmação pode levar até 2 dias úteis.
              </p>

              <div className="flex flex-col gap-2">
                {boletoUrl && (
                  <Button asChild className="w-full">
                    <a href={boletoUrl} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-4 w-4 mr-2" />
                      Visualizar/Imprimir Boleto
                    </a>
                  </Button>
                )}
                <Button variant="outline" onClick={handlePaymentComplete} className="w-full">
                  Continuar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
