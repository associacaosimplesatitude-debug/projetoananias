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
  MapPin, Copy, MessageCircle, Save, Clock, CheckCircle2, 
  Building2, User, Percent
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useVendedor } from "@/hooks/useVendedor";
import { calcularDescontosLocal, type ItemCalculadora, type DescontosCategoriaRepresentante } from "@/lib/descontosCalculadora";
import { ENDERECO_MATRIZ, formatarEnderecoMatriz } from "@/constants/enderecoMatriz";

interface Produto {
  id: string;
  titulo: string;
  peso_bruto: number;
  preco_cheio: number;
  categoria: string | null;
  imagem_url: string | null;
}

interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
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
}

interface OrcamentoFrete {
  id: string;
  cliente_id: string;
  cliente?: { nome_igreja: string };
  peso_total_kg: number;
  valor_com_desconto: number;
  status: string;
  transportadora_nome: string | null;
  valor_frete: number | null;
  created_at: string;
}

export default function VendedorCalculadoraPeso() {
  const { vendedor } = useVendedor();
  const [searchTerm, setSearchTerm] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<string>("");
  const [activeTab, setActiveTab] = useState("novo");

  // Buscar clientes do vendedor
  const { data: clientes } = useQuery({
    queryKey: ["clientes-vendedor", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, tipo_cliente, onboarding_concluido, desconto_faturamento, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep")
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
        .select("id, cliente_id, peso_total_kg, valor_com_desconto, status, transportadora_nome, valor_frete, created_at")
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

  // Buscar produtos
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ["produtos-peso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_revistas")
        .select("id, titulo, peso_bruto, preco_cheio, categoria, imagem_url")
        .gt("peso_bruto", 0)
        .order("titulo");
      if (error) throw error;
      return data as Produto[];
    },
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
    return produtos.filter(p => 
      p.titulo.toLowerCase().includes(termo) ||
      p.categoria?.toLowerCase().includes(termo)
    );
  }, [produtos, searchTerm]);

  // Converter carrinho para ItemCalculadora
  const itensCalculadora: ItemCalculadora[] = useMemo(() => 
    carrinho.map(item => ({
      id: item.produto.id,
      titulo: item.produto.titulo,
      peso_bruto: item.produto.peso_bruto,
      preco_cheio: item.produto.preco_cheio,
      categoria: item.produto.categoria,
      quantidade: item.quantidade
    })),
    [carrinho]
  );

  // Calcular totais com descontos
  const calculo = useMemo(() => {
    const pesoTotal = carrinho.reduce((acc, item) => 
      acc + (item.produto.peso_bruto * item.quantidade), 0
    );
    const quantidadeTotal = carrinho.reduce((acc, item) => 
      acc + item.quantidade, 0
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
  const adicionarProduto = useCallback((produto: Produto) => {
    setCarrinho(prev => {
      const existe = prev.find(item => item.produto.id === produto.id);
      if (existe) {
        return prev.map(item => 
          item.produto.id === produto.id 
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }
      return [...prev, { produto, quantidade: 1 }];
    });
  }, []);

  const alterarQuantidade = useCallback((produtoId: string, delta: number) => {
    setCarrinho(prev => 
      prev.map(item => {
        if (item.produto.id === produtoId) {
          const novaQtd = item.quantidade + delta;
          return novaQtd > 0 ? { ...item, quantidade: novaQtd } : item;
        }
        return item;
      }).filter(item => item.quantidade > 0)
    );
  }, []);

  const removerProduto = useCallback((produtoId: string) => {
    setCarrinho(prev => prev.filter(item => item.produto.id !== produtoId));
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

    const itens = carrinho.map(item => ({
      produto_id: item.produto.id,
      titulo: item.produto.titulo,
      quantidade: item.quantidade,
      peso_bruto: item.produto.peso_bruto,
      preco_cheio: item.produto.preco_cheio
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="h-6 w-6" />
          Orçamento de Frete
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
                    placeholder="Buscar produto..."
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
                      {searchTerm ? "Nenhum produto encontrado" : "Nenhum produto com peso cadastrado"}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {produtosFiltrados.map((produto) => (
                        <div
                          key={produto.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => adicionarProduto(produto)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{produto.titulo}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {(produto.peso_bruto * 1000).toFixed(0)}g
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                R$ {produto.preco_cheio.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
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
                        {carrinho.map((item) => (
                          <div key={item.produto.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                            <div className="flex-1 min-w-0 mr-2">
                              <p className="font-medium truncate">{item.produto.titulo}</p>
                              <p className="text-xs text-muted-foreground">
                                {(item.produto.peso_bruto * 1000).toFixed(0)}g × {item.quantidade}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => alterarQuantidade(item.produto.id, -1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-xs">{item.quantidade}</span>
                              <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => alterarQuantidade(item.produto.id, 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removerProduto(item.produto.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
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
                  <Button variant="outline" onClick={abrirWhatsApp} className="flex-1 sm:flex-none text-green-600 hover:text-green-700">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp
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
                    <div key={orc.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium">{orc.cliente?.nome_igreja}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{orc.peso_total_kg.toFixed(2)}kg</span>
                          <span>•</span>
                          <span>R$ {orc.valor_com_desconto.toFixed(2)}</span>
                          <span>•</span>
                          <span>{new Date(orc.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                      <Badge 
                        variant={orc.status === 'aguardando_orcamento' ? 'outline' : 'default'}
                        className={orc.status === 'orcamento_recebido' ? 'bg-green-500' : ''}
                      >
                        {orc.status === 'aguardando_orcamento' && (
                          <><Clock className="h-3 w-3 mr-1" /> Aguardando</>
                        )}
                        {orc.status === 'orcamento_recebido' && (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> R$ {orc.valor_frete?.toFixed(2)}</>
                        )}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
