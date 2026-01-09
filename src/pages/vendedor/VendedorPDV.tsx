import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVendedor } from "@/hooks/useVendedor";
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
  Loader2
} from "lucide-react";

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
  
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteCpf, setClienteCpf] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [observacoes, setObservacoes] = useState("");
  const [vendaFinalizada, setVendaFinalizada] = useState(false);

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

  // Calcular totais
  const subtotal = carrinho.reduce((acc, item) => acc + (item.produto.preco_cheio * item.quantidade), 0);
  const total = subtotal; // Sem desconto por enquanto

  // Adicionar produto ao carrinho
  const adicionarAoCarrinho = (produto: Produto) => {
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

  // Finalizar venda
  const finalizarVenda = useMutation({
    mutationFn: async () => {
      if (!vendedor) throw new Error("Vendedor não encontrado");
      if (carrinho.length === 0) throw new Error("Carrinho vazio");
      if (!clienteNome.trim()) throw new Error("Nome do cliente é obrigatório");

      const itens = carrinho.map(item => ({
        bling_produto_id: item.produto.bling_produto_id,
        titulo: item.produto.titulo,
        quantidade: item.quantidade,
        preco_unitario: item.produto.preco_cheio,
        preco_total: item.produto.preco_cheio * item.quantidade,
      }));

      const { data, error } = await supabase
        .from("vendas_balcao")
        .insert({
          vendedor_id: vendedor.id,
          polo: "penha",
          cliente_nome: clienteNome.trim(),
          cliente_cpf: clienteCpf.trim() || null,
          cliente_telefone: clienteTelefone.trim() || null,
          itens: itens,
          valor_subtotal: subtotal,
          valor_desconto: 0,
          valor_total: total,
          forma_pagamento: formaPagamento,
          status: "concluida",
          observacoes: observacoes.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      // TODO: Integrar com Bling Penha para criar pedido
      // await supabase.functions.invoke('bling-create-order-penha', { body: { venda_id: data.id } });

      return data;
    },
    onSuccess: () => {
      toast.success("Venda finalizada com sucesso!");
      setVendaFinalizada(true);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao finalizar venda");
    },
  });

  // Nova venda
  const novaVenda = () => {
    setCarrinho([]);
    setClienteNome("");
    setClienteCpf("");
    setClienteTelefone("");
    setFormaPagamento("pix");
    setObservacoes("");
    setVendaFinalizada(false);
    setBusca("");
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lado esquerdo: Busca e produtos */}
        <Card>
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
                  {produtos.map(produto => (
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
                          <p className="text-xs text-muted-foreground">ID: {produto.bling_produto_id || produto.id.slice(0, 8)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {produto.preco_cheio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <Button size="sm" variant="ghost" className="h-6 px-2">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : busca.length >= 2 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum produto encontrado
                </p>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Digite pelo menos 2 caracteres para buscar
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
                    {carrinho.map(item => (
                      <div key={item.produto.id} className="flex items-center justify-between p-2 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-1">{item.produto.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.produto.preco_cheio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} cada
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
                    ))}
                  </div>
                </ScrollArea>
              )}

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados do cliente */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="cliente-nome">Nome *</Label>
                <Input
                  id="cliente-nome"
                  placeholder="Nome do cliente"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cliente-cpf">CPF (opcional)</Label>
                  <Input
                    id="cliente-cpf"
                    placeholder="000.000.000-00"
                    value={clienteCpf}
                    onChange={(e) => setClienteCpf(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="cliente-telefone">Telefone (opcional)</Label>
                  <Input
                    id="cliente-telefone"
                    placeholder="(00) 00000-0000"
                    value={clienteTelefone}
                    onChange={(e) => setClienteTelefone(e.target.value)}
                  />
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
            disabled={carrinho.length === 0 || !clienteNome.trim() || finalizarVenda.isPending}
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
                Finalizar Venda - {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
