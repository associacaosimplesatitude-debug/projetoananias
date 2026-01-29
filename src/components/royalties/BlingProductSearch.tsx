import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Book, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface BlingProduct {
  id: number;
  codigo: string;
  nome: string;
  preco: number;
  imagemURL: string;
  descricao: string;
  estoque: number;
}

interface BlingProductSearchProps {
  onSelect: (product: BlingProduct) => void;
  disabled?: boolean;
}

export function BlingProductSearch({ onSelect, disabled }: BlingProductSearchProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<BlingProduct[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const handleSearch = useCallback(async () => {
    if (query.trim().length < 2) {
      toast({
        title: "Busca inválida",
        description: "Digite pelo menos 2 caracteres para buscar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setProducts([]);

    try {
      const { data, error } = await supabase.functions.invoke("bling-search-product", {
        body: { query: query.trim() },
      });

      if (error) throw error;

      if (data?.success) {
        setProducts(data.products || []);
        if (data.products?.length === 0) {
          toast({
            title: "Nenhum produto encontrado",
            description: "Tente buscar com outros termos",
          });
        }
      } else {
        throw new Error(data?.error || "Erro ao buscar produtos");
      }
    } catch (error: any) {
      console.error("Erro na busca Bling:", error);
      toast({
        title: "Erro na busca",
        description: error.message || "Não foi possível buscar produtos no Bling",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [query, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSelect = (product: BlingProduct) => {
    setSelectedId(product.id);
    onSelect(product);
    toast({
      title: "Produto selecionado",
      description: `"${product.nome}" foi importado para o formulário`,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Book className="h-4 w-4" />
        Importar do Bling
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Buscar por título ou código..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          className="flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={handleSearch}
          disabled={disabled || loading || query.trim().length < 2}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">Buscar</span>
        </Button>
      </div>

      {/* Results */}
      {products.length > 0 && (
        <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2 bg-background">
          {products.map((product) => (
            <div
              key={product.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-md border transition-colors",
                selectedId === product.id
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {product.imagemURL ? (
                  <img
                    src={product.imagemURL}
                    alt={product.nome}
                    className="w-12 h-16 object-cover rounded border flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-16 bg-muted rounded border flex items-center justify-center flex-shrink-0">
                    <Book className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Código: {product.codigo || "N/A"} | {formatCurrency(product.preco)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Estoque: {product.estoque} unidades
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={selectedId === product.id ? "default" : "outline"}
                onClick={() => handleSelect(product)}
                disabled={disabled}
                className="flex-shrink-0 ml-2"
              >
                {selectedId === product.id ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Selecionado
                  </>
                ) : (
                  "Selecionar"
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {hasSearched && !loading && products.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum produto encontrado. Tente buscar com outros termos.
        </p>
      )}
    </div>
  );
}
