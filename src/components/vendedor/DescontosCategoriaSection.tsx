import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CATEGORIAS_SHOPIFY, getNomeCategoria, type CategoriaShopifyId } from "@/constants/categoriasShopify";
import { Percent, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DescontoCategoria {
  categoria: string;
  percentual_desconto: number;
}

interface DescontosCategoriaProps {
  clienteId: string | null;
  isRepresentante: boolean;
  onDescontosChange?: (descontos: Record<string, number>) => void;
}

export function DescontosCategoriaSection({ 
  clienteId, 
  isRepresentante,
  onDescontosChange 
}: DescontosCategoriaProps) {
  const [descontos, setDescontos] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalDescontos, setOriginalDescontos] = useState<Record<string, number>>({});

  // Carregar descontos existentes quando o clienteId muda
  useEffect(() => {
    if (clienteId) {
      loadDescontos();
    } else {
      // Se não tem clienteId, inicializa vazio
      const inicial: Record<string, number> = {};
      CATEGORIAS_SHOPIFY.forEach(cat => {
        inicial[cat.id] = 0;
      });
      setDescontos(inicial);
      setOriginalDescontos(inicial);
    }
  }, [clienteId]);

  const loadDescontos = async () => {
    if (!clienteId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ebd_descontos_categoria_representante")
        .select("categoria, percentual_desconto")
        .eq("cliente_id", clienteId);

      if (error) throw error;

      // Inicializa com todas as categorias em 0
      const descontosMap: Record<string, number> = {};
      CATEGORIAS_SHOPIFY.forEach(cat => {
        descontosMap[cat.id] = 0;
      });

      // Preenche com os valores do banco
      data?.forEach((d: DescontoCategoria) => {
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
    onDescontosChange?.(newDescontos);
  };

  const saveDescontos = async () => {
    if (!clienteId) {
      toast.error("Salve o cliente primeiro para configurar os descontos");
      return;
    }

    setSaving(true);
    try {
      // Para cada categoria, faz upsert
      for (const [categoria, percentual] of Object.entries(descontos)) {
        if (percentual > 0) {
          // Upsert - insere ou atualiza
          const { error } = await supabase
            .from("ebd_descontos_categoria_representante")
            .upsert(
              {
                cliente_id: clienteId,
                categoria,
                percentual_desconto: percentual,
              },
              { 
                onConflict: "cliente_id,categoria",
                ignoreDuplicates: false 
              }
            );

          if (error) throw error;
        } else {
          // Se percentual é 0, remove o registro se existir
          await supabase
            .from("ebd_descontos_categoria_representante")
            .delete()
            .eq("cliente_id", clienteId)
            .eq("categoria", categoria);
        }
      }

      setOriginalDescontos({ ...descontos });
      setHasChanges(false);
      toast.success("Descontos por categoria salvos com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar descontos:", error);
      toast.error("Erro ao salvar descontos");
    } finally {
      setSaving(false);
    }
  };

  // Só exibe para representantes
  if (!isRepresentante) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Percent className="h-5 w-5 text-amber-600" />
          Descontos por Categoria (Representante)
        </CardTitle>
        <CardDescription>
          Defina os percentuais de desconto por categoria para este cliente. 
          Estes descontos substituem todas as outras regras de desconto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {CATEGORIAS_SHOPIFY.map((categoria) => (
                <div key={categoria.id} className="space-y-1.5">
                  <Label htmlFor={`desc-${categoria.id}`} className="text-sm font-medium">
                    {categoria.name}
                  </Label>
                  <div className="relative">
                    <Input
                      id={`desc-${categoria.id}`}
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

            {clienteId && hasChanges && (
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
                    Salvar Descontos
                  </Button>
                </div>
              </>
            )}

            {!clienteId && (
              <p className="text-xs text-muted-foreground mt-3">
                💡 Os descontos poderão ser salvos após cadastrar o cliente.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
