import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Scale, Plus, Minus, Trash2, Search, Package, Truck, 
  MapPin, Copy, Save, Clock, CheckCircle2, CheckCircle,
  Building2, User, Percent, Rocket, Pencil, RefreshCw
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useVendedor } from "@/hooks/useVendedor";
import { calcularDescontosLocal, type ItemCalculadora, type DescontosCategoriaRepresentante } from "@/lib/descontosCalculadora";
import { ENDERECO_MATRIZ, formatarEnderecoMatriz } from "@/constants/enderecoMatriz";
import { AdicionarFreteOrcamentoDialog } from "@/components/vendedor/AdicionarFreteOrcamentoDialog";
import { EditarPropostaDialog } from "@/components/vendedor/EditarPropostaDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { fetchShopifyProducts, ShopifyProduct } from "@/lib/shopify";

interface ItemCarrinho {
  product: ShopifyProduct;
  variantId: string;
  sku: string | null;
  quantity: number;
  price: { amount: string; currencyCode: string };
  weightKg: number;
}

interface Cliente {
  id: string;
  nome_igreja: string;
  tipo_cliente: string | null;
  onboarding_concluido: boolean | null;
  desconto_faturamento: number | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  endereco_cep: string | null;
  cnpj: string | null;
}

interface OrcamentoFrete {
  id: string;
  cliente_id: string;
  cliente?: { nome_igreja: string };
  peso_total_kg: number;
  valor_produtos: number;
  desconto_percentual: number;
  valor_com_desconto: number;
  itens: any;
  endereco_entrega: any;
  status: string;
  transportadora_nome: string | null;
  valor_frete: number | null;
  prazo_entrega: string | null;
  observacoes: string | null;
  proposta_id: string | null;
  created_at: string;
}

// Helper para converter peso para kg
function convertToKg(weight: number | null, unit: string | null): number {
  if (!weight) return 0;
  switch (unit) {
    case 'GRAMS':
      return weight / 1000;
    case 'OUNCES':
      return weight * 0.0283495;
    case 'POUNDS':
      return weight * 0.453592;
    case 'KILOGRAMS':
    default:
      return weight;
  }
}

