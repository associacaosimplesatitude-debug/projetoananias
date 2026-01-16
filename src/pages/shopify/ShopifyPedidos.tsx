import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  ExternalLink,
  Loader2,
  ArrowLeft,
  Users,
  Filter,
  X,
  User,
  Link,
  Copy,
  CheckCircle,
  FileText,
} from "lucide-react";
import { fetchShopifyProducts, ShopifyProduct, CartItem, createStorefrontCheckout, BuyerInfo } from "@/lib/shopify";
import { useShopifyCartStore } from "@/stores/shopifyCartStore";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useVendedor } from "@/hooks/useVendedor";
import { useUserRole } from "@/hooks/useUserRole";
import { FaturamentoSelectionDialog, FreteManualData, PagamentoLojaData } from "@/components/shopify/FaturamentoSelectionDialog";
import { VendaConcluidaDialog } from "@/components/shopify/VendaConcluidaDialog";
import { DescontoRevendedorBanner } from "@/components/shopify/DescontoRevendedorBanner";
import { CartQuantityField } from "@/components/shopify/CartQuantityField";
import { EnderecoEntregaSection } from "@/components/shopify/EnderecoEntregaSection";

import { DescontoBanner } from "@/components/shopify/DescontoBanner";
import { calcularDescontosCarrinho, calcularDescontoRevendedor, isProdutoAdvec50, isClienteRepresentante } from "@/lib/descontosShopify";
import { useDescontosRepresentante } from "@/hooks/useDescontosRepresentante";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


interface Vendedor {
  id: string;
  nome: string;
  foto_url: string | null;
}

interface Cliente {
  id: string;
  nome_igreja: string;
  cnpj: string | null;
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
  tipo_cliente?: string | null;
  vendedor?: Vendedor | null;
  onboarding_concluido?: boolean | null;
  superintendente_user_id?: string | null;
}

