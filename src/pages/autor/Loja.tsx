import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  ShoppingCart, 
  Package, 
  Search, 
  Minus, 
  Plus,
  Trash2,
  Loader2,
  Wallet,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useRoyaltiesAuth } from "@/hooks/useRoyaltiesAuth";
import { categorizarProduto, CategoriaShopifyId } from "@/constants/categoriasShopify";

interface CarrinhoItem {
  produto_id: string;
  titulo: string;
  imagem_url?: string;
  preco_original: number;
  desconto_aplicado: number;
  preco_final: number;
  quantidade: number;
}

interface AutorDescontos {
  desconto_livros_proprios: number;
  categorias: Record<string, number>;
  livrosDoAutor: string[]; // IDs dos livros deste autor
}

export default function AutorLoja() {
  const queryClient = useQueryClient();
  const { autorId } = useRoyaltiesAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);

  // Buscar saldo disponível (vendas sem pagamento vinculado)
  const { data: saldo = 0 } = useQuery({
    queryKey: ["autor-saldo", autorId],
    queryFn: async () => {
      if (!autorId) return 0;
      
      // Buscar livros do autor primeiro
      const { data: livros } = await supabase
        .from("royalties_livros")
        .select("id")
        .eq("autor_id", autorId);

      if (!livros || livros.length === 0) return 0;

      const livroIds = livros.map(l => l.id);

      // Buscar vendas pendentes (não vinculadas a pagamento)
      const { data, error } = await supabase
        .from("royalties_vendas")
        .select("valor_comissao_total")
        .in("livro_id", livroIds)
        .is("pagamento_id", null);

      if (error) throw error;
      
      return data?.reduce((acc, c) => acc + Number(c.valor_comissao_total), 0) || 0;
    },
    enabled: !!autorId,
  });

  // Buscar descontos do autor
  const { data: descontosAutor } = useQuery<AutorDescontos>({
    queryKey: ["autor-descontos", autorId],
    queryFn: async () => {
      if (!autorId) return { desconto_livros_proprios: 0, categorias: {}, livrosDoAutor: [] };
      
      // Buscar info do autor
      const { data: autor } = await supabase
        .from("royalties_autores")
        .select("desconto_livros_proprios")
        .eq("id", autorId)
        .single();

      // Buscar descontos por categoria
      const { data: descontosCategoria } = await supabase
        .from("royalties_descontos_categoria_autor")
        .select("categoria, percentual_desconto")
        .eq("autor_id", autorId);

      // Buscar livros do autor
      const { data: livros } = await supabase
        .from("royalties_livros")
        .select("id")
        .eq("autor_id", autorId);

      const categorias: Record<string, number> = {};
      descontosCategoria?.forEach((d) => {
        categorias[d.categoria] = Number(d.percentual_desconto);
      });

      return {
        desconto_livros_proprios: autor?.desconto_livros_proprios || 0,
        categorias,
        livrosDoAutor: livros?.map((l) => l.id) || [],
      };
    },
    enabled: !!autorId,
  });

  // Buscar produtos (livros disponíveis)
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ["produtos-loja"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_livros")
        .select("id, titulo, capa_url, valor_capa, autor_id")
        .eq("is_active", true)
        .order("titulo");

      if (error) throw error;
      return data;
    },
  });

  const calcularDesconto = (produto: { id: string; titulo: string; autor_id: string | null }) => {
    if (!descontosAutor) return 0;

    // Se é livro do próprio autor
    if (descontosAutor.livrosDoAutor.includes(produto.id)) {
      return descontosAutor.desconto_livros_proprios;
    }

    // Desconto por categoria
    const categoria = categorizarProduto(produto.titulo);
    return descontosAutor.categorias[categoria] || 0;
  };

  const produtosFiltrados = produtos?.filter((p) =>
    p.titulo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const adicionarAoCarrinho = (produto: typeof produtos[0]) => {
    const desconto = calcularDesconto(produto);
    const precoFinal = produto.valor_capa * (1 - desconto / 100);

    setCarrinho((prev) => {
      const existente = prev.find((i) => i.produto_id === produto.id);
      if (existente) {
        return prev.map((i) =>
          i.produto_id === produto.id
            ? { ...i, quantidade: i.quantidade + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          produto_id: produto.id,
          titulo: produto.titulo,
          imagem_url: produto.capa_url || undefined,
          preco_original: produto.valor_capa,
          desconto_aplicado: desconto,
          preco_final: precoFinal,
          quantidade: 1,
        },
      ];
    });
    toast.success("Adicionado ao carrinho!");
  };

  const atualizarQuantidade = (produtoId: string, delta: number) => {
    setCarrinho((prev) =>
      prev
        .map((i) =>
          i.produto_id === produtoId
            ? { ...i, quantidade: Math.max(0, i.quantidade + delta) }
            : i
        )
        .filter((i) => i.quantidade > 0)
    );
  };

  const removerDoCarrinho = (produtoId: string) => {
    setCarrinho((prev) => prev.filter((i) => i.produto_id !== produtoId));
  };

  const totalCarrinho = carrinho.reduce(
    (acc, i) => acc + i.preco_final * i.quantidade,
    0
  );

  const criarResgateMutation = useMutation({
    mutationFn: async () => {
      if (!autorId) throw new Error("Autor não identificado");
      if (carrinho.length === 0) throw new Error("Carrinho vazio");
      if (totalCarrinho > saldo) throw new Error("Saldo insuficiente");

      const itens = carrinho.map((i) => ({
        produto_id: i.produto_id,
        titulo: i.titulo,
        quantidade: i.quantidade,
        valor_unitario: i.preco_original,
        desconto_aplicado: i.desconto_aplicado,
      }));

      const { error } = await supabase.from("royalties_resgates").insert({
        autor_id: autorId,
        valor_total: totalCarrinho,
        itens,
        status: "pendente",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resgate solicitado!", {
        description: "Aguarde a aprovação do administrador.",
      });
      setCarrinho([]);
      queryClient.invalidateQueries({ queryKey: ["autor-saldo"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao criar resgate", { description: error.message });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Loja</h1>
        <p className="text-muted-foreground">
          Troque seus royalties por produtos com descontos exclusivos.
        </p>
      </div>

      {/* Saldo Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Saldo Disponível</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(saldo)}</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            Royalties pendentes
          </Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Produtos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {loadingProdutos ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : produtosFiltrados?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum produto encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {produtosFiltrados?.map((produto) => {
                const desconto = calcularDesconto(produto);
                const precoFinal = produto.valor_capa * (1 - desconto / 100);
                const isProprioLivro = descontosAutor?.livrosDoAutor.includes(produto.id);

                return (
                  <Card key={produto.id} className="overflow-hidden">
                    <div className="aspect-[3/4] bg-muted relative">
                      {produto.capa_url ? (
                        <img
                          src={produto.capa_url}
                          alt={produto.titulo}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                      )}
                      {desconto > 0 && (
                        <Badge className="absolute top-2 right-2 bg-green-600">
                          {desconto}% OFF
                        </Badge>
                      )}
                      {isProprioLivro && (
                        <Badge className="absolute top-2 left-2" variant="secondary">
                          Seu Livro
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-medium line-clamp-2 mb-2">{produto.titulo}</h3>
                      <div className="flex items-baseline gap-2 mb-3">
                        {desconto > 0 && (
                          <span className="text-sm text-muted-foreground line-through">
                            {formatCurrency(produto.valor_capa)}
                          </span>
                        )}
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(precoFinal)}
                        </span>
                      </div>
                      <Button
                        className="w-full gap-2"
                        onClick={() => adicionarAoCarrinho(produto)}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Adicionar
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Carrinho */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Meu Carrinho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {carrinho.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Seu carrinho está vazio
                </p>
              ) : (
                <>
                  {carrinho.map((item) => (
                    <div key={item.produto_id} className="flex gap-3">
                      <div className="w-16 h-20 bg-muted rounded overflow-hidden flex-shrink-0">
                        {item.imagem_url ? (
                          <img
                            src={item.imagem_url}
                            alt={item.titulo}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-clamp-2">{item.titulo}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-sm font-medium">
                            {formatCurrency(item.preco_final)}
                          </span>
                          {item.desconto_aplicado > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              -{item.desconto_aplicado}%
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => atualizarQuantidade(item.produto_id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm w-6 text-center">{item.quantidade}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => atualizarQuantidade(item.produto_id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive ml-auto"
                            onClick={() => removerDoCarrinho(item.produto_id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total do Carrinho</span>
                      <span className="font-medium">{formatCurrency(totalCarrinho)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Saldo Disponível</span>
                      <span className={saldo >= totalCarrinho ? "text-green-600" : "text-destructive"}>
                        {formatCurrency(saldo)}
                      </span>
                    </div>
                    {totalCarrinho > saldo && (
                      <p className="text-xs text-destructive">
                        Saldo insuficiente para este resgate.
                      </p>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    disabled={
                      carrinho.length === 0 ||
                      totalCarrinho > saldo ||
                      criarResgateMutation.isPending
                    }
                    onClick={() => criarResgateMutation.mutate()}
                  >
                    {criarResgateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Tag className="h-4 w-4 mr-2" />
                    )}
                    Confirmar Resgate
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
