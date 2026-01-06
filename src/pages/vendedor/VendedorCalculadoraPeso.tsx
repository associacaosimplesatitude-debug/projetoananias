import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scale, Plus, Minus, Trash2, Search, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export default function VendedorCalculadoraPeso() {
  const [searchTerm, setSearchTerm] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  // Buscar produtos com peso do Bling
  const { data: produtos, isLoading } = useQuery({
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

  // Filtrar produtos pela busca
  const produtosFiltrados = useMemo(() => {
    if (!produtos) return [];
    if (!searchTerm.trim()) return produtos;
    
    const termo = searchTerm.toLowerCase();
    return produtos.filter(p => 
      p.titulo.toLowerCase().includes(termo) ||
      p.categoria?.toLowerCase().includes(termo)
    );
  }, [produtos, searchTerm]);

  // Calcular totais
  const totais = useMemo(() => {
    const pesoTotal = carrinho.reduce((acc, item) => 
      acc + (item.produto.peso_bruto * item.quantidade), 0
    );
    const valorTotal = carrinho.reduce((acc, item) => 
      acc + (item.produto.preco_cheio * item.quantidade), 0
    );
    const quantidadeTotal = carrinho.reduce((acc, item) => 
      acc + item.quantidade, 0
    );
    return { pesoTotal, valorTotal, quantidadeTotal };
  }, [carrinho]);

  // Adicionar produto ao carrinho
  const adicionarProduto = (produto: Produto) => {
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
  };

  // Alterar quantidade
  const alterarQuantidade = (produtoId: string, delta: number) => {
    setCarrinho(prev => 
      prev.map(item => {
        if (item.produto.id === produtoId) {
          const novaQtd = item.quantidade + delta;
          return novaQtd > 0 ? { ...item, quantidade: novaQtd } : item;
        }
        return item;
      }).filter(item => item.quantidade > 0)
    );
  };

  // Remover do carrinho
  const removerProduto = (produtoId: string) => {
    setCarrinho(prev => prev.filter(item => item.produto.id !== produtoId));
  };

  // Limpar carrinho
  const limparCarrinho = () => {
    setCarrinho([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scale className="h-6 w-6" />
          Calculadora de Peso
        </h1>
        <p className="text-muted-foreground">
          Simule um pedido para calcular o peso total e orçar o frete
        </p>
      </div>

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
            <ScrollArea className="h-[500px]">
              {isLoading ? (
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
                          {produto.categoria && (
                            <Badge variant="secondary" className="text-xs">
                              {produto.categoria}
                            </Badge>
                          )}
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

        {/* Carrinho / Simulação */}
        <div className="space-y-4">
          {/* Resumo do peso */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-primary">
                    {totais.pesoTotal < 1 
                      ? `${(totais.pesoTotal * 1000).toFixed(0)}g`
                      : `${totais.pesoTotal.toFixed(2)}kg`
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">Peso Total</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">
                    {totais.quantidadeTotal}
                  </p>
                  <p className="text-sm text-muted-foreground">Itens</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-600">
                    R$ {totais.valorTotal.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">Valor Estimado</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista do carrinho */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Simulação do Pedido
              </CardTitle>
              {carrinho.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={limparCarrinho}
                  className="text-destructive hover:text-destructive"
                >
                  Limpar
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px]">
                {carrinho.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Scale className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Clique nos produtos para adicionar</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {carrinho.map((item) => (
                      <div
                        key={item.produto.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="font-medium text-sm truncate">{item.produto.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {(item.produto.peso_bruto * 1000).toFixed(0)}g × {item.quantidade} = {((item.produto.peso_bruto * item.quantidade) * 1000).toFixed(0)}g
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => alterarQuantidade(item.produto.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">
                            {item.quantidade}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => alterarQuantidade(item.produto.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removerProduto(item.produto.id)}
                          >
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
    </div>
  );
}
