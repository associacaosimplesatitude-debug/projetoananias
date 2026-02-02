import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useRoyaltiesAuth } from "@/hooks/useRoyaltiesAuth";
import { fetchShopifyProducts, ShopifyProduct } from "@/lib/shopify";
import { categorizarProduto, getNomeCategoria, CATEGORIAS_SHOPIFY, CategoriaShopifyId } from "@/constants/categoriasShopify";

interface CarrinhoItem {
  produto_id: string;
  variant_id: string;
  titulo: string;
  imagem_url?: string;
  preco_original: number;
  desconto_aplicado: number;
  preco_final: number;
  quantidade: number;
  categoria: CategoriaShopifyId;
  is_proprio_livro: boolean;
}

interface AutorDescontos {
  desconto_livros_proprios: number;
  categorias: Record<string, number>;
  livrosDoAutor: string[]; // Títulos dos livros deste autor
}

export default function AutorLoja() {
  const queryClient = useQueryClient();
  const { autorId } = useRoyaltiesAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Buscar saldo disponível (vendas sem pagamento vinculado)
  const { data: saldo = 0 } = useQuery({
    queryKey: ["autor-saldo", autorId],
    queryFn: async () => {
      if (!autorId) return 0;

      const { data: livros } = await supabase
        .from("royalties_livros")
        .select("id")
        .eq("autor_id", autorId);

      if (!livros || livros.length === 0) return 0;

      const livroIds = livros.map((l) => l.id);

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
      if (!autorId)
        return { desconto_livros_proprios: 0, categorias: {}, livrosDoAutor: [] };

      const { data: autor } = await supabase
        .from("royalties_autores")
        .select("desconto_livros_proprios")
        .eq("id", autorId)
        .single();

      const { data: descontosCategoria } = await supabase
        .from("royalties_descontos_categoria_autor")
        .select("categoria, percentual_desconto")
        .eq("autor_id", autorId);

      // Buscar títulos dos livros do autor (para comparar com produtos Shopify)
      const { data: livros } = await supabase
        .from("royalties_livros")
        .select("titulo")
        .eq("autor_id", autorId);

      const categorias: Record<string, number> = {};
      descontosCategoria?.forEach((d) => {
        categorias[d.categoria] = Number(d.percentual_desconto);
      });

      return {
        desconto_livros_proprios: autor?.desconto_livros_proprios || 0,
        categorias,
        livrosDoAutor: livros?.map((l) => l.titulo.toLowerCase().trim()) || [],
      };
    },
    enabled: !!autorId,
  });

  // Buscar produtos da Shopify
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ["shopify-products-autor"],
    queryFn: () => fetchShopifyProducts(500),
  });

  // Verificar se é livro do próprio autor (comparando título)
  const isProprioLivro = (titulo: string): boolean => {
    if (!descontosAutor?.livrosDoAutor.length) return false;
    const tituloLower = titulo.toLowerCase().trim();
    return descontosAutor.livrosDoAutor.some(
      (livroAutor) =>
        tituloLower.includes(livroAutor) || livroAutor.includes(tituloLower)
    );
  };

  // Calcular desconto para um produto
  const calcularDesconto = (produto: ShopifyProduct): { percentual: number; tipo: string } => {
    if (!descontosAutor) return { percentual: 0, tipo: "" };

    const titulo = produto.node.title;

    // Se é livro do próprio autor
    if (isProprioLivro(titulo)) {
      return {
        percentual: descontosAutor.desconto_livros_proprios,
        tipo: "Seu Livro",
      };
    }

    // Desconto por categoria
    const categoria = categorizarProduto(titulo);
    const percentual = descontosAutor.categorias[categoria] || 0;
    return {
      percentual,
      tipo: percentual > 0 ? getNomeCategoria(categoria) : "",
    };
  };

  // Filtrar produtos
  const produtosFiltrados = useMemo(() => {
    if (!produtos) return [];

    return produtos.filter((p) => {
      const titulo = p.node.title.toLowerCase();
      const matchesSearch = titulo.includes(searchTerm.toLowerCase());

      if (selectedCategory === "all") return matchesSearch;

      const categoria = categorizarProduto(p.node.title);
      return matchesSearch && categoria === selectedCategory;
    });
  }, [produtos, searchTerm, selectedCategory]);

  // Contagem por categoria
  const countByCategory = (categoryId: string): number => {
    if (!produtos) return 0;
    if (categoryId === "all") return produtos.length;
    return produtos.filter((p) => categorizarProduto(p.node.title) === categoryId)
      .length;
  };

  const adicionarAoCarrinho = (produto: ShopifyProduct) => {
    const variant = produto.node.variants.edges[0]?.node;
    if (!variant) {
      toast.error("Produto sem variante disponível");
      return;
    }

    const preco = parseFloat(variant.price.amount);
    const { percentual, tipo } = calcularDesconto(produto);
    const precoFinal = preco * (1 - percentual / 100);
    const categoria = categorizarProduto(produto.node.title);
    const isProprio = isProprioLivro(produto.node.title);

    setCarrinho((prev) => {
      const existente = prev.find((i) => i.variant_id === variant.id);
      if (existente) {
        return prev.map((i) =>
          i.variant_id === variant.id
            ? { ...i, quantidade: i.quantidade + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          produto_id: produto.node.id,
          variant_id: variant.id,
          titulo: produto.node.title,
          imagem_url: produto.node.images.edges[0]?.node.url,
          preco_original: preco,
          desconto_aplicado: percentual,
          preco_final: precoFinal,
          quantidade: 1,
          categoria,
          is_proprio_livro: isProprio,
        },
      ];
    });
    toast.success("Adicionado ao carrinho!");
  };

  const atualizarQuantidade = (variantId: string, delta: number) => {
    setCarrinho((prev) =>
      prev
        .map((i) =>
          i.variant_id === variantId
            ? { ...i, quantidade: Math.max(0, i.quantidade + delta) }
            : i
        )
        .filter((i) => i.quantidade > 0)
    );
  };

  const removerDoCarrinho = (variantId: string) => {
    setCarrinho((prev) => prev.filter((i) => i.variant_id !== variantId));
  };

  const totalCarrinho = carrinho.reduce(
    (acc, i) => acc + i.preco_final * i.quantidade,
    0
  );
  const totalItens = carrinho.reduce((acc, i) => acc + i.quantidade, 0);

  const criarResgateMutation = useMutation({
    mutationFn: async () => {
      if (!autorId) throw new Error("Autor não identificado");
      if (carrinho.length === 0) throw new Error("Carrinho vazio");
      if (totalCarrinho > saldo) throw new Error("Saldo insuficiente");

      const itens = carrinho.map((i) => ({
        produto_id: i.produto_id,
        variant_id: i.variant_id,
        titulo: i.titulo,
        quantidade: i.quantidade,
        valor_unitario: i.preco_original,
        desconto_aplicado: i.desconto_aplicado,
        categoria: i.categoria,
        is_proprio_livro: i.is_proprio_livro,
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
      setIsCartOpen(false);
      queryClient.invalidateQueries({ queryKey: ["autor-saldo"] });
    },
    onError: (error: Error) => {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loja</h1>
          <p className="text-muted-foreground">
            Troque seus royalties por produtos com descontos exclusivos.
          </p>
        </div>

        {/* Carrinho Flutuante */}
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="relative gap-2">
              <ShoppingCart className="h-5 w-5" />
              Carrinho
              {totalItens > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {totalItens}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-lg flex flex-col">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Meu Carrinho
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {carrinho.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Seu carrinho está vazio</p>
                </div>
              ) : (
                carrinho.map((item) => (
                  <div key={item.variant_id} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-16 h-20 bg-background rounded overflow-hidden flex-shrink-0">
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
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {item.desconto_aplicado > 0 && (
                          <>
                            <span className="text-xs text-muted-foreground line-through">
                              {formatCurrency(item.preco_original)}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              -{item.desconto_aplicado}%
                            </Badge>
                          </>
                        )}
                        <span className="text-sm font-semibold text-primary">
                          {formatCurrency(item.preco_final)}
                        </span>
                      </div>
                      {item.is_proprio_livro && (
                        <Badge variant="outline" className="text-xs mt-1">
                          Seu Livro
                        </Badge>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => atualizarQuantidade(item.variant_id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm w-8 text-center font-medium">
                          {item.quantidade}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => atualizarQuantidade(item.variant_id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive ml-auto"
                          onClick={() => removerDoCarrinho(item.variant_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {carrinho.length > 0 && (
              <div className="border-t pt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total do Carrinho</span>
                    <span className="font-semibold">{formatCurrency(totalCarrinho)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Saldo Disponível</span>
                    <span
                      className={
                        saldo >= totalCarrinho ? "text-green-600 font-semibold" : "text-destructive font-semibold"
                      }
                    >
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
                  size="lg"
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
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>

      {/* Saldo Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Saldo Disponível</p>
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(saldo)}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            Royalties pendentes
          </Badge>
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              Todas as Categorias ({countByCategory("all")})
            </SelectItem>
            {CATEGORIAS_SHOPIFY.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name} ({countByCategory(cat.id)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid de Produtos */}
      {loadingProdutos ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-square" />
              <CardContent className="p-3">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : produtosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {produtosFiltrados.map((produto) => {
            const variant = produto.node.variants.edges[0]?.node;
            const preco = parseFloat(variant?.price.amount || "0");
            const { percentual, tipo } = calcularDesconto(produto);
            const precoFinal = preco * (1 - percentual / 100);
            const isProprio = isProprioLivro(produto.node.title);
            const imagem = produto.node.images.edges[0]?.node;

            return (
              <Card key={produto.node.id} className="overflow-hidden group">
                <div className="aspect-square bg-muted relative">
                  {imagem ? (
                    <img
                      src={imagem.url}
                      alt={produto.node.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                  )}
                  {percentual > 0 && (
                    <Badge className="absolute top-2 right-2 bg-green-600">
                      {percentual}% OFF
                    </Badge>
                  )}
                  {isProprio && (
                    <Badge className="absolute top-2 left-2" variant="secondary">
                      Seu Livro
                    </Badge>
                  )}
                </div>
                <CardContent className="p-3 space-y-2">
                  <h3 className="font-medium text-sm line-clamp-2 min-h-[40px]">
                    {produto.node.title}
                  </h3>
                  {tipo && !isProprio && (
                    <p className="text-xs text-muted-foreground">{tipo}</p>
                  )}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    {percentual > 0 && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatCurrency(preco)}
                      </span>
                    )}
                    <span className="text-base font-bold text-primary">
                      {formatCurrency(precoFinal)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => adicionarAoCarrinho(produto)}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