export default function VendedorCalculadoraPeso() {
  const { vendedor } = useVendedor();
  const [searchTerm, setSearchTerm] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<string>("");
  const [activeTab, setActiveTab] = useState("novo");
  
  // Estados para modais
  const [freteDialogOpen, setFreteDialogOpen] = useState(false);
  const [orcamentoParaFrete, setOrcamentoParaFrete] = useState<OrcamentoFrete | null>(null);
  const [propostaLinkDialogOpen, setPropostaLinkDialogOpen] = useState(false);
  const [propostaLink, setPropostaLink] = useState("");
  const [propostaClienteNome, setPropostaClienteNome] = useState("");
  const [creatingProposta, setCreatingProposta] = useState<string | null>(null);
  const [messageCopied, setMessageCopied] = useState(false);
  const [deletingOrcamento, setDeletingOrcamento] = useState<string | null>(null);
  
  // Estados para editar proposta
  const [editarPropostaDialogOpen, setEditarPropostaDialogOpen] = useState(false);
  const [propostaParaEditar, setPropostaParaEditar] = useState<any>(null);

  // Buscar clientes do vendedor
  const { data: clientes } = useQuery({
    queryKey: ["clientes-vendedor", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, tipo_cliente, onboarding_concluido, desconto_faturamento, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, cnpj")
        .eq("vendedor_id", vendedor.id)
        .order("nome_igreja");
      if (error) throw error;
      return data as Cliente[];
    },
    enabled: !!vendedor?.id,
  });

  // Buscar descontos por categoria do cliente (para representantes)
  const { data: descontosCategoria } = useQuery({
    queryKey: ["descontos-categoria", clienteSelecionado],
    queryFn: async () => {
      if (!clienteSelecionado) return {};
      const { data, error } = await supabase
        .from("ebd_descontos_categoria_representante")
        .select("categoria, percentual_desconto")
        .eq("cliente_id", clienteSelecionado);
      if (error) throw error;
      const map: DescontosCategoriaRepresentante = {};
      data?.forEach(d => { map[d.categoria] = d.percentual_desconto; });
      return map;
    },
    enabled: !!clienteSelecionado,
  });

  // Buscar orçamentos salvos
  const { data: orcamentosSalvos, refetch: refetchOrcamentos } = useQuery({
    queryKey: ["orcamentos-frete", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];
      const { data, error } = await supabase
        .from("vendedor_orcamentos_frete")
        .select("id, cliente_id, peso_total_kg, valor_produtos, desconto_percentual, valor_com_desconto, itens, endereco_entrega, status, transportadora_nome, valor_frete, prazo_entrega, observacoes, proposta_id, created_at")
        .eq("vendedor_id", vendedor.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Buscar nomes dos clientes
      const clienteIds = [...new Set(data.map(o => o.cliente_id))];
      const { data: clientesData } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja")
        .in("id", clienteIds);
      
      const clienteMap = new Map(clientesData?.map(c => [c.id, c.nome_igreja]) || []);
      
      return data.map(o => ({
        ...o,
        cliente: { nome_igreja: clienteMap.get(o.cliente_id) || "Cliente" }
      })) as OrcamentoFrete[];
    },
    enabled: !!vendedor?.id,
  });

  // Buscar produtos Shopify
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ["produtos-shopify-calculadora"],
    queryFn: () => fetchShopifyProducts(500),
  });

  // Cliente selecionado
  const cliente = useMemo(() => 
    clientes?.find(c => c.id === clienteSelecionado), 
    [clientes, clienteSelecionado]
  );

  // Filtrar produtos
  const produtosFiltrados = useMemo(() => {
    if (!produtos) return [];
    if (!searchTerm.trim()) return produtos;
    const termo = searchTerm.toLowerCase();
    return produtos.filter(p => {
      const variant = p.node.variants?.edges?.[0]?.node;
      const sku = variant?.sku?.toLowerCase() || '';
      return p.node.title.toLowerCase().includes(termo) || sku.includes(termo);
    });
  }, [produtos, searchTerm]);

  // Converter carrinho para ItemCalculadora
  const itensCalculadora: ItemCalculadora[] = useMemo(() => 
    carrinho.map(item => ({
      id: item.variantId,
      titulo: item.product.node.title,
      peso_bruto: item.weightKg,
      preco_cheio: parseFloat(item.price.amount),
      categoria: null, // Shopify não tem categoria igual ao ebd_revistas
      quantidade: item.quantity
    })),
    [carrinho]
  );

  // Calcular totais com descontos
  const calculo = useMemo(() => {
    const pesoTotal = carrinho.reduce((acc, item) => 
      acc + (item.weightKg * item.quantity), 0
    );
    const quantidadeTotal = carrinho.reduce((acc, item) => 
      acc + item.quantity, 0
    );

    const desconto = calcularDescontosLocal(
      itensCalculadora,
      cliente?.tipo_cliente,
      cliente?.onboarding_concluido || false,
      cliente?.desconto_faturamento || 0,
      descontosCategoria
    );

    return { 
      pesoTotal, 
      quantidadeTotal,
      ...desconto
    };
  }, [carrinho, cliente, descontosCategoria, itensCalculadora]);

  // Endereço de entrega formatado
  const enderecoEntrega = useMemo(() => {
    if (!cliente?.endereco_rua) return null;
    return {
      completo: `${cliente.endereco_rua}, ${cliente.endereco_numero || 's/n'}
${cliente.endereco_bairro || ''} - ${cliente.endereco_cidade || ''}/${cliente.endereco_estado || ''}
CEP: ${cliente.endereco_cep || ''}`,
      linha: `${cliente.endereco_rua}, ${cliente.endereco_numero || 's/n'} - ${cliente.endereco_bairro || ''}, ${cliente.endereco_cidade || ''}/${cliente.endereco_estado || ''}`
    };
  }, [cliente]);

  // Mensagem para transportadora
  const mensagemTransportadora = useMemo(() => {
    if (!cliente || carrinho.length === 0) return "";

    const pesoKg = calculo.pesoTotal < 1 
      ? `${(calculo.pesoTotal * 1000).toFixed(0)}g`
      : `${calculo.pesoTotal.toFixed(2)} kg`;

    return `📦 *Orçamento de Frete*
━━━━━━━━━━━━━━━━━━
*Peso Total:* ${pesoKg}
*Valor NF:* R$ ${calculo.total.toFixed(2).replace('.', ',')}
*Itens:* ${calculo.quantidadeTotal} unidade(s)

📍 *COLETA:*
${formatarEnderecoMatriz()}

📍 *ENTREGA:*
${cliente.nome_igreja}
${enderecoEntrega?.completo || 'Endereço não cadastrado'}
━━━━━━━━━━━━━━━━━━`;
  }, [cliente, carrinho, calculo, enderecoEntrega]);

  // Handlers
  const adicionarProduto = useCallback((product: ShopifyProduct) => {
    const variant = product.node.variants?.edges?.[0]?.node;
    if (!variant) return;
    
    const weightKg = convertToKg(variant.weight, variant.weightUnit);
    
    setCarrinho(prev => {
      const existe = prev.find(item => item.variantId === variant.id);
      if (existe) {
        return prev.map(item => 
          item.variantId === variant.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { 
        product, 
        variantId: variant.id,
        sku: variant.sku,
        quantity: 1,
        price: variant.price,
        weightKg
      }];
    });
  }, []);

  const alterarQuantidade = useCallback((variantId: string, delta: number) => {
    setCarrinho(prev => 
      prev.map(item => {
        if (item.variantId === variantId) {
          const novaQtd = item.quantity + delta;
          return novaQtd > 0 ? { ...item, quantity: novaQtd } : item;
        }
        return item;
      }).filter(item => item.quantity > 0)
    );
  }, []);

  const removerProduto = useCallback((variantId: string) => {
    setCarrinho(prev => prev.filter(item => item.variantId !== variantId));
  }, []);

  const limparCarrinho = useCallback(() => {
    setCarrinho([]);
  }, []);

  const copiarMensagem = useCallback(() => {
    navigator.clipboard.writeText(mensagemTransportadora);
    toast.success("Mensagem copiada!");
  }, [mensagemTransportadora]);

  const abrirWhatsApp = useCallback(() => {
    const texto = encodeURIComponent(mensagemTransportadora);
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  }, [mensagemTransportadora]);

  const salvarOrcamento = useCallback(async () => {
    if (!vendedor?.id || !clienteSelecionado || carrinho.length === 0) {
      toast.error("Selecione um cliente e adicione produtos");
      return;
    }

    // Salvar itens no formato compatível com PropostaDigital
    const itens = carrinho.map(item => ({
      variantId: item.variantId,
      title: item.product.node.title,
      quantity: item.quantity,
      price: item.price.amount,
      sku: item.sku,
      imageUrl: item.product.node.images?.edges?.[0]?.node?.url || null,
      peso_kg: item.weightKg
    }));

    const enderecoColeta = {
      rua: ENDERECO_MATRIZ.rua,
      numero: ENDERECO_MATRIZ.numero,
      bairro: ENDERECO_MATRIZ.bairro,
      cidade: ENDERECO_MATRIZ.cidade,
      estado: ENDERECO_MATRIZ.estado,
      cep: ENDERECO_MATRIZ.cep
    };

    const enderecoEntregaData = {
      rua: cliente?.endereco_rua || "",
      numero: cliente?.endereco_numero || "",
      bairro: cliente?.endereco_bairro || "",
      cidade: cliente?.endereco_cidade || "",
      estado: cliente?.endereco_estado || "",
      cep: cliente?.endereco_cep || ""
    };

    const { error } = await supabase
      .from("vendedor_orcamentos_frete")
      .insert({
        vendedor_id: vendedor.id,
        cliente_id: clienteSelecionado,
        itens,
        peso_total_kg: calculo.pesoTotal,
        valor_produtos: calculo.subtotal,
        desconto_percentual: calculo.descontoPercentual,
        valor_com_desconto: calculo.total,
        endereco_coleta: enderecoColeta,
        endereco_entrega: enderecoEntregaData,
        status: "aguardando_orcamento"
      });

    if (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar orçamento");
      return;
    }

    toast.success("Orçamento salvo com sucesso!");
    limparCarrinho();
    setClienteSelecionado("");
    refetchOrcamentos();
    setActiveTab("salvos");
  }, [vendedor, clienteSelecionado, carrinho, calculo, cliente, limparCarrinho, refetchOrcamentos]);

  // Abrir modal de adicionar frete
  const handleAbrirFreteDialog = useCallback((orcamento: OrcamentoFrete) => {
    setOrcamentoParaFrete(orcamento);
    setFreteDialogOpen(true);
  }, []);

  // Excluir orçamento
  const handleExcluirOrcamento = useCallback(async (orcamentoId: string) => {
    if (deletingOrcamento) return;
    
    setDeletingOrcamento(orcamentoId);
    
    try {
      const { error } = await supabase
        .from("vendedor_orcamentos_frete")
        .delete()
        .eq("id", orcamentoId);
      
      if (error) throw error;
      
      toast.success("Orçamento excluído!");
      refetchOrcamentos();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir orçamento");
    } finally {
      setDeletingOrcamento(null);
    }
  }, [deletingOrcamento, refetchOrcamentos]);

  // Criar proposta a partir do orçamento
  const handleCriarProposta = useCallback(async (orcamento: OrcamentoFrete) => {
    if (!vendedor) return;
    
    // TRAVA 1: Se já está criando alguma proposta, ignorar
    if (creatingProposta) return;
    
    // TRAVA 2: Se este orçamento já foi convertido em proposta, ignorar
    if (orcamento.proposta_id) {
      toast.warning("Este orçamento já foi convertido em proposta!");
      return;
    }
    
    setCreatingProposta(orcamento.id);
    
    try {
      // TRAVA 3: Verificar novamente no banco se já existe proposta
      const { data: orcamentoAtual } = await supabase
        .from("vendedor_orcamentos_frete")
        .select("proposta_id, status")
        .eq("id", orcamento.id)
        .single();
      
      if (orcamentoAtual?.proposta_id || orcamentoAtual?.status === 'convertido_proposta') {
        toast.warning("Este orçamento já foi convertido em proposta!");
        refetchOrcamentos();
        return;
      }
      // Buscar dados do cliente
      const { data: clienteData } = await supabase
        .from("ebd_clientes")
        .select("nome_igreja, cnpj, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep")
        .eq("id", orcamento.cliente_id)
        .single();
      
      if (!clienteData) throw new Error("Cliente não encontrado");
      
      const token = crypto.randomUUID();
      const valorTotal = orcamento.valor_com_desconto + (orcamento.valor_frete || 0);
      
      const clienteEndereco = {
        rua: clienteData.endereco_rua || "",
        numero: clienteData.endereco_numero || "",
        bairro: clienteData.endereco_bairro || "",
        cidade: clienteData.endereco_cidade || "",
        estado: clienteData.endereco_estado || "",
        cep: clienteData.endereco_cep || ""
      };
      
      // Criar proposta
      const { data: proposta, error: propostaError } = await supabase
        .from("vendedor_propostas")
        .insert({
          vendedor_id: vendedor.id,
          vendedor_nome: vendedor.nome || null,
          cliente_id: orcamento.cliente_id,
          cliente_nome: clienteData.nome_igreja,
          cliente_cnpj: clienteData.cnpj,
          cliente_endereco: clienteEndereco,
          itens: orcamento.itens,
          valor_produtos: orcamento.valor_com_desconto,
          valor_frete: orcamento.valor_frete || 0,
          valor_total: valorTotal,
          desconto_percentual: orcamento.desconto_percentual,
          status: "PROPOSTA_PENDENTE",
          token,
          frete_tipo: "manual",
          frete_transportadora: orcamento.transportadora_nome,
          frete_prazo_estimado: orcamento.prazo_entrega,
          frete_observacao: orcamento.observacoes,
        })
        .select("id")
        .single();
      
      if (propostaError) throw propostaError;
      
      // Atualizar orçamento com status e proposta_id
      const { error: updateError } = await supabase
        .from("vendedor_orcamentos_frete")
        .update({
          status: "convertido_proposta",
          proposta_id: proposta.id
        })
        .eq("id", orcamento.id);
      
      if (updateError) throw updateError;
      
      const link = `https://gestaoebd.com.br/proposta/${token}`;
      setPropostaLink(link);
      setPropostaClienteNome(clienteData.nome_igreja);
      setPropostaLinkDialogOpen(true);
      refetchOrcamentos();
      
    } catch (error) {
      console.error("Erro ao criar proposta:", error);
      toast.error("Erro ao criar proposta");
    } finally {
      setCreatingProposta(null);
    }
  }, [vendedor, creatingProposta, refetchOrcamentos]);

  const copiarMensagemCompleta = useCallback(async () => {
    const mensagem = `Prezado(a) ${propostaClienteNome || '[Nome do Cliente]'},

Segue a Proposta Digital de Pedido que preparamos especialmente para você.

Por favor, clique no link abaixo para conferir todos os detalhes do pedido, incluindo produtos, quantidades, formas de entrega e condições de pagamento:

${propostaLink}

Após conferir todas as informações, clique no botão "CONFIRMAR COMPRA". Você será redirecionado automaticamente para a página de pagamento seguro, onde poderá finalizar sua compra.

Qualquer dúvida, estou à disposição!

Atenciosamente,
${vendedor?.nome || '[Nome do Vendedor]'}`;

    await navigator.clipboard.writeText(mensagem);
    setMessageCopied(true);
    toast.success("Mensagem copiada!");
    setTimeout(() => setMessageCopied(false), 3000);
  }, [propostaLink, propostaClienteNome, vendedor?.nome]);

  // Abrir dialog de editar proposta
  const handleEditarProposta = useCallback(async (orcamento: OrcamentoFrete) => {
    if (!orcamento.proposta_id) {
      toast.error("Proposta não encontrada");
      return;
    }
    
    const { data, error } = await supabase
      .from("vendedor_propostas")
      .select("*")
      .eq("id", orcamento.proposta_id)
      .single();
    
    if (error || !data) {
      toast.error("Erro ao carregar proposta");
      return;
    }
    
    setPropostaParaEditar(data);
    setEditarPropostaDialogOpen(true);
  }, []);

  // Aproveitar produtos de um orçamento calculado para novo orçamento
  const handleAproveitarProdutos = useCallback((orcamento: OrcamentoFrete) => {
    // Preencher cliente
    setClienteSelecionado(orcamento.cliente_id);
    
    // Converter itens do orçamento para o formato do carrinho
    const itensOrcamento = orcamento.itens || [];
    const novosItensCarrinho: ItemCarrinho[] = [];
    
    itensOrcamento.forEach((item: any) => {
      // Buscar o produto na lista de produtos carregados
      const produtoEncontrado = produtos?.find(p => 
        p.node.variants?.edges?.some(v => v.node.id === item.variantId)
      );
      
      if (produtoEncontrado) {
        const variant = produtoEncontrado.node.variants?.edges?.find(v => v.node.id === item.variantId)?.node;
        if (variant) {
          novosItensCarrinho.push({
            product: produtoEncontrado,
            variantId: item.variantId,
            sku: item.sku || null,
            quantity: item.quantity,
            price: variant.price,
            weightKg: item.peso_kg || 0
          });
        }
      }
    });
    
    setCarrinho(novosItensCarrinho);
    
    // Mudar para aba "novo" para novo cálculo
    setActiveTab("novo");
    
    toast.info("Produtos carregados! Ajuste e calcule um novo orçamento.");
  }, [produtos]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="h-6 w-6" />
          Orçamento Transportadora
        </h1>
        <p className="text-muted-foreground">
          Monte o pedido, calcule o valor com desconto e gere orçamento para transportadoras
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="novo" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Novo Orçamento
          </TabsTrigger>
          <TabsTrigger value="salvos" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Salvos
            {orcamentosSalvos && orcamentosSalvos.length > 0 && (
              <Badge variant="secondary" className="ml-1">{orcamentosSalvos.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="novo" className="space-y-6 mt-4">
          {/* Seleção de Cliente */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={clienteSelecionado} onValueChange={setClienteSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.nome_igreja}
                        {c.tipo_cliente && (
                          <Badge variant="outline" className="text-xs">{c.tipo_cliente}</Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {cliente && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{cliente.nome_igreja}</p>
                      <p className="text-sm text-muted-foreground">Tipo: {cliente.tipo_cliente || "Não definido"}</p>
                    </div>
                    {calculo.faixa && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                        <Percent className="h-3 w-3 mr-1" />
                        {calculo.faixa}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista de produtos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Produtos</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por título ou SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {loadingProdutos ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Carregando produtos...
                    </div>
                  ) : produtosFiltrados.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "Nenhum produto encontrado" : "Nenhum produto disponível"}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {produtosFiltrados.map((product) => {
                        const variant = product.node.variants?.edges?.[0]?.node;
                        const weightKg = convertToKg(variant?.weight, variant?.weightUnit);
                        const imageUrl = product.node.images?.edges?.[0]?.node?.url;
                        
                        return (
                          <div
                            key={product.node.id}
                            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                            onClick={() => adicionarProduto(product)}
                          >
                            {imageUrl && (
                              <img 
                                src={imageUrl} 
                                alt={product.node.title}
                                className="w-12 h-12 object-cover rounded"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{product.node.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {variant?.sku && (
                                  <Badge variant="secondary" className="text-xs">
                                    SKU: {variant.sku}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {weightKg < 1 
                                    ? `${(weightKg * 1000).toFixed(0)}g`
                                    : `${weightKg.toFixed(2)}kg`
                                  }
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  R$ {parseFloat(variant?.price?.amount || "0").toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Carrinho e Resumo */}
            <div className="space-y-4">
              {/* Resumo */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">
                        {calculo.pesoTotal < 1 
                          ? `${(calculo.pesoTotal * 1000).toFixed(0)}g`
                          : `${calculo.pesoTotal.toFixed(2)}kg`
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">Peso Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {calculo.quantidadeTotal}
                      </p>
                      <p className="text-sm text-muted-foreground">Itens</p>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>R$ {calculo.subtotal.toFixed(2)}</span>
                    </div>
                    {calculo.descontoValor > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Desconto ({calculo.descontoPercentual.toFixed(0)}%):</span>
                        <span>- R$ {calculo.descontoValor.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Valor NF:</span>
                      <span className="text-green-600">R$ {calculo.total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Itens do pedido */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Itens ({calculo.quantidadeTotal})
                  </CardTitle>
                  {carrinho.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={limparCarrinho} className="text-destructive hover:text-destructive">
                      Limpar
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {carrinho.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Scale className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p>Clique nos produtos para adicionar</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {carrinho.map((item) => {
                          const imageUrl = item.product.node.images?.edges?.[0]?.node?.url;
                          return (
                            <div key={item.variantId} className="flex items-center gap-2 p-2 rounded-lg border text-sm">
                              {imageUrl && (
                                <img 
                                  src={imageUrl} 
                                  alt={item.product.node.title}
                                  className="w-10 h-10 object-cover rounded"
                                />
                              )}
                              <div className="flex-1 min-w-0 mr-2">
                                <p className="font-medium truncate">{item.product.node.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.weightKg < 1 
                                    ? `${(item.weightKg * 1000).toFixed(0)}g`
                                    : `${item.weightKg.toFixed(2)}kg`
                                  } × {item.quantity}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => alterarQuantidade(item.variantId, -1)}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-6 text-center text-xs">{item.quantity}</span>
                                <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => alterarQuantidade(item.variantId, 1)}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removerProduto(item.variantId)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Endereços */}
          {cliente && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    COLETA (Matriz)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-line">{formatarEnderecoMatriz()}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    ENTREGA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {enderecoEntrega ? (
                    <p className="text-sm whitespace-pre-line">{enderecoEntrega.completo}</p>
                  ) : (
                    <p className="text-sm text-orange-500">⚠️ Endereço não cadastrado</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Mensagem para transportadora */}
          {cliente && carrinho.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Mensagem para Transportadora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm whitespace-pre-line mb-4">
                  {mensagemTransportadora}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={copiarMensagem} className="flex-1 sm:flex-none">
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                  <Button onClick={salvarOrcamento} className="flex-1 sm:flex-none">
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Orçamento
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="salvos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Orçamentos Salvos</CardTitle>
            </CardHeader>
            <CardContent>
              {!orcamentosSalvos || orcamentosSalvos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum orçamento salvo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orcamentosSalvos.map((orc) => (
                    <div key={orc.id} className="flex items-center justify-between p-4 rounded-lg border gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{orc.cliente?.nome_igreja}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <span>{orc.peso_total_kg.toFixed(2)}kg</span>
                          <span>•</span>
                          <span>R$ {orc.valor_com_desconto.toFixed(2)}</span>
                          {orc.status === 'orcamento_recebido' && orc.valor_frete && (
                            <>
                              <span>•</span>
                              <span className="text-green-600">Frete: R$ {orc.valor_frete.toFixed(2)}</span>
                              {orc.transportadora_nome && (
                                <span className="text-xs">({orc.transportadora_nome})</span>
                              )}
                            </>
                          )}
                          <span>•</span>
                          <span>{new Date(orc.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {orc.status === 'aguardando_orcamento' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAbrirFreteDialog(orc)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Frete
                          </Button>
                        )}
                        
                        {orc.status === 'orcamento_recebido' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAproveitarProdutos(orc)}
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Aproveitar Produtos
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleCriarProposta(orc)}
                              disabled={creatingProposta === orc.id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {creatingProposta === orc.id ? (
                                "Criando..."
                              ) : (
                                <>
                                  <Rocket className="h-4 w-4 mr-1" />
                                  Criar Proposta
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                        
                        {orc.status === 'convertido_proposta' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditarProposta(orc)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar Proposta
                          </Button>
                        )}
                        
                        {/* Botão excluir */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleExcluirOrcamento(orc.id)}
                          disabled={deletingOrcamento === orc.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Adicionar Frete */}
      <AdicionarFreteOrcamentoDialog
        open={freteDialogOpen}
        onOpenChange={setFreteDialogOpen}
        orcamento={orcamentoParaFrete}
        onSuccess={refetchOrcamentos}
      />

      {/* Modal de Link da Proposta - Mensagem Padrão */}
      <Dialog open={propostaLinkDialogOpen} onOpenChange={setPropostaLinkDialogOpen}>
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
                onClick={copiarMensagemCompleta}
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
            <Button variant="outline" onClick={() => setPropostaLinkDialogOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Editar Proposta */}
      <EditarPropostaDialog
        open={editarPropostaDialogOpen}
        onOpenChange={setEditarPropostaDialogOpen}
        proposta={propostaParaEditar}
        onSuccess={refetchOrcamentos}
      />
    </div>
  );
}
