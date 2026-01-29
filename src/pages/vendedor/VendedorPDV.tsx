import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVendedor } from "@/hooks/useVendedor";
import { useDescontosRepresentante } from "@/hooks/useDescontosRepresentante";
import { categorizarProduto, getNomeCategoria } from "@/constants/categoriasShopify";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  CreditCard, 
  Banknote, 
  QrCode,
  Store,
  CheckCircle,
  Loader2,
  User,
  X
} from "lucide-react";

interface ClienteEBD {
  id: string;
  nome_igreja: string;
  cnpj: string | null;
  cpf: string | null;
  telefone: string | null;
}

interface Produto {
  id: string;
  titulo: string;
  preco_cheio: number;
  estoque: number;
  imagem_url: string | null;
  bling_produto_id: number | null;
}

interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
}

type FormaPagamento = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito";

export default function VendedorPDV() {
  const { vendedor, isLoading: vendedorLoading } = useVendedor();
  const queryClient = useQueryClient();
  
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteEBD | null>(null);
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [observacoes, setObservacoes] = useState("");
  const [vendaFinalizada, setVendaFinalizada] = useState(false);

  // Buscar descontos por categoria do cliente selecionado
  const { data: descontosPorCategoria, isLoading: descontosLoading } = useDescontosRepresentante(
    clienteSelecionado?.id || null
  );

  // Buscar clientes cadastrados
  const { data: clientesEncontrados, isLoading: clientesLoading } = useQuery({
    queryKey: ["clientes-pdv-search", buscaCliente],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, cnpj, cpf, telefone")
        .or(`nome_igreja.ilike.%${buscaCliente}%,cnpj.ilike.%${buscaCliente}%,cpf.ilike.%${buscaCliente}%`)
        .limit(10);
      
      if (error) throw error;
      return (data || []) as ClienteEBD[];
    },
    enabled: buscaCliente.length >= 3 && !clienteSelecionado,
  });

  // Buscar produtos (revistas) do catálogo
  const { data: produtos, isLoading: produtosLoading } = useQuery({
    queryKey: ["bling-produtos-pdv", busca],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_revistas")
        .select("id, titulo, preco_cheio, estoque, imagem_url, bling_produto_id")
        .ilike("titulo", `%${busca}%`)
        .gt("estoque", 0)
        .limit(20);
      
      if (error) throw error;
      return (data || []) as Produto[];
    },
    enabled: busca.length >= 2,
  });

  // Calcular desconto de cada item baseado na sua categoria
  const calcularDescontoItem = (produto: Produto): number => {
    if (!descontosPorCategoria) return 0;
    const categoria = categorizarProduto(produto.titulo);
    return descontosPorCategoria[categoria] || 0;
  };

  // Calcular totais dinâmicos
  const calcularTotais = () => {
    let subtotalCheio = 0;
    let totalComDesconto = 0;

    carrinho.forEach(item => {
      const precoUnitarioCheio = item.produto.preco_cheio;
      const descontoPercent = calcularDescontoItem(item.produto);
      const precoComDesconto = precoUnitarioCheio * (1 - descontoPercent / 100);
      
      subtotalCheio += precoUnitarioCheio * item.quantidade;
      totalComDesconto += precoComDesconto * item.quantidade;
    });

    const valorDesconto = subtotalCheio - totalComDesconto;
    
    return { subtotalCheio, valorDesconto, totalComDesconto };
  };

  const { subtotalCheio, valorDesconto, totalComDesconto } = calcularTotais();

  // Calcular percentual médio de desconto para exibição
  const percentualMedioDesconto = subtotalCheio > 0 
    ? Math.round((valorDesconto / subtotalCheio) * 100) 
    : 0;

  // Adicionar produto ao carrinho
  const adicionarAoCarrinho = (produto: Produto) => {
    if (!clienteSelecionado) {
      toast.error("Selecione um cliente antes de adicionar produtos");
      return;
    }

    setCarrinho(prev => {
      const existente = prev.find(item => item.produto.id === produto.id);
      if (existente) {
        return prev.map(item => 
          item.produto.id === produto.id 
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }
      return [...prev, { produto, quantidade: 1 }];
    });
  };

  // Atualizar quantidade
  const atualizarQuantidade = (produtoId: string, delta: number) => {
    setCarrinho(prev => {
      return prev.map(item => {
        if (item.produto.id === produtoId) {
          const novaQtd = item.quantidade + delta;
          if (novaQtd <= 0) return null;
          return { ...item, quantidade: novaQtd };
        }
        return item;
      }).filter(Boolean) as ItemCarrinho[];
    });
  };

  // Remover do carrinho
  const removerDoCarrinho = (produtoId: string) => {
    setCarrinho(prev => prev.filter(item => item.produto.id !== produtoId));
  };

  // Limpar seleção de cliente
  const limparClienteSelecionado = () => {
    setClienteSelecionado(null);
    setBuscaCliente("");
    setCarrinho([]); // Limpa o carrinho pois os descontos mudam
  };

  // Finalizar venda
  const finalizarVenda = useMutation({
    mutationFn: async () => {
      if (!vendedor) throw new Error("Vendedor não encontrado");
      if (!clienteSelecionado) throw new Error("Cliente não selecionado");
      if (carrinho.length === 0) throw new Error("Carrinho vazio");

      // Preparar itens com desconto aplicado por categoria
      const itensComDesconto = carrinho.map(item => {
        const descontoPercent = calcularDescontoItem(item.produto);
        const precoComDesconto = item.produto.preco_cheio * (1 - descontoPercent / 100);
        const categoria = categorizarProduto(item.produto.titulo);
        
        return {
          bling_produto_id: item.produto.bling_produto_id,
          titulo: item.produto.titulo,
          categoria: categoria,
          quantidade: item.quantidade,
          preco_unitario: item.produto.preco_cheio,
          desconto_percentual: descontoPercent,
          preco_com_desconto: precoComDesconto,
          preco_total: precoComDesconto * item.quantidade,
        };
      });

      // Criar pedido no Bling primeiro (para obter bling_order_id)
      const blingResponse = await supabase.functions.invoke('bling-create-order', {
        body: {
          forma_pagamento: 'pagamento_loja',
          forma_pagamento_loja: formaPagamento,
          deposito_origem: 'local',
          cliente_nome: clienteSelecionado.nome_igreja,
          cliente_documento: clienteSelecionado.cnpj || clienteSelecionado.cpf || null,
          cliente_telefone: clienteSelecionado.telefone || null,
          cliente_id: clienteSelecionado.id,
          itens: carrinho.map(item => {
            const descontoPercent = calcularDescontoItem(item.produto);
            return {
              bling_produto_id: item.produto.bling_produto_id,
              titulo: item.produto.titulo,
              quantidade: item.quantidade,
              preco_cheio: item.produto.preco_cheio,
              valor: item.produto.preco_cheio * (1 - descontoPercent / 100),
              descontoItem: descontoPercent, // Desconto específico da categoria
            };
          }),
          valor_total: totalComDesconto,
          observacoes: `PDV Balcão Penha - ${formaPagamento.toUpperCase()}${observacoes.trim() ? ` | ${observacoes.trim()}` : ''}`,
          vendedor_id: vendedor.id,
        }
      });

      if (blingResponse.error) {
        console.error("Erro ao criar pedido no Bling:", blingResponse.error);
        throw new Error("Erro ao criar pedido no Bling. Tente novamente.");
      }

      const blingData = blingResponse.data;

      // Salvar no banco vendas_balcao com referência ao Bling
      const { data, error } = await supabase
        .from("vendas_balcao")
        .insert({
          vendedor_id: vendedor.id,
          polo: "penha",
          cliente_nome: clienteSelecionado.nome_igreja,
          cliente_cpf: clienteSelecionado.cnpj || clienteSelecionado.cpf || null,
          cliente_telefone: clienteSelecionado.telefone || null,
          itens: itensComDesconto,
          valor_subtotal: subtotalCheio,
          valor_desconto: valorDesconto,
          valor_total: totalComDesconto,
          forma_pagamento: formaPagamento,
          status: "concluida",
          observacoes: observacoes.trim() || null,
          bling_order_id: blingData?.bling_order_id || null,
          bling_order_number: blingData?.bling_order_number || null,
        })
        .select()
        .single();

      if (error) throw error;

      // [NOVO] Gerar NF-e automaticamente após criar pedido no Bling
      let nfeResult: { nfe_numero?: string; status?: string } | null = null;
      if (blingData?.bling_order_id) {
        console.log(`[PDV] Gerando NF-e para pedido Bling ${blingData.bling_order_id}`);
        
        try {
          const nfeResponse = await supabase.functions.invoke('bling-generate-nfe', {
            body: { bling_order_id: blingData.bling_order_id }
          });

          if (nfeResponse.data?.nfe_id) {
            console.log(`[PDV] NF-e gerada com sucesso: ${nfeResponse.data.nfe_numero}`);
            nfeResult = { nfe_numero: nfeResponse.data.nfe_numero, status: 'autorizada' };
          } else if (nfeResponse.data?.nfe_pendente) {
            console.log(`[PDV] NF-e em processamento, será atualizada via polling`);
            nfeResult = { status: 'processando' };
          } else {
            console.warn(`[PDV] Aviso ao gerar NF-e:`, nfeResponse.data?.fiscal_error || nfeResponse.error);
            nfeResult = { status: 'erro' };
          }
        } catch (nfeError) {
          console.error(`[PDV] Erro ao gerar NF-e:`, nfeError);
          nfeResult = { status: 'erro' };
        }
      }

      return { ...data, nfeResult };
    },
    onSuccess: (result) => {
      if (result?.nfeResult?.nfe_numero) {
        toast.success(`Venda finalizada! NF-e #${result.nfeResult.nfe_numero} emitida.`);
      } else if (result?.nfeResult?.status === 'processando') {
        toast.success("Venda finalizada! NF-e em processamento, verifique em Notas Emitidas.");
      } else {
        toast.success("Venda finalizada! Pedido criado no Bling.");
      }
      setVendaFinalizada(true);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao finalizar venda");
    },
  });

  // Nova venda
  const novaVenda = () => {
    setCarrinho([]);
    setClienteSelecionado(null);
    setBuscaCliente("");
    setFormaPagamento("pix");
    setObservacoes("");
    setVendaFinalizada(false);
    setBusca("");
  };

  // Verificar se todos os descontos são iguais para exibição simplificada
  const getDescontosUnicos = (): number[] => {
    if (!descontosPorCategoria) return [];
    return [...new Set(Object.values(descontosPorCategoria))];
  };

  const descontosUnicos = getDescontosUnicos();
  const temDescontoUnico = descontosUnicos.length === 1;

  if (vendedorLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (vendaFinalizada) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="bg-green-100 dark:bg-green-900/30 p-8 rounded-full">
          <CheckCircle className="h-16 w-16 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-center">Venda Finalizada!</h2>
        <p className="text-muted-foreground text-center">
          A venda foi registrada com sucesso.
        </p>
        <Button onClick={novaVenda} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Nova Venda
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Store className="h-6 w-6" />
        <h1 className="text-2xl font-bold">PDV Balcão - Polo Penha</h1>
      </div>

      {/* Card de seleção de cliente */}
      <Card className="border-primary/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Cliente Cadastrado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clienteSelecionado ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-semibold">{clienteSelecionado.nome_igreja}</p>
                  <p className="text-sm text-muted-foreground">
                    {clienteSelecionado.cnpj || clienteSelecionado.cpf || "Sem documento"}
                  </p>
                  {descontosLoading ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">Carregando descontos...</span>
                    </div>
                  ) : temDescontoUnico && descontosUnicos[0] > 0 ? (
                    <Badge variant="secondary" className="mt-2 bg-green-100 text-green-700">
                      -{descontosUnicos[0]}% em todas as categorias
                    </Badge>
                  ) : descontosPorCategoria && Object.keys(descontosPorCategoria).length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(descontosPorCategoria).map(([cat, desc]) => (
                        <Badge key={cat} variant="outline" className="text-xs">
                          {getNomeCategoria(cat)}: -{desc}%
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <Badge variant="secondary" className="mt-2 text-yellow-700 bg-yellow-100">
                      Nenhum desconto cadastrado
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={limparClienteSelecionado}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente por nome, CNPJ ou CPF..."
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {clientesLoading && (
                <div className="space-y-2">
                  {[1, 2].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              )}

              {clientesEncontrados && clientesEncontrados.length > 0 && (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {clientesEncontrados.map(cliente => (
                    <div
                      key={cliente.id}
                      className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setClienteSelecionado(cliente);
                        setBuscaCliente("");
                      }}
                    >
                      <div>
                        <p className="font-medium text-sm">{cliente.nome_igreja}</p>
                        <p className="text-xs text-muted-foreground">
                          {cliente.cnpj || cliente.cpf || "Sem documento"}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {buscaCliente.length >= 3 && !clientesLoading && clientesEncontrados?.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Nenhum cliente encontrado
                </p>
              )}

              {buscaCliente.length > 0 && buscaCliente.length < 3 && (
                <p className="text-center text-xs text-muted-foreground">
                  Digite pelo menos 3 caracteres
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lado esquerdo: Busca e produtos */}
        <Card className={!clienteSelecionado ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Adicionar Produtos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto por nome ou SKU..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
                disabled={!clienteSelecionado}
              />
            </div>

            <ScrollArea className="h-[300px]">
              {produtosLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : produtos && produtos.length > 0 ? (
                <div className="space-y-2">
                  {produtos.map(produto => {
                    const descontoPercent = calcularDescontoItem(produto);
                    const precoComDesconto = produto.preco_cheio * (1 - descontoPercent / 100);
                    const categoria = categorizarProduto(produto.titulo);
                    
                    return (
                      <div 
                        key={produto.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => adicionarAoCarrinho(produto)}
                      >
                        <div className="flex items-center gap-3">
                          {produto.imagem_url && (
                            <img 
                              src={produto.imagem_url} 
                              alt={produto.titulo}
                              className="h-10 w-10 object-cover rounded"
                            />
                          )}
                          <div>
                            <p className="font-medium text-sm line-clamp-1">{produto.titulo}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{getNomeCategoria(categoria)}</span>
                              {descontoPercent > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-green-100 text-green-700">
                                  -{descontoPercent}%
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {descontoPercent > 0 ? (
                            <>
                              <p className="text-xs text-muted-foreground line-through">
                                {produto.preco_cheio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                              <p className="font-semibold text-green-600">
                                {precoComDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            </>
                          ) : (
                            <p className="font-semibold">
                              {produto.preco_cheio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          )}
                          <Button size="sm" variant="ghost" className="h-6 px-2">
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : busca.length >= 2 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum produto encontrado
                </p>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {clienteSelecionado 
                    ? "Digite pelo menos 2 caracteres para buscar" 
                    : "Selecione um cliente primeiro"}
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Lado direito: Carrinho e finalização */}
        <div className="space-y-4">
          {/* Carrinho */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Carrinho ({carrinho.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {carrinho.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Carrinho vazio
                </p>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {carrinho.map(item => {
                      const descontoPercent = calcularDescontoItem(item.produto);
                      const precoComDesconto = item.produto.preco_cheio * (1 - descontoPercent / 100);
                      const totalItem = precoComDesconto * item.quantidade;
                      const categoria = categorizarProduto(item.produto.titulo);
                      
                      return (
                        <div key={item.produto.id} className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-1">{item.produto.titulo}</p>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">{getNomeCategoria(categoria)}</span>
                              {descontoPercent > 0 && (
                                <>
                                  <span className="text-muted-foreground line-through">
                                    {item.produto.preco_cheio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                  <span className="text-green-600 font-medium">
                                    {precoComDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-green-100 text-green-700">
                                    -{descontoPercent}%
                                  </Badge>
                                </>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Subtotal: {totalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-6 w-6"
                              onClick={() => atualizarQuantidade(item.produto.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center font-medium">{item.quantidade}</span>
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-6 w-6"
                              onClick={() => atualizarQuantidade(item.produto.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6 text-destructive"
                              onClick={() => removerDoCarrinho(item.produto.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal (preço cheio)</span>
                  <span className="line-through">{subtotalCheio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Desconto{percentualMedioDesconto > 0 ? ` (~${percentualMedioDesconto}%)` : ''}</span>
                  <span>-{valorDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{totalComDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Forma de pagamento */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Forma de Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={formaPagamento}
                onValueChange={(v) => setFormaPagamento(v as FormaPagamento)}
                className="grid grid-cols-2 gap-2"
              >
                <Label
                  htmlFor="pag-pix"
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    formaPagamento === "pix" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value="pix" id="pag-pix" />
                  <QrCode className="h-4 w-4" />
                  <span>PIX</span>
                </Label>
                <Label
                  htmlFor="pag-dinheiro"
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    formaPagamento === "dinheiro" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value="dinheiro" id="pag-dinheiro" />
                  <Banknote className="h-4 w-4" />
                  <span>Dinheiro</span>
                </Label>
                <Label
                  htmlFor="pag-credito"
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    formaPagamento === "cartao_credito" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value="cartao_credito" id="pag-credito" />
                  <CreditCard className="h-4 w-4" />
                  <span>Crédito</span>
                </Label>
                <Label
                  htmlFor="pag-debito"
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    formaPagamento === "cartao_debito" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value="cartao_debito" id="pag-debito" />
                  <CreditCard className="h-4 w-4" />
                  <span>Débito</span>
                </Label>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Botão finalizar */}
          <Button
            className="w-full h-12 text-lg"
            disabled={carrinho.length === 0 || !clienteSelecionado || finalizarVenda.isPending}
            onClick={() => finalizarVenda.mutate()}
          >
            {finalizarVenda.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Finalizar Venda - {totalComDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
