import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CATEGORIAS_SHOPIFY } from "@/constants/categoriasShopify";
import { Percent, Save, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface AutorDescontosSectionProps {
  autorId: string | null;
  descontoLivrosProprios: number;
  onDescontoLivrosPropriosChange: (valor: number) => void;
  onDescontosCategoriasChange?: (descontos: Record<string, number>) => void;
}

export function AutorDescontosSection({ 
  autorId, 
  descontoLivrosProprios,
  onDescontoLivrosPropriosChange,
  onDescontosCategoriasChange 
}: AutorDescontosSectionProps) {
  const [descontos, setDescontos] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalDescontos, setOriginalDescontos] = useState<Record<string, number>>({});

  useEffect(() => {
    if (autorId) {
      loadDescontos();
    } else {
      const inicial: Record<string, number> = {};
      CATEGORIAS_SHOPIFY.forEach(cat => {
        inicial[cat.id] = 0;
      });
      setDescontos(inicial);
      setOriginalDescontos(inicial);
    }
  }, [autorId]);

  const loadDescontos = async () => {
    if (!autorId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("royalties_descontos_categoria_autor")
        .select("categoria, percentual_desconto")
        .eq("autor_id", autorId);

      if (error) throw error;

      const descontosMap: Record<string, number> = {};
      CATEGORIAS_SHOPIFY.forEach(cat => {
        descontosMap[cat.id] = 0;
      });

      data?.forEach((d) => {
        descontosMap[d.categoria] = Number(d.percentual_desconto);
      });

      setDescontos(descontosMap);
      setOriginalDescontos(descontosMap);
      setHasChanges(false);
    } catch (error) {
      console.error("Erro ao carregar descontos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDescontoChange = (categoria: string, valor: string) => {
    const numericValue = valor === "" ? 0 : Math.min(100, Math.max(0, parseFloat(valor) || 0));
    const newDescontos = { ...descontos, [categoria]: numericValue };
    setDescontos(newDescontos);
    setHasChanges(JSON.stringify(newDescontos) !== JSON.stringify(originalDescontos));
    onDescontosCategoriasChange?.(newDescontos);
  };

  const saveDescontos = async () => {
    if (!autorId) {
      toast.error("Salve o autor primeiro para configurar os descontos");
      return;
    }

    setSaving(true);
    try {
      for (const [categoria, percentual] of Object.entries(descontos)) {
        if (percentual > 0) {
          const { error } = await supabase
            .from("royalties_descontos_categoria_autor")
            .upsert(
              {
                autor_id: autorId,
                categoria,
                percentual_desconto: percentual,
              },
              {
                onConflict: "autor_id,categoria",
                ignoreDuplicates: false,
              }
            );

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("royalties_descontos_categoria_autor")
            .delete()
            .eq("autor_id", autorId)
            .eq("categoria", categoria);

          if (error) throw error;
        }
      }

      setOriginalDescontos({ ...descontos });
      setHasChanges(false);
      toast.success("Descontos salvos com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar descontos:", error);
      toast.error("Erro ao salvar descontos", {
        description: error?.message ?? "Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Percent className="h-5 w-5 text-primary" />
          Descontos do Autor
        </CardTitle>
        <CardDescription>
          Configure os descontos para quando o autor trocar royalties por produtos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Desconto nos próprios livros */}
        <div className="p-4 bg-background rounded-lg border">
          <div className="flex items-center gap-3 mb-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <Label className="text-base font-medium">Desconto nos Próprios Livros</Label>
              <p className="text-sm text-muted-foreground">
                Desconto especial quando o autor comprar seus próprios livros
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 max-w-[200px]">
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              value={descontoLivrosProprios || ""}
              onChange={(e) => {
                const val = e.target.value === "" ? 0 : Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                onDescontoLivrosPropriosChange(val);
              }}
              placeholder="0"
              className="pr-8"
            />
            <span className="text-muted-foreground text-sm font-medium">%</span>
          </div>
          {descontoLivrosProprios > 0 && (
            <Badge variant="default" className="mt-2">
              {descontoLivrosProprios}% nos próprios livros
            </Badge>
          )}
        </div>

        <Separator />

        {/* Descontos por categoria */}
        <div>
          <h4 className="font-medium mb-3">Descontos por Categoria (outros produtos)</h4>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {CATEGORIAS_SHOPIFY.map((categoria) => (
                  <div key={categoria.id} className="space-y-1.5">
                    <Label htmlFor={`autor-desc-${categoria.id}`} className="text-sm font-medium">
                      {categoria.name}
                    </Label>
                    <div className="relative">
                      <Input
                        id={`autor-desc-${categoria.id}`}
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={descontos[categoria.id] || ""}
                        onChange={(e) => handleDescontoChange(categoria.id, e.target.value)}
                        placeholder="0"
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        %
                      </span>
                    </div>
                    {descontos[categoria.id] > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {descontos[categoria.id]}% de desconto
                      </Badge>
                    )}
                  </div>
                ))}
              </div>

              {autorId && hasChanges && (
                <>
                  <Separator className="my-4" />
                  <div className="flex justify-end">
                    <Button 
                      onClick={saveDescontos} 
                      disabled={saving}
                      size="sm"
                      className="gap-2"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar Descontos por Categoria
                    </Button>
                  </div>
                </>
              )}

              {!autorId && (
                <p className="text-xs text-muted-foreground mt-3">
                  💡 Os descontos por categoria poderão ser salvos após cadastrar o autor.
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
