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
import { ArrowLeft, CreditCard, FileText, QrCode, MapPin, Check, Edit } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Função para validar CPF
const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/\D/g, '');
  
  if (cleanCPF.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF[9])) return false;
  
  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF[10])) return false;
  
  return true;
};

// Função para validar CNPJ
const validateCNPJ = (cnpj: string): boolean => {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  
  if (cleanCNPJ.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;
  
  // Validação do primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCNPJ[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleanCNPJ[12])) return false;
  
  // Validação do segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCNPJ[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleanCNPJ[13])) return false;
  
  return true;
};

// Função para validar CPF ou CNPJ
const validateCPFOrCNPJ = (value: string): boolean => {
  const cleanValue = value.replace(/\D/g, '');
  
  if (cleanValue.length === 11) {
    return validateCPF(cleanValue);
  } else if (cleanValue.length === 14) {
    return validateCNPJ(cleanValue);
  }
  
  return false;
};

// Função para formatar CPF/CNPJ
const formatCPFOrCNPJ = (value: string): string => {
  const cleanValue = value.replace(/\D/g, '');
  
  if (cleanValue.length <= 11) {
    // Formato CPF: 000.000.000-00
    return cleanValue
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // Formato CNPJ: 00.000.000/0000-00
    return cleanValue
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
};

// Função para formatar CEP
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
  cep: z.string().min(8, 'CEP inválido').max(9),
  rua: z.string().min(3, 'Rua é obrigatória').max(200, 'Endereço muito longo'),
  numero: z.string().min(1, 'Número é obrigatório').max(20, 'Número muito longo'),
  complemento: z.string().max(100, 'Complemento muito longo').optional(),
  bairro: z.string().min(2, 'Bairro é obrigatório').max(100, 'Bairro muito longo'),
  cidade: z.string().min(2, 'Cidade é obrigatória').max(100, 'Cidade muito longa'),
  estado: z.string().length(2, 'Estado deve ter 2 letras'),
});

type AddressForm = z.infer<typeof addressSchema>;

interface Revista {
  id: string;
  titulo: string;
  imagem_url: string | null;
  preco_cheio: number | null;
}