export default function ShopifyPedidos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Read client info from URL params (for vendedor flow)
  const urlClienteId = searchParams.get('clienteId');
  const urlClienteNome = searchParams.get('clienteNome');
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [showFaturamentoDialog, setShowFaturamentoDialog] = useState(false);
  const [faturamentoConfig, setFaturamentoConfig] = useState<{
    prazo: string;
    desconto: number;
    frete: { type: string; cost: number };
    freteManual?: FreteManualData;
  } | null>(null);
  
  // Estados para proposta digital
  const [showPropostaLinkDialog, setShowPropostaLinkDialog] = useState(false);
  const [propostaLink, setPropostaLink] = useState<string>("");
  const [isGeneratingProposta, setIsGeneratingProposta] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);
  const [propostaClienteNome, setPropostaClienteNome] = useState<string>("");
  
  // Estados para diálogo de venda concluída (Pagar na Loja)
  const [showVendaConcluidaDialog, setShowVendaConcluidaDialog] = useState(false);
  const [vendaConcluida, setVendaConcluida] = useState<{
    clienteNome: string;
    blingOrderId: number | null;
    blingOrderNumber: string | null;
  } | null>(null);
  
  // Estados para endereço
  const [selectedEndereco, setSelectedEndereco] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user ID
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  // Definir categorias e subcategorias
  const categories = [
    { 
      id: 'all', 
      name: 'Todas as Categorias',
      subcategories: []
    },
    { 
      id: 'revistas', 
      name: 'Revistas EBD',
      subcategories: [
        { id: 'all', name: 'Todas as Revistas' },
        { id: 'jovens-adultos', name: 'Jovens e Adultos' },
        { id: 'juvenis', name: 'Juvenis' },
        { id: 'adolescentes', name: 'Adolescentes' },
        { id: 'juniores', name: 'Juniores' },
        { id: 'primarios', name: 'Primários' },
        { id: 'jardim', name: 'Jardim de Infância' },
        { id: 'maternal', name: 'Maternal' },
        { id: 'bercario', name: 'Berçário' },
        { id: 'discipulado', name: 'Discipulado' },
        { id: 'professor', name: 'Professor' },
        { id: 'aluno', name: 'Aluno' },
      ]
    },
    { 
      id: 'biblias', 
      name: 'Bíblias',
      subcategories: [
        { id: 'all', name: 'Todas as Bíblias' },
        { id: 'estudo', name: 'Bíblias de Estudo' },
        { id: 'mulher', name: 'Bíblias Femininas' },
        { id: 'jovem', name: 'Bíblias Jovem' },
        { id: 'infantil', name: 'Bíblias Infantis' },
        { id: 'ilustrada', name: 'Bíblias Ilustradas' },
      ]
    },
    { 
      id: 'livros', 
      name: 'Livros e Devocionais',
      subcategories: [
        { id: 'all', name: 'Todos os Livros' },
        { id: 'devocional', name: 'Devocionais' },
        { id: 'casamento', name: 'Casamento e Família' },
        { id: 'lideranca', name: 'Liderança' },
      ]
    },
    { 
      id: 'infantil', 
      name: 'Infantil',
      subcategories: [
        { id: 'all', name: 'Todos os Infantis' },
        { id: 'livros-infantis', name: 'Livros Infantis' },
        { id: 'atividades', name: 'Atividades' },
      ]
    },
    { 
      id: 'perfumes', 
      name: 'Perfumes',
      subcategories: []
    },
    { 
      id: 'outros', 
      name: 'Outros Produtos',
      subcategories: []
    },
  ];

  // Função para categorizar produto baseado no título
  const categorizeProduct = (title: string): { category: string; subcategory: string } => {
    const lowerTitle = title.toLowerCase();
    
    // Revistas EBD - inclui Kit do Professor, Estudo Bíblico, etc.
    const isRevista = lowerTitle.includes('revista') || 
                      lowerTitle.includes('ebd') || 
                      lowerTitle.includes('estudo bíblico') || 
                      lowerTitle.includes('estudo biblico') ||
                      lowerTitle.includes('kit do professor') ||
                      lowerTitle.includes('kit professor') ||
                      lowerTitle.includes('infografico');
    
    if (isRevista) {
      let subcategory = 'all';
      if (lowerTitle.includes('jovens e adultos') || lowerTitle.includes('jovens adultos')) subcategory = 'jovens-adultos';
      else if (lowerTitle.includes('juvenis') || lowerTitle.includes('juvenil')) subcategory = 'juvenis';
      else if (lowerTitle.includes('adolescentes') || lowerTitle.includes('adolescente')) subcategory = 'adolescentes';
      else if (lowerTitle.includes('juniores') || lowerTitle.includes('junior')) subcategory = 'juniores';
      else if (lowerTitle.includes('primários') || lowerTitle.includes('primario') || lowerTitle.includes('primarios')) subcategory = 'primarios';
      else if (lowerTitle.includes('jardim')) subcategory = 'jardim';
      else if (lowerTitle.includes('maternal')) subcategory = 'maternal';
      else if (lowerTitle.includes('berçário') || lowerTitle.includes('bercario')) subcategory = 'bercario';
      else if (lowerTitle.includes('discipulado')) subcategory = 'discipulado';
      
      // Check for professor/aluno
      if (lowerTitle.includes('professor')) subcategory = 'professor';
      else if (lowerTitle.includes('aluno')) subcategory = 'aluno';
      
      return { category: 'revistas', subcategory };
    }
    
    // Bíblias
    if (lowerTitle.includes('bíblia') || lowerTitle.includes('biblia')) {
      let subcategory = 'all';
      if (lowerTitle.includes('estudo')) subcategory = 'estudo';
      else if (lowerTitle.includes('mulher') || lowerTitle.includes('vitoriosa') || lowerTitle.includes('feminina')) subcategory = 'mulher';
      else if (lowerTitle.includes('jovem')) subcategory = 'jovem';
      else if (lowerTitle.includes('infantil') || lowerTitle.includes('criança') || lowerTitle.includes('pequeninos')) subcategory = 'infantil';
      else if (lowerTitle.includes('ilustrada') || lowerTitle.includes('anote')) subcategory = 'ilustrada';
      return { category: 'biblias', subcategory };
    }
    
    // Perfumes
    if (lowerTitle.includes('perfume') || lowerTitle.includes('colônia') || lowerTitle.includes('fragrance')) {
      return { category: 'perfumes', subcategory: 'all' };
    }
    
    // Infantil
    if (lowerTitle.includes('entre cores e versos') || lowerTitle.includes('colorir') || lowerTitle.includes('atividades infantis')) {
      return { category: 'infantil', subcategory: 'atividades' };
    }
    
    // Livros e Devocionais
    if (lowerTitle.includes('devocional') || lowerTitle.includes('próximo nível') || lowerTitle.includes('dias')) {
      return { category: 'livros', subcategory: 'devocional' };
    }
    if (lowerTitle.includes('casamento') || lowerTitle.includes('família')) {
      return { category: 'livros', subcategory: 'casamento' };
    }
    if (lowerTitle.includes('liderança') || lowerTitle.includes('autoridade') || lowerTitle.includes('ministério')) {
      return { category: 'livros', subcategory: 'lideranca' };
    }
    
    // Se não encontrou categoria específica, verificar se é livro
    if (!lowerTitle.includes('revista') && !lowerTitle.includes('bíblia') && !lowerTitle.includes('biblia')) {
      return { category: 'livros', subcategory: 'all' };
    }
    
    return { category: 'outros', subcategory: 'all' };
  };
  
  // Get vendedor info for the logged-in user
  const { vendedor, isLoading: isLoadingVendedor, isRepresentante } = useVendedor();
  const { isGerenteEbd, isAdmin } = useUserRole();
  
  // Check if user is a vendedor
  const isVendedor = !!vendedor;
  
  // Frete manual disponível para vendedor (não representante) e gerente/admin
  const canUseFreteManual = (isVendedor && !isRepresentante) || isGerenteEbd || isAdmin;
  
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
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('ebd_clientes')
        .select(`
          *,
          vendedor:vendedores(id, nome, foto_url)
        `)
        .eq('superintendente_user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Cliente | null;
    },
    enabled: !isVendedor && !isLoadingVendedor && !urlClienteId,
  });
  
  // Buscar descontos por categoria para clientes de representantes
  const { data: descontosCategoria } = useDescontosRepresentante(selectedCliente?.id || null);
  
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

  // Filtrar produtos por categoria, subcategoria e termo de busca
  const filteredProducts = products?.filter(product => {
    const title = product.node.title.toLowerCase();
    const searchLower = searchTerm.toLowerCase().trim();
    
    // Buscar por título OU por SKU
    const variant = product.node.variants.edges[0]?.node;
    const sku = variant?.sku?.toLowerCase() || '';
    const matchesSearch = title.includes(searchLower) || sku.includes(searchLower);
    
    // Se não há categoria selecionada, apenas filtrar por busca
    if (selectedCategory === 'all') {
      return matchesSearch;
    }
    
    // Categorizar o produto
    const productCategory = categorizeProduct(product.node.title);
    
    // Verificar se a categoria corresponde
    if (productCategory.category !== selectedCategory) {
      return false;
    }
    
    // Verificar subcategoria se selecionada
    if (selectedSubcategory !== 'all') {
      if (productCategory.subcategory !== selectedSubcategory) {
        return false;
      }
    }
    
    return matchesSearch;
  }) || [];

  // Obter subcategorias da categoria selecionada
  const currentSubcategories = categories.find(c => c.id === selectedCategory)?.subcategories || [];

  // Contar produtos por categoria
  const countByCategory = (categoryId: string): number => {
    if (categoryId === 'all') return products?.length || 0;
    return products?.filter(p => categorizeProduct(p.node.title).category === categoryId).length || 0;
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);

  // Estado para quantidade por produto (key = product.node.id)
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});

  const handleAddToCart = (product: ShopifyProduct, quantity: number = 1) => {
    const variant = product.node.variants.edges[0]?.node;
    if (!variant) {
      toast.error("Produto sem variante disponível");
      return;
    }

    const cartItem: CartItem = {
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      sku: variant.sku || null,
      price: variant.price,
      quantity: quantity,
      selectedOptions: variant.selectedOptions || []
    };
    
    addItem(cartItem);
    // Limpar quantidade digitada após adicionar
    setProductQuantities(prev => ({ ...prev, [product.node.id]: 1 }));
    toast.success(`${quantity}x ${product.node.title.substring(0, 30)}... adicionado`, { position: "top-center" });
  };

  const handleCheckoutClick = async () => {
    if (items.length === 0) {
      toast.error("Adicione produtos ao carrinho");
      return;
    }

    // Se não é vendedor e não tem cliente cadastrado, fazer checkout direto no Shopify
    if (!isVendedor && !selectedCliente) {
      setIsCreatingDraft(true);
      try {
        // Buscar dados do usuário logado para preencher checkout
        const { data: { user } } = await supabase.auth.getUser();
        let buyerInfo: BuyerInfo | undefined;
        
        if (user) {
          const { data: clienteData } = await supabase
            .from('ebd_clientes')
            .select('*')
            .eq('superintendente_user_id', user.id)
            .maybeSingle();
          
          if (clienteData) {
            buyerInfo = {
              email: clienteData.email_superintendente,
              phone: clienteData.telefone,
              firstName: clienteData.nome_responsavel?.split(' ')[0] || clienteData.nome_igreja,
              lastName: clienteData.nome_responsavel?.split(' ').slice(1).join(' ') || '',
              address: {
                address1: clienteData.endereco_rua ? `${clienteData.endereco_rua}, ${clienteData.endereco_numero || ''}` : null,
                address2: clienteData.endereco_complemento,
                city: clienteData.endereco_cidade,
                province: clienteData.endereco_estado,
                zip: clienteData.endereco_cep,
                country: 'BR',
              }
            };
          }
        }
        
        const checkoutUrl = await createStorefrontCheckout(items, buyerInfo);
        window.open(checkoutUrl, '_blank');
        clearCart();
        setIsCartOpen(false);
        toast.success("Redirecionando para o checkout...");
      } catch (error) {
        console.error('Checkout error:', error);
        toast.error("Erro ao criar checkout. Tente novamente.");
      } finally {
        setIsCreatingDraft(false);
      }
      return;
    }

    // Se tem cliente selecionado (superintendente logado com cadastro), usar seus dados
    if (!isVendedor && selectedCliente) {
      setIsCreatingDraft(true);
      try {
        const buyerInfo: BuyerInfo = {
          email: selectedCliente.email_superintendente,
          phone: selectedCliente.telefone,
          firstName: selectedCliente.nome_responsavel?.split(' ')[0] || selectedCliente.nome_igreja,
          lastName: selectedCliente.nome_responsavel?.split(' ').slice(1).join(' ') || '',
          address: {
            address1: selectedCliente.endereco_rua ? `${selectedCliente.endereco_rua}, ${selectedCliente.endereco_numero || ''}` : null,
            address2: selectedCliente.endereco_complemento,
            city: selectedCliente.endereco_cidade,
            province: selectedCliente.endereco_estado,
            zip: selectedCliente.endereco_cep,
            country: 'BR',
          }
        };
        
        const checkoutUrl = await createStorefrontCheckout(items, buyerInfo);
        window.open(checkoutUrl, '_blank');
        clearCart();
        setIsCartOpen(false);
        toast.success("Redirecionando para o checkout...");
      } catch (error) {
        console.error('Checkout error:', error);
        toast.error("Erro ao criar checkout. Tente novamente.");
      } finally {
        setIsCreatingDraft(false);
      }
      return;
    }

    if (!selectedCliente) {
      toast.error("Selecione um cliente");
      return;
    }

    // Calcular total para verificar desconto escalonado de revendedor
    const valorTotal = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
    
    // Se o cliente logado for REVENDEDOR, aplicar desconto escalonado
    const isRevendedor = selectedCliente.tipo_cliente?.toUpperCase() === 'REVENDEDOR';
    const descontoRevendedor = isRevendedor ? calcularDescontoRevendedor(valorTotal) : { faixa: '', desconto: 0 };

    // Vendedor sempre gera link de proposta
    if (isVendedor) {
      // Check if client can use B2B invoicing for discount options
      // OU se vendedor/gerente pode usar frete manual (mostrar diálogo também)
      if (selectedCliente.pode_faturar || canUseFreteManual) {
        setShowFaturamentoDialog(true);
      } else {
        // Para clientes que não podem faturar, calcular descontos (ADVEC, Representante, Vendedor, etc.)
        const descontoCalculado = calcularDescontosCarrinho(
          items, 
          selectedCliente.tipo_cliente, 
          selectedCliente.onboarding_concluido || false,
          selectedCliente.desconto_faturamento || 0,
          descontosCategoria
        );
        handleGeneratePropostaLink(null, descontoCalculado.descontoPercentual, null, false, descontoCalculado);
      }
    } else {
      // Cliente final - checkout normal
      // Se for REVENDEDOR, aplicar desconto escalonado automaticamente
      if (isRevendedor && descontoRevendedor.desconto > 0) {
        toast.info(`Desconto ${descontoRevendedor.faixa} (${descontoRevendedor.desconto}%) aplicado!`);
        handleCreateDraftOrder(null, descontoRevendedor.desconto, null);
      } else {
        handleCreateDraftOrder(null, 0, null);
      }
    }
  };

  const handleGeneratePropostaLink = async (
    faturamentoPrazos: string[] | null,
    descontoPercent: number = 0,
    frete: { type: string; cost: number } | null = null,
    isFaturamentoB2B: boolean = false,
    descontoCalculado?: { 
      subtotal: number; 
      descontoValor: number; 
      total: number; 
      descontoPercentual: number; 
      tipoDesconto?: string; 
      faixa?: string; 
      itensComDesconto50?: string[];
      itensComDescontoCategoria?: Array<{
        titulo: string;
        categoria: string;
        categoriaLabel: string;
        percentual: number;
        valorOriginal: number;
        valorComDesconto: number;
        descontoValor: number;
      }>;
    },
    freteManual?: FreteManualData
  ) => {
    if (!selectedCliente || !vendedor) {
      toast.error("Dados incompletos");
      return;
    }

    setIsGeneratingProposta(true);

    try {
      // Gerar token único
      const token = crypto.randomUUID();
      
      // Verificar tipo de cliente para aplicar regras específicas
      const shouldAutoCalcAdvec = (selectedCliente.tipo_cliente || "").toLowerCase().includes("advec");
      const isRepresentanteCliente = isClienteRepresentante(selectedCliente.tipo_cliente);

      const calcularTotaisAdvec = () => {
        const subtotal = items.reduce(
          (sum, item) => sum + parseFloat(item.price.amount) * item.quantity,
          0
        );

        const totalComDesconto = items.reduce((sum, item) => {
          const percentual = isProdutoAdvec50(item.product.node.title, item.product.node.id) ? 50 : 40;
          const preco = parseFloat(item.price.amount);
          return sum + preco * item.quantity * (1 - percentual / 100);
        }, 0);

        const descontoValor = subtotal - totalComDesconto;
        const descontoPercentual = subtotal > 0 ? (descontoValor / subtotal) * 100 : 0;

        return {
          subtotal,
          descontoValor,
          total: totalComDesconto,
          descontoPercentual: Math.round(descontoPercentual * 100) / 100,
          tipoDesconto: "advec_50" as const,
        };
      };

      const autoCalcAdvec = !descontoCalculado && shouldAutoCalcAdvec ? calcularTotaisAdvec() : undefined;

      const descontoFinal = descontoCalculado ?? autoCalcAdvec;

      // Calcular valores - SEMPRE usar subtotal original sem desconto
      let valorFrete = frete?.cost || 0;
      
      // Subtotal original (sem desconto) - sempre calculado da mesma forma
      const valorProdutos = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
      
      let valorDesconto: number;
      let valorTotal: number;

      if (descontoFinal) {
        // Usar valor de desconto do cálculo específico (ADVEC, Representante, etc.)
        valorDesconto = descontoFinal.descontoValor;
        valorTotal = valorProdutos - valorDesconto + valorFrete;
      } else {
        // Cálculo tradicional com percentual fixo
        valorDesconto = valorProdutos * (descontoPercent / 100);
        valorTotal = valorProdutos - valorDesconto + valorFrete;
      }

      // Preparar itens para salvar (incluindo desconto por item para ADVEC ou Representante)
      const itensParaSalvar = items.map((item) => {
        // Desconto padrão
        let descontoItem = descontoPercent;

        // Para ADVEC: apenas 2 produtos 50%, o restante 40%
        if (shouldAutoCalcAdvec) {
          descontoItem = isProdutoAdvec50(item.product.node.title, item.product.node.id) ? 50 : 40;
        }
        
        // Para qualquer cliente com descontos por categoria (Representante OU cliente com descontos cadastrados)
        const hasDescontoCategoria = descontoCalculado?.itensComDescontoCategoria && descontoCalculado.itensComDescontoCategoria.length > 0;
        if (hasDescontoCategoria) {
          const itemDesconto = descontoCalculado.itensComDescontoCategoria.find(
            d => d.titulo === item.product.node.title
          );
          if (itemDesconto) {
            descontoItem = itemDesconto.percentual;
          }
        }

        return {
          variantId: item.variantId,
          quantity: item.quantity,
          title: item.product.node.title,
          price: item.price.amount,
          imageUrl: item.product.node.images?.edges?.[0]?.node?.url || null,
          sku: item.sku || null,
          descontoItem,
          // Adicionar categoria para qualquer cliente com descontos por categoria
          ...(hasDescontoCategoria && {
            categoria: descontoCalculado.itensComDescontoCategoria.find(
              d => d.titulo === item.product.node.title
            )?.categoriaLabel
          }),
        };
      });

      // Calcular o percentual de desconto real a salvar
      const descontoPercentualFinal = descontoFinal ? descontoFinal.descontoPercentual : descontoPercent;

      // Preparar endereço - usar o endereço selecionado se existir, senão usar endereço do cliente
      const clienteEndereco = selectedEndereco
        ? {
            rua: selectedEndereco.rua,
            numero: selectedEndereco.numero,
            complemento: selectedEndereco.complemento || "",
            bairro: selectedEndereco.bairro,
            cidade: selectedEndereco.cidade,
            estado: selectedEndereco.estado,
            cep: selectedEndereco.cep,
          }
        : {
            rua: selectedCliente.endereco_rua,
            numero: selectedCliente.endereco_numero,
            complemento: selectedCliente.endereco_complemento || "",
            bairro: selectedCliente.endereco_bairro,
            cidade: selectedCliente.endereco_cidade,
            estado: selectedCliente.endereco_estado,
            cep: selectedCliente.endereco_cep,
          };

      // Salvar proposta no banco
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("vendedor_propostas")
        .insert({
          vendedor_id: vendedor.id,
          vendedor_email: vendedor.email, // Salvar email do vendedor diretamente
          cliente_id: selectedCliente.id,
          cliente_nome: selectedCliente.nome_igreja,
          cliente_cnpj: selectedCliente.cnpj,
          cliente_endereco: clienteEndereco,
          itens: itensParaSalvar,
          valor_produtos: valorProdutos,
          valor_frete: valorFrete,
          valor_total: valorTotal,
          desconto_percentual: descontoPercentualFinal,
          status: "PROPOSTA_PENDENTE",
          token: token,
          metodo_frete: freteManual ? 'manual' : null, // null = cliente escolherá
          pode_faturar: isFaturamentoB2B,
          vendedor_nome: vendedor.nome || null,
          prazos_disponiveis: isFaturamentoB2B && faturamentoPrazos ? faturamentoPrazos : null,
          // Campos de frete manual
          frete_tipo: freteManual ? 'manual' : null, // null = cliente escolherá na proposta
          frete_transportadora: freteManual?.transportadora || null,
          frete_observacao: freteManual?.observacao || null,
          frete_prazo_estimado: freteManual?.prazoEstimado || null,
          frete_definido_por: freteManual ? userData?.user?.id : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Sempre usar domínio oficial de produção
      const baseUrl = 'https://gestaoebd.com.br';
      
      // TODOS os vendedores (incluindo vendedor teste) usam link de proposta
      // O redirecionamento para checkout MP acontece quando o CLIENTE clica "Confirmar Compra"
      // na página da proposta (PropostaDigital.tsx)
      const link = `${baseUrl}/proposta/${token}`;
      
      setPropostaLink(link);
      setPropostaClienteNome(selectedCliente.nome_igreja);
      setShowPropostaLinkDialog(true);
      setLinkCopied(false);
      setMessageCopied(false);
      
      toast.success("Proposta gerada com sucesso!");
      
    } catch (error: any) {
      console.error("Erro ao gerar proposta:", error);
      toast.error("Erro ao gerar proposta: " + error.message);
    } finally {
      setIsGeneratingProposta(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(propostaLink);
      setLinkCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setLinkCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  const handleClosePropostaDialog = () => {
    setShowPropostaLinkDialog(false);
    setPropostaLink("");
    setPropostaClienteNome("");
    setMessageCopied(false);
    clearCart();
    setIsCartOpen(false);
  };

  const handleSelectFaturamento = (prazos: string[], desconto: number, frete: { type: string; cost: number }, freteManual?: FreteManualData) => {
    setFaturamentoConfig({ prazo: prazos[0], desconto, frete, freteManual });
    setShowFaturamentoDialog(false);
    
    // Para QUALQUER cliente com descontos por categoria cadastrados
    let descontoCalculadoFinal = undefined;
    const hasDescontosCadastrados = descontosCategoria && Object.keys(descontosCategoria).length > 0;
    if (selectedCliente && hasDescontosCadastrados) {
      descontoCalculadoFinal = calcularDescontosCarrinho(
        items,
        selectedCliente.tipo_cliente,
        selectedCliente.onboarding_concluido || false,
        selectedCliente.desconto_faturamento || 0,
        descontosCategoria,
        selectedCliente.id,
        selectedCliente.pode_faturar
      );
    }
    
    // Vendedor gera link de proposta com config de faturamento B2B
    handleGeneratePropostaLink(prazos, desconto, frete, true, descontoCalculadoFinal, freteManual);
  };

  const handleSelectPagamentoPadrao = (
    frete?: { type: string; cost: number } | null,
    freteManual?: FreteManualData
  ) => {
    setShowFaturamentoDialog(false);
    // Vendedor gera link de proposta sem faturamento B2B
    // Mas ainda aplica o desconto B2B do cliente, se houver
    const descontoCliente = selectedCliente?.desconto_faturamento || 0;
    
    // Para QUALQUER cliente com descontos por categoria cadastrados
    let descontoCalculadoFinal = undefined;
    const hasDescontosCadastrados = descontosCategoria && Object.keys(descontosCategoria).length > 0;
    if (selectedCliente && hasDescontosCadastrados) {
      descontoCalculadoFinal = calcularDescontosCarrinho(
        items,
        selectedCliente.tipo_cliente,
        selectedCliente.onboarding_concluido || false,
        selectedCliente.desconto_faturamento || 0,
        descontosCategoria,
        selectedCliente.id,
        selectedCliente.pode_faturar
      );
    }
    
    // Se vendedor/gerente definiu frete (manual ou automático), passa para a proposta
    // Senão, cliente escolherá frete na proposta
    handleGeneratePropostaLink(null, descontoCliente, frete || null, false, descontoCalculadoFinal, freteManual);
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
      // Resolver endereço: prioriza selectedEndereco se existir
      const enderecoFinal = selectedEndereco
        ? {
            endereco_rua: selectedEndereco.rua,
            endereco_numero: selectedEndereco.numero,
            endereco_complemento: selectedEndereco.complemento || null,
            endereco_bairro: selectedEndereco.bairro,
            endereco_cidade: selectedEndereco.cidade,
            endereco_estado: selectedEndereco.estado,
            endereco_cep: selectedEndereco.cep,
          }
        : {};

      // Resolver nome do destinatário: usar nome do endereço selecionado se disponível
      const nomeDestinatario = selectedEndereco?.nome
        ? `${selectedEndereco.nome} ${selectedEndereco.sobrenome || ''}`.trim()
        : null;

      const { data, error } = await supabase.functions.invoke('ebd-shopify-order-create', {
        body: {
          cliente: {
            ...selectedCliente,
            ...enderecoFinal, // Sobrescreve com endereço selecionado se existir
            ...(nomeDestinatario && { nome_responsavel: nomeDestinatario }), // Sobrescreve nome se selecionado
            tipo_cliente: selectedCliente.tipo_cliente,
          },
          vendedor_id: vendedor?.id,
          vendedor_nome: vendedor?.nome,
          items: items.map(item => ({
            variantId: item.variantId,
            quantity: item.quantity,
            title: item.product.node.title,
            price: item.price.amount
          })),
          // Para não-faturamento, ainda enviar desconto se for revendedor
          ...(descontoPercent > 0 && !faturamentoPrazo && {
            desconto_percentual: descontoPercent.toString(),
          }),
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
          const detailsStr = parsed.details || '';
          
          // Check for product unavailable errors
          if (detailsStr.includes('no longer available') || detailsStr.includes('not available')) {
            errorMessage = 'Um ou mais produtos no carrinho não estão mais disponíveis. Por favor, remova os itens indisponíveis e tente novamente.';
          } else {
            errorMessage = parsed.error || error.message;
          }
        } catch {
          // Check for product unavailable in plain message
          if (error.message.includes('no longer available') || error.message.includes('não estão mais disponíveis')) {
            errorMessage = 'Um ou mais produtos no carrinho não estão mais disponíveis. Por favor, remova os itens indisponíveis e tente novamente.';
          } else {
            errorMessage = error.message;
          }
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
              {!isVendedor && selectedCliente?.vendedor && (
                <div className="flex items-center gap-2 mt-2 bg-muted/50 rounded-lg px-3 py-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedCliente.vendedor.foto_url || undefined} alt={selectedCliente.vendedor.nome} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">
                    Consultor(a): <span className="font-medium text-foreground">{selectedCliente.vendedor.nome}</span>
                  </span>
                </div>
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
                      {/* Show selected client info - COMPACTO dentro do scroll */}
                      {(urlClienteId || (!isVendedor && selectedCliente)) && selectedCliente && (
                        <div className="mb-3 p-2 bg-muted/50 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Users className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{selectedCliente.nome_igreja}</p>
                              <p className="text-xs text-muted-foreground">CNPJ: {selectedCliente.cnpj}</p>
                            </div>
                          </div>
                          {selectedCliente.pode_faturar && isVendedor && (
                            <Badge variant="secondary" className="ml-2 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0">
                              B2B
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Lista de produtos */}
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div key={item.variantId} className="flex gap-3 p-2 border rounded-lg">
                            <div className="w-12 h-12 bg-secondary/20 rounded-md overflow-hidden flex-shrink-0">
                              {item.product.node.images?.edges?.[0]?.node && (
                                <img
                                  src={item.product.node.images.edges[0].node.url}
                                  alt={item.product.node.title}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm line-clamp-1">{item.product.node.title}</h4>
                              <p className="font-semibold text-sm">
                                R$ {parseFloat(item.price.amount).toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                SKU: {item.sku ? item.sku : "não informado"}
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
                                <CartQuantityField
                                  value={item.quantity}
                                  min={1}
                                  onCommit={(next) => updateQuantity(item.variantId, next)}
                                  className="w-12 h-6 text-center text-sm px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
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

                      {/* Endereço de Entrega - dentro do scroll */}
                      {selectedCliente && (
                        <div className="border-t pt-3 mt-3">
                          <EnderecoEntregaSection
                            clienteId={selectedCliente.id}
                            clienteEndereco={{
                              rua: selectedCliente.endereco_rua,
                              numero: selectedCliente.endereco_numero,
                              complemento: selectedCliente.endereco_complemento,
                              bairro: selectedCliente.endereco_bairro,
                              cidade: selectedCliente.endereco_cidade,
                              estado: selectedCliente.endereco_estado,
                              cep: selectedCliente.endereco_cep
                            }}
                            clienteNome={selectedCliente.nome_igreja}
                            selectedEndereco={selectedEndereco}
                            onEnderecoChange={setSelectedEndereco}
                          />
                        </div>
                      )}

                      {/* Banner de desconto - dentro do scroll */}
                      {selectedCliente && items.length > 0 && (() => {
                        const calculo = calcularDescontosCarrinho(
                          items,
                          selectedCliente.tipo_cliente,
                          selectedCliente.onboarding_concluido || false,
                          selectedCliente.desconto_faturamento || 0,
                          descontosCategoria
                        );
                        return calculo.descontoValor > 0 ? (
                          <div className="mt-3">
                            <DescontoBanner calculo={calculo} />
                          </div>
                        ) : null;
                      })()}
                    </div>
                    
                    {/* FIXO NO RODAPÉ: Apenas Total + Botão */}
                    <div className="flex-shrink-0 space-y-3 pt-3 border-t bg-background">
                      
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">Total</span>
                        <div className="text-right">
                          {selectedCliente && (() => {
                            const calculo = calcularDescontosCarrinho(
                              items,
                              selectedCliente.tipo_cliente,
                              selectedCliente.onboarding_concluido || false,
                              selectedCliente.desconto_faturamento || 0,
                              descontosCategoria
                            );
                            if (calculo.descontoValor > 0) {
                              return (
                                <>
                                  <span className="text-sm text-muted-foreground line-through block">
                                    R$ {calculo.subtotal.toFixed(2)}
                                  </span>
                                  <span className="text-xl font-bold">
                                    R$ {calculo.total.toFixed(2)}
                                  </span>
                                </>
                              );
                            }
                            return (
                              <span className="text-xl font-bold">
                                R$ {totalPrice.toFixed(2)}
                              </span>
                            );
                          })()}
                          {!selectedCliente && (
                            <span className="text-xl font-bold">
                              R$ {totalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                        <Button 
                          onClick={handleCheckoutClick}
                          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black" 
                          size="lg"
                          disabled={items.length === 0 || (isVendedor && !selectedCliente) || isLoadingClientInfo || isCreatingDraft || isGeneratingProposta}
                        >
                          {isGeneratingProposta ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Gerando Proposta...
                            </>
                          ) : isCreatingDraft ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Criando Pedido...
                            </>
                          ) : isLoadingClientInfo ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Carregando...
                            </>
                          ) : isVendedor ? (
                            <>
                              <FileText className="w-4 h-4 mr-2" />
                              Gerar Link de Pedido
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

        {/* Filters Section */}
        <div className="mb-6 space-y-4">
          {/* Search + Category Filters Row */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por nome ou SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 items-center">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedCategory}
                onValueChange={(value) => {
                  setSelectedCategory(value);
                  setSelectedSubcategory('all');
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name} ({countByCategory(cat.id)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Subcategory Filter - Only show if category has subcategories */}
              {currentSubcategories.length > 0 && (
                <Select
                  value={selectedSubcategory}
                  onValueChange={setSelectedSubcategory}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Subcategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentSubcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Clear Filters */}
              {(selectedCategory !== 'all' || searchTerm) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedSubcategory('all');
                    setSearchTerm('');
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {(selectedCategory !== 'all' || selectedSubcategory !== 'all') && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Filtros ativos:</span>
              {selectedCategory !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {categories.find(c => c.id === selectedCategory)?.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => {
                      setSelectedCategory('all');
                      setSelectedSubcategory('all');
                    }}
                  />
                </Badge>
              )}
              {selectedSubcategory !== 'all' && (
                <Badge variant="outline" className="gap-1">
                  {currentSubcategories.find(s => s.id === selectedSubcategory)?.name}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedSubcategory('all')}
                  />
                </Badge>
              )}
              <span className="text-muted-foreground ml-2">
                ({filteredProducts.length} produtos)
              </span>
            </div>
          )}
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
                    <p className="text-xs text-muted-foreground mb-2">
                      SKU: {variant?.sku ? variant.sku : "não informado"}
                    </p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-lg">
                        R$ {parseFloat(price).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={productQuantities[product.node.id] || 1}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setProductQuantities(prev => ({ ...prev, [product.node.id]: Math.max(1, val) }));
                        }}
                        className="w-16 h-8 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={!variant?.availableForSale}
                      />
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleAddToCart(product, productQuantities[product.node.id] || 1)}
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
      {(() => {
        // Calcular desconto para uso no modal e envio ao Bling
        const calculoDescontoModal = selectedCliente 
          ? calcularDescontosCarrinho(
              items,
              selectedCliente.tipo_cliente,
              selectedCliente.onboarding_concluido || false,
              selectedCliente.desconto_faturamento || 0,
              descontosCategoria
            )
          : null;

        const totalComDesconto = calculoDescontoModal?.total ?? totalPrice;
        const descontoPercentual = calculoDescontoModal?.descontoPercentual ?? 0;

        return (
          <FaturamentoSelectionDialog
            open={showFaturamentoDialog}
            onOpenChange={setShowFaturamentoDialog}
            clienteNome={selectedCliente?.nome_igreja || ''}
            clienteCep={selectedCliente?.endereco_cep || null}
            totalProdutos={totalComDesconto}
            items={items.map(item => ({ quantity: item.quantity }))}
            descontoB2B={selectedCliente?.desconto_faturamento || null}
            onSelectFaturamento={handleSelectFaturamento}
            onSelectPagamentoPadrao={handleSelectPagamentoPadrao}
            canUseFreteManual={canUseFreteManual}
            showPagarNaLoja={vendedor?.email?.toLowerCase().includes('glorinha') || false}
            onSelectPagamentoLoja={async (pagamentoData: PagamentoLojaData) => {
              if (!selectedCliente) return;
              setShowFaturamentoDialog(false);
              setIsCreatingDraft(true);
              try {
                // Criar pedido direto no Bling via edge function com valores COM DESCONTO
                const { data, error } = await supabase.functions.invoke('bling-create-order', {
                  body: {
                    contato: { id: selectedCliente.id },
                    cliente: {
                      id: selectedCliente.id,
                      nome: selectedCliente.nome_igreja,
                      cpf_cnpj: selectedCliente.cnpj || selectedCliente.cpf,
                      email: selectedCliente.email_superintendente,
                      telefone: selectedCliente.telefone,
                    },
                    endereco_entrega: {
                      rua: selectedCliente.endereco_rua,
                      numero: selectedCliente.endereco_numero,
                      complemento: selectedCliente.endereco_complemento,
                      bairro: selectedCliente.endereco_bairro,
                      cidade: selectedCliente.endereco_cidade,
                      estado: selectedCliente.endereco_estado,
                      cep: selectedCliente.endereco_cep,
                    },
                    itens: items.map(item => {
                      const precoOriginal = parseFloat(item.price.amount);
                      const precoComDesconto = descontoPercentual > 0 
                        ? precoOriginal * (1 - descontoPercentual / 100)
                        : precoOriginal;
                      return {
                        sku: item.sku || item.product.node.variants.edges[0]?.node.sku || '',
                        nome: item.product.node.title,
                        quantidade: item.quantity,
                        valor: precoComDesconto,
                        preco_cheio: precoOriginal,
                      };
                    }),
                    valor_produtos: totalComDesconto,
                    valor_total: totalComDesconto,
                    valor_frete: 0,
                    desconto_percentual: descontoPercentual,
                    metodo_frete: 'retirada_penha',
                    forma_pagamento: 'pagamento_loja',
                    forma_pagamento_loja: pagamentoData.formaPagamento,
                    bandeira_cartao: pagamentoData.bandeiraCartao,
                    parcelas_cartao: pagamentoData.parcelasCartao,
                    deposito_origem: pagamentoData.depositoOrigem,
                    vendedor_email: vendedor?.email,
                  }
                });
                if (error) throw error;
                
                // CRIAR REGISTRO EM vendas_balcao para aparecer em Notas Emitidas
                if (data?.bling_order_id && vendedor?.id) {
                  const poloMap: Record<string, string> = {
                    'local': 'penha',
                    'matriz': 'matriz',
                    'pernambuco': 'pernambuco'
                  };
                  
                  await supabase.from('vendas_balcao').insert({
                    vendedor_id: vendedor.id,
                    polo: poloMap[pagamentoData.depositoOrigem] || 'penha',
                    bling_order_id: data.bling_order_id,
                    cliente_nome: selectedCliente.nome_igreja,
                    cliente_cpf: selectedCliente.cnpj || selectedCliente.cpf || null,
                    cliente_telefone: selectedCliente.telefone || null,
                    valor_total: totalComDesconto,
                    forma_pagamento: pagamentoData.formaPagamento,
                    status: 'finalizada',
                    status_nfe: 'CRIADA', // Marca como pronta para gerar NF-e
                  });
                }
                
                // Mostrar diálogo de venda concluída com opção de gerar NF-e
                // Apenas para vendas com material saindo do depósito Penha (local)
                if (pagamentoData.depositoOrigem === 'local') {
                  setVendaConcluida({
                    clienteNome: selectedCliente.nome_igreja,
                    blingOrderId: data?.bling_order_id || null,
                    blingOrderNumber: data?.bling_order_number || null,
                  });
                  setShowVendaConcluidaDialog(true);
                } else {
                  // Matriz ou PE: apenas toast de sucesso, fluxo normal
                  toast.success('Pedido criado com sucesso!', {
                    description: `Pedido #${data?.bling_order_number || data?.bling_order_id} registrado no Bling`
                  });
                }
                clearCart();
                setIsCartOpen(false);
              } catch (err: any) {
                console.error('Erro ao criar pedido:', err);
                toast.error('Erro ao criar pedido', { description: err.message });
              } finally {
                setIsCreatingDraft(false);
              }
            }}
          />
        );
      })()}

      {/* Venda Concluída Dialog - para Pagar na Loja */}
      {vendaConcluida && (
        <VendaConcluidaDialog
          open={showVendaConcluidaDialog}
          onOpenChange={setShowVendaConcluidaDialog}
          clienteNome={vendaConcluida.clienteNome}
          blingOrderId={vendaConcluida.blingOrderId}
          blingOrderNumber={vendaConcluida.blingOrderNumber}
          onClose={() => {
            setVendaConcluida(null);
            setShowVendaConcluidaDialog(false);
          }}
        />
      )}

      {/* Proposta Link Dialog */}
      <Dialog open={showPropostaLinkDialog} onOpenChange={setShowPropostaLinkDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Proposta Gerada com Sucesso!
            </DialogTitle>
            <DialogDescription>
              Copie a mensagem abaixo e envie ao cliente para que ele confirme a compra.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Standard Message Template */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-blue-800">Mensagem padrão para enviar ao cliente:</p>
              <div className="bg-white rounded border p-3 text-sm text-muted-foreground whitespace-pre-line">
{`Prezado(a) ${propostaClienteNome || '[Nome do Cliente]'},

Segue a Proposta Digital de Pedido que preparamos especialmente para você.

Por favor, clique no link abaixo para conferir todos os detalhes do pedido, incluindo produtos, quantidades, formas de entrega e condições de pagamento:

${propostaLink}

Após conferir todas as informações, clique no botão "CONFIRMAR COMPRA". Você será redirecionado automaticamente para a página de pagamento seguro, onde poderá finalizar sua compra.

Qualquer dúvida, estou à disposição!

Atenciosamente,
${vendedor?.nome || '[Nome do Vendedor]'}`}
              </div>
              <Button
                variant={messageCopied ? "default" : "secondary"}
                size="sm"
                className={messageCopied ? "bg-green-600 hover:bg-green-700 w-full" : "w-full"}
                onClick={async () => {
                  const message = `Prezado(a) ${propostaClienteNome || '[Nome do Cliente]'},

Segue a Proposta Digital de Pedido que preparamos especialmente para você.

Por favor, clique no link abaixo para conferir todos os detalhes do pedido, incluindo produtos, quantidades, formas de entrega e condições de pagamento:

${propostaLink}

Após conferir todas as informações, clique no botão "CONFIRMAR COMPRA". Você será redirecionado automaticamente para a página de pagamento seguro, onde poderá finalizar sua compra.

Qualquer dúvida, estou à disposição!

Atenciosamente,
${vendedor?.nome || '[Nome do Vendedor]'}`;
                  await navigator.clipboard.writeText(message);
                  setMessageCopied(true);
                  toast.success("Mensagem copiada!");
                  setTimeout(() => setMessageCopied(false), 3000);
                }}
              >
                {messageCopied ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mensagem Copiada!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Mensagem Completa
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <div className="flex justify-center">
            <Button variant="outline" onClick={handleClosePropostaDialog}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