interface SavedAddress {
  id: string;
  nome: string;
  sobrenome: string | null;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cep: string;
  estado: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<'boleto' | 'card' | 'pix'>('pix');
  const [isProcessing, setIsProcessing] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'free' | 'pac' | 'sedex'>('pac');
  const [pacCost, setPacCost] = useState<number>(0);
  const [sedexCost, setSedexCost] = useState<number>(0);
  const [pacDays, setPacDays] = useState<number>(0);
  const [sedexDays, setSedexDays] = useState<number>(0);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [isCepValid, setIsCepValid] = useState<boolean | null>(null);
  const [cart, setCart] = useState<{ [key: string]: number }>(() => {
    const saved = localStorage.getItem('ebd-cart');
    return saved ? JSON.parse(saved) : {};
  });
  const [showPixDialog, setShowPixDialog] = useState(false);
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixCode, setPixCode] = useState('');
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [installments, setInstallments] = useState('1');
  const [useSavedAddress, setUseSavedAddress] = useState<boolean | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const form = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      nome: '',
      sobrenome: '',
      cpf: '',
      email: '',
      cep: '',
      rua: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
    },
  });

  // Buscar endereço salvo do usuário
  const { data: savedAddress, isLoading: isLoadingAddress } = useQuery({
    queryKey: ['saved-address'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('ebd_endereco_entrega')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar endereço salvo:', error);
        return null;
      }

      return data as SavedAddress | null;
    },
  });

  // Efeito para decidir se mostra o formulário ou endereço salvo
  useEffect(() => {
    if (!isLoadingAddress) {
      if (savedAddress) {
        setUseSavedAddress(true);
        // Preenche o formulário com os dados salvos
        form.reset({
          nome: savedAddress.nome,
          sobrenome: savedAddress.sobrenome || '',
          cpf: savedAddress.cpf_cnpj || '',
          email: savedAddress.email || '',
          cep: savedAddress.cep,
          rua: savedAddress.rua,
          numero: savedAddress.numero,
          complemento: savedAddress.complemento || '',
          bairro: savedAddress.bairro,
          cidade: savedAddress.cidade,
          estado: savedAddress.estado,
        });
        // Calcular frete automaticamente se tiver endereço salvo
        handleCEPBlur(savedAddress.cep);
      } else {
        setUseSavedAddress(false);
        setShowAddressForm(true);
      }
    }
  }, [savedAddress, isLoadingAddress]);

  // Função para salvar/atualizar endereço
  const saveAddress = async (data: AddressForm) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const addressData = {
        user_id: user.id,
        nome: data.nome,
        sobrenome: data.sobrenome,
        cpf_cnpj: data.cpf,
        email: data.email,
        cep: data.cep,
        estado: data.estado,
        rua: data.rua,
        numero: data.numero,
        complemento: data.complemento || null,
        bairro: data.bairro,
        cidade: data.cidade,
      };

      const { error } = await supabase
        .from('ebd_endereco_entrega')
        .upsert(addressData, { onConflict: 'user_id' });

      if (error) {
        console.error('Erro ao salvar endereço:', error);
      }
    } catch (error) {
      console.error('Erro ao salvar endereço:', error);
    }
  };

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
        setIsCalculatingShipping(true);
        setIsCepValid(null);
        
        // Buscar endereço
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        
        if (data.erro) {
          setIsCepValid(false);
          setPacCost(0);
          setSedexCost(0);
          toast({
            title: 'CEP não encontrado',
            description: 'Verifique se o CEP está correto e tente novamente.',
            variant: 'destructive',
          });
          return;
        }
        
        setIsCepValid(true);
        form.setValue('rua', data.logradouro || '');
        form.setValue('bairro', data.bairro || '');
        form.setValue('cidade', data.localidade || '');
        form.setValue('estado', data.uf || '');

        // Calcular frete
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
          
          // Se tiver frete grátis, seleciona automaticamente
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
        setIsCepValid(false);
        toast({
          title: 'Erro ao buscar CEP',
          description: 'Verifique sua conexão e tente novamente.',
          variant: 'destructive',
        });
      } finally {
        setIsCalculatingShipping(false);
      }
    } else {
      setIsCepValid(null);
    }
  };

  const processPayment = async (data: AddressForm) => {
    if (paymentMethod === 'pix') {
      await processPixPayment(data);
    } else if (paymentMethod === 'card') {
      setShowCardForm(true);
    } else {
      await processBoletoPayment(data);
    }
  };

  const processPixPayment = async (data: AddressForm) => {
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

      const { data: pixData, error: pixError } = await supabase.functions.invoke(
        'process-transparent-payment',
        {
          body: {
            payment_method: 'pix',
            transaction_amount: Math.round(total * 100) / 100,
            description: `Compra de ${revistaIds.length} revista(s) EBD`,
            payer: {
              email: data.email,
              first_name: data.nome,
              last_name: data.sobrenome,
              identification: {
                type: 'CPF',
                number: data.cpf.replace(/\D/g, ''),
              },
            },
            items: revistaIds.map(revistaId => {
              const revista = revistas?.find(r => r.id === revistaId);
              return {
                id: revistaId,
                title: revista?.titulo || 'Revista EBD',
                quantity: cart[revistaId],
                unit_price: (revista?.preco_cheio || 0) * 0.7,
              };
            }),
            shipping_cost: shippingCost,
          },
        }
      );

      if (pixError) {
        console.error('Erro ao processar PIX:', pixError);
        throw pixError;
      }

      if (pixData?.qr_code && pixData?.qr_code_base64 && pixData?.id) {
        // Criar pedido
        const { data: pedido, error: pedidoError } = await supabase
          .from('ebd_pedidos')
          .insert({
            church_id: churchData.id,
            mercadopago_payment_id: pixData.id,
            status: 'pending',
            payment_status: 'pending',
            status_logistico: 'AGUARDANDO_ENVIO',
            valor_produtos: calculateSubtotal(),
            valor_frete: shippingCost,
            valor_total: total,
            metodo_frete: shippingMethod,
            endereco_cep: data.cep,
            endereco_rua: data.rua,
            endereco_numero: data.numero,
            endereco_complemento: data.complemento,
            endereco_bairro: data.bairro,
            endereco_cidade: data.cidade,
            endereco_estado: data.estado,
            email_cliente: data.email,
            nome_cliente: data.nome,
            sobrenome_cliente: data.sobrenome,
            cpf_cnpj_cliente: data.cpf,
          })
          .select()
          .single();

        if (pedidoError) {
          console.error('Erro ao criar pedido:', pedidoError);
        } else if (pedido) {
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
            console.error('Erro ao criar itens do pedido:', itensError);
          }

          // Enviar email de confirmação de pedido
          try {
            await supabase.functions.invoke('send-order-email', {
              body: { orderId: pedido.id, emailType: 'order_created' },
            });
          } catch (emailError) {
            console.error('Erro ao enviar email:', emailError);
          }
        }

        setPixCode(pixData.qr_code);
        setPixQrCode(pixData.qr_code_base64);
        setShowPixDialog(true);
      }
    } catch (error) {
      console.error('Erro ao processar PIX:', error);
      toast({
        title: 'Erro ao processar PIX',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processCardPayment = async (data: AddressForm) => {
    if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os dados do cartão',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: churchData } = await supabase
        .from('churches')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!churchData) return;

      const [expMonth, expYear] = cardExpiry.split('/');

      const { data: cardData, error: cardError } = await supabase.functions.invoke(
        'process-transparent-payment',
        {
          body: {
            payment_method: 'card',
            transaction_amount: Math.round(total * 100) / 100,
            description: `Compra de ${revistaIds.length} revista(s) EBD`,
            installments: parseInt(installments),
            payer: {
              email: data.email,
              first_name: data.nome,
              last_name: data.sobrenome,
              identification: {
                type: 'CPF',
                number: data.cpf.replace(/\D/g, ''),
              },
            },
            card: {
              card_number: cardNumber.replace(/\s/g, ''),
              cardholder_name: cardHolder,
              expiration_month: expMonth,
              expiration_year: `20${expYear}`,
              security_code: cardCvv,
            },
            items: revistaIds.map(revistaId => {
              const revista = revistas?.find(r => r.id === revistaId);
              return {
                id: revistaId,
                title: revista?.titulo || 'Revista EBD',
                quantity: cart[revistaId],
                unit_price: (revista?.preco_cheio || 0) * 0.7,
              };
            }),
            shipping_cost: shippingCost,
          },
        }
      );

      if (cardError) {
        throw cardError;
      }

      if (cardData?.status === 'approved' && cardData?.id) {
        // Criar pedido
        const { data: pedido, error: pedidoError } = await supabase
          .from('ebd_pedidos')
          .insert({
            church_id: churchData.id,
            mercadopago_payment_id: cardData.id,
            status: 'PAGO',
            payment_status: 'approved',
            status_logistico: 'AGUARDANDO_ENVIO',
            valor_produtos: calculateSubtotal(),
            valor_frete: shippingCost,
            valor_total: total,
            metodo_frete: shippingMethod,
            endereco_cep: data.cep,
            endereco_rua: data.rua,
            endereco_numero: data.numero,
            endereco_complemento: data.complemento,
            endereco_bairro: data.bairro,
            endereco_cidade: data.cidade,
            endereco_estado: data.estado,
            email_cliente: data.email,
            nome_cliente: data.nome,
            sobrenome_cliente: data.sobrenome,
            cpf_cnpj_cliente: data.cpf,
            approved_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (pedidoError) {
          console.error('Erro ao criar pedido:', pedidoError);
        } else if (pedido) {
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
            console.error('Erro ao criar itens do pedido:', itensError);
          }

          // Ativar revistas compradas
          const purchases = revistaIds.map(revistaId => ({
            church_id: churchData.id,
            revista_id: revistaId,
            preco_pago: ((revistas?.find(r => r.id === revistaId)?.preco_cheio || 0) * 0.7) * cart[revistaId],
          }));

          await supabase.from('ebd_revistas_compradas').insert(purchases);

          // Enviar email de pagamento aprovado
          try {
            await supabase.functions.invoke('send-order-email', {
              body: { orderId: pedido.id, emailType: 'payment_approved' },
            });
          } catch (emailError) {
            console.error('Erro ao enviar email:', emailError);
          }
        }
        
        localStorage.removeItem('ebd-cart');
        
        navigate(`/ebd/order-success?pedido=${pedido?.id || ''}`);
      } else {
        toast({
          title: 'Pagamento não aprovado',
          description: cardData?.status_detail || 'Tente novamente ou use outro método',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao processar cartão:', error);
      toast({
        title: 'Erro ao processar pagamento',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setShowCardForm(false);
    }
  };

  const processBoletoPayment = async (data: AddressForm) => {
    setIsProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: churchData } = await supabase
        .from('churches')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!churchData) return;

      const { data: boletoData, error: boletoError } = await supabase.functions.invoke(
        'process-transparent-payment',
        {
          body: {
            payment_method: 'boleto',
            transaction_amount: Math.round(total * 100) / 100,
            description: `Compra de ${revistaIds.length} revista(s) EBD`,
            payer: {
              email: data.email,
              first_name: data.nome,
              last_name: data.sobrenome,
              identification: {
                type: 'CPF',
                number: data.cpf.replace(/\D/g, ''),
              },
              address: {
                zip_code: data.cep.replace(/\D/g, ''),
                street_name: data.rua,
                street_number: data.numero,
                neighborhood: data.bairro,
                city: data.cidade,
                federal_unit: data.estado,
              },
            },
            items: revistaIds.map(revistaId => {
              const revista = revistas?.find(r => r.id === revistaId);
              return {
                id: revistaId,
                title: revista?.titulo || 'Revista EBD',
                quantity: cart[revistaId],
                unit_price: (revista?.preco_cheio || 0) * 0.7,
              };
            }),
            shipping_cost: shippingCost,
          },
        }
      );

      if (boletoError) {
        throw boletoError;
      }

      if (boletoData?.external_resource_url && boletoData?.id) {
        // Criar pedido
        const { data: pedido, error: pedidoError } = await supabase
          .from('ebd_pedidos')
          .insert({
            church_id: churchData.id,
            mercadopago_payment_id: boletoData.id,
            status: 'pending',
            payment_status: 'pending',
            status_logistico: 'AGUARDANDO_ENVIO',
            valor_produtos: calculateSubtotal(),
            valor_frete: shippingCost,
            valor_total: total,
            metodo_frete: shippingMethod,
            endereco_cep: data.cep,
            endereco_rua: data.rua,
            endereco_numero: data.numero,
            endereco_complemento: data.complemento,
            endereco_bairro: data.bairro,
            endereco_cidade: data.cidade,
            endereco_estado: data.estado,
            email_cliente: data.email,
            nome_cliente: data.nome,
            sobrenome_cliente: data.sobrenome,
            cpf_cnpj_cliente: data.cpf,
          })
          .select()
          .single();

        if (pedidoError) {
          console.error('Erro ao criar pedido:', pedidoError);
        } else if (pedido) {
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
            console.error('Erro ao criar itens do pedido:', itensError);
          }

          // Enviar email de confirmação de pedido
          try {
            await supabase.functions.invoke('send-order-email', {
              body: { orderId: pedido.id, emailType: 'order_created' },
            });
          } catch (emailError) {
            console.error('Erro ao enviar email:', emailError);
          }
        }
        
        localStorage.removeItem('ebd-cart');
        
        window.open(boletoData.external_resource_url, '_blank');
        
        navigate(`/ebd/order-success?pedido=${pedido?.id || ''}`);
      }
    } catch (error) {
      console.error('Erro ao processar boleto:', error);
      toast({
        title: 'Erro ao processar boleto',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const onSubmit = async (data: AddressForm) => {
    // Salvar endereço para reutilização futura
    await saveAddress(data);
    await processPayment(data);
  };

  const handleUseSavedAddress = () => {
    setUseSavedAddress(true);
    setShowAddressForm(false);
    if (savedAddress) {
      form.reset({
        nome: savedAddress.nome,
        sobrenome: savedAddress.sobrenome || '',
        cpf: savedAddress.cpf_cnpj || '',
        email: savedAddress.email || '',
        cep: savedAddress.cep,
        rua: savedAddress.rua,
        numero: savedAddress.numero,
        complemento: savedAddress.complemento || '',
        bairro: savedAddress.bairro,
        cidade: savedAddress.cidade,
        estado: savedAddress.estado,
      });
    }
  };

  const handleChangeAddress = () => {
    setUseSavedAddress(false);
    setShowAddressForm(true);
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
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Endereço de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Opção de usar endereço salvo */}
                {savedAddress && useSavedAddress && !showAddressForm && (
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 text-primary font-medium">
                          <Check className="w-5 h-5" />
                          <span>Usar este endereço de entrega?</span>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground">{savedAddress.nome} {savedAddress.sobrenome}</p>
                        {savedAddress.email && <p>{savedAddress.email}</p>}
                        {savedAddress.cpf_cnpj && <p>CPF/CNPJ: {savedAddress.cpf_cnpj}</p>}
                        <p>{savedAddress.rua}, {savedAddress.numero}{savedAddress.complemento ? ` - ${savedAddress.complemento}` : ''}</p>
                        <p>{savedAddress.bairro} - {savedAddress.cidade}/{savedAddress.estado}</p>
                        <p>CEP: {savedAddress.cep}</p>
                      </div>
                      <div className="flex gap-3 mt-4">
                        <Button
                          type="button"
                          onClick={handleUseSavedAddress}
                          className="flex-1"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Sim, usar este endereço
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleChangeAddress}
                          className="flex-1"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Mudar Endereço
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Formulário de endereço */}
                {(showAddressForm || !savedAddress) && (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="João" />
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
                              <Input {...field} placeholder="Silva" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF/CNPJ</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                                maxLength={18}
                                onChange={(e) => {
                                  const formatted = formatCPFOrCNPJ(e.target.value);
                                  field.onChange(formatted);
                                }}
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
                                maxLength={9}
                                onChange={(e) => {
                                  const formatted = formatCEP(e.target.value);
                                  field.onChange(formatted);
                                  // Busca automática quando CEP estiver completo (8 dígitos)
                                  const cleanCEP = formatted.replace(/\D/g, '');
                                  if (cleanCEP.length === 8) {
                                    handleCEPBlur(formatted);
                                  }
                                }}
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
                )}
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

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                </div>

                {!isCalculatingShipping && pacCost > 0 && (
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
                                <span className="font-semibold text-green-700 dark:text-green-400">Frete Grátis: R$ 0,00</span>
                                <span className="text-xs text-muted-foreground">15 dias úteis</span>
                              </div>
                            </Label>
                          </div>
                        )}
                        <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                          <RadioGroupItem value="pac" id="pac" />
                          <Label htmlFor="pac" className="cursor-pointer flex-1">
                            <div className="flex justify-between">
                              <span className="font-semibold">PAC: R$ {pacCost.toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground">{pacDays} dias úteis</span>
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                          <RadioGroupItem value="sedex" id="sedex" />
                          <Label htmlFor="sedex" className="cursor-pointer flex-1">
                            <div className="flex justify-between">
                              <span className="font-semibold">Sedex: R$ {sedexCost.toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground">{sedexDays} dias úteis</span>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </>
                )}

                {isCalculatingShipping && (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    Calculando opções de frete...
                  </div>
                )}

                {!isCalculatingShipping && pacCost === 0 && (
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
                  {shippingMethod !== 'free' && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Prazo de entrega:</span>
                      <span>{shippingMethod === 'sedex' ? sedexDays : pacDays} dias úteis</span>
                    </div>
                  )}
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
                  disabled={isProcessing || pacCost === 0 || isCalculatingShipping || isCepValid === false}
                >
                  {isProcessing ? 'Processando...' : isCalculatingShipping ? 'Calculando frete...' : isCepValid === false ? 'CEP inválido' : 'Confirmar Pedido'}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Ao confirmar, você concorda com nossos termos de uso
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* PIX Dialog */}
      <Dialog open={showPixDialog} onOpenChange={setShowPixDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento via PIX</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground text-center">
                Escaneie o QR Code ou copie o código PIX para realizar o pagamento
              </p>
              {pixQrCode && (
                <img
                  src={`data:image/png;base64,${pixQrCode}`}
                  alt="QR Code PIX"
                  className="w-64 h-64"
                />
              )}
              <div className="w-full space-y-2">
                <Label>Código PIX Copia e Cola</Label>
                <div className="flex gap-2">
                  <Input
                    value={pixCode}
                    readOnly
                    className="flex-1 text-xs"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(pixCode);
                      toast({
                        title: 'Código copiado!',
                        description: 'Cole no seu aplicativo de pagamentos',
                      });
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Após o pagamento, você receberá a confirmação por email
              </p>
              <Button
                onClick={() => {
                  setShowPixDialog(false);
                  localStorage.removeItem('ebd-cart');
                  navigate('/ebd/catalogo?status=pending');
                }}
                className="w-full"
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Form Dialog */}
      <Dialog open={showCardForm} onOpenChange={setShowCardForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dados do Cartão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cardNumber">Número do Cartão</Label>
              <Input
                id="cardNumber"
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
                  setCardNumber(formatted);
                }}
                maxLength={19}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardHolder">Nome no Cartão</Label>
              <Input
                id="cardHolder"
                placeholder="Nome como está no cartão"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cardExpiry">Validade</Label>
                <Input
                  id="cardExpiry"
                  placeholder="MM/AA"
                  value={cardExpiry}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    const formatted = value.length >= 2 
                      ? `${value.slice(0, 2)}/${value.slice(2, 4)}`
                      : value;
                    setCardExpiry(formatted);
                  }}
                  maxLength={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardCvv">CVV</Label>
                <Input
                  id="cardCvv"
                  placeholder="000"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                  maxLength={4}
                  type="password"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="installments">Parcelas</Label>
              <Select value={installments} onValueChange={setInstallments}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}x de R$ {(total / num).toFixed(2)} {num === 1 ? '' : 'sem juros'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCardForm(false)}
                className="flex-1"
                disabled={isProcessing}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  const formData = form.getValues();
                  processCardPayment(formData);
                }}
                className="flex-1"
                disabled={isProcessing}
              >
                {isProcessing ? 'Processando...' : 'Pagar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
