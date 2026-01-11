import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CATEGORIAS_SHOPIFY } from "@/constants/categoriasShopify";
import { Percent, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DescontoCategoria {
  categoria: string;
  percentual_desconto: number;
}

interface Cliente {
  id: string;
  nome_igreja: string;
  pode_faturar?: boolean;
}

interface DescontosCategoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Cliente | null;
  onSuccess?: () => void;
}

export function DescontosCategoriaDialog({
  open,
  onOpenChange,
  cliente,
  onSuccess,
}: DescontosCategoriaDialogProps) {
  const [descontos, setDescontos] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [originalDescontos, setOriginalDescontos] = useState<Record<string, number>>({});

  // Carregar descontos existentes quando o dialog abre
  useEffect(() => {
    if (open && cliente?.id) {
      loadDescontos();
    }
  }, [open, cliente?.id]);

  const loadDescontos = async () => {
    if (!cliente?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ebd_descontos_categoria_representante")
        .select("categoria, percentual_desconto")
        .eq("cliente_id", cliente.id);

      if (error) throw error;

      // Inicializa com todas as categorias em 0
      const descontosMap: Record<string, number> = {};
      CATEGORIAS_SHOPIFY.forEach((cat) => {
        descontosMap[cat.id] = 0;
      });

      // Preenche com os valores do banco
      data?.forEach((d: DescontoCategoria) => {
        descontosMap[d.categoria] = Number(d.percentual_desconto);
      });

      setDescontos(descontosMap);
      setOriginalDescontos(descontosMap);
    } catch (error) {
      console.error("Erro ao carregar descontos:", error);
      toast.error("Erro ao carregar descontos por categoria");
    } finally {
      setLoading(false);
    }
  };

  const handleDescontoChange = (categoria: string, valor: string) => {
    const numericValue = valor === "" ? 0 : Math.min(100, Math.max(0, parseFloat(valor) || 0));
    setDescontos({ ...descontos, [categoria]: numericValue });
  };

  const hasChanges = JSON.stringify(descontos) !== JSON.stringify(originalDescontos);

  const hasActiveDescontos = Object.values(descontos).some((v) => v > 0);

  const saveDescontos = async () => {
    if (!cliente?.id) {
      toast.error("Cliente não selecionado");
      return;
    }

    setSaving(true);
    try {
      console.log("[CAT_DESC][SAVE] clienteId=", cliente.id, "descontos=", descontos);

      // Para cada categoria, faz upsert / delete
      for (const [categoria, percentual] of Object.entries(descontos)) {
        if (percentual > 0) {
          const { error } = await supabase
            .from("ebd_descontos_categoria_representante")
            .upsert(
              {
                cliente_id: cliente.id,
                categoria,
                percentual_desconto: percentual,
              },
              {
                onConflict: "cliente_id,categoria",
                ignoreDuplicates: false,
              }
            );

          if (error) {
            console.error("[CAT_DESC][UPSERT_ERROR]", { cliente: cliente.id, categoria, percentual, error });
            throw error;
          }
        } else {
          const { error } = await supabase
            .from("ebd_descontos_categoria_representante")
            .delete()
            .eq("cliente_id", cliente.id)
            .eq("categoria", categoria);

          if (error) {
            console.error("[CAT_DESC][DELETE_ERROR]", { cliente: cliente.id, categoria, error });
            throw error;
          }
        }
      }

      setOriginalDescontos({ ...descontos });
      toast.success("Descontos por categoria salvos com sucesso!");
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar descontos:", error);
      toast.error("Erro ao salvar descontos", {
        description: error?.message ?? "Sem detalhes do erro.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-amber-600" />
            Descontos por Categoria
          </DialogTitle>
          <DialogDescription>
            {cliente?.nome_igreja && (
              <span className="font-medium text-foreground">{cliente.nome_igreja}</span>
            )}
            <br />
            Defina os percentuais de desconto por categoria para este cliente. 
            Estes descontos substituem todas as outras regras de desconto.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
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

            <Separator />

            <div className="flex justify-between items-center">
              {hasActiveDescontos && (
                <p className="text-sm text-amber-600">
                  Este cliente terá desconto especial por categoria
                </p>
              )}
              {!hasActiveDescontos && (
                <p className="text-sm text-muted-foreground">
                  Sem desconto por categoria configurado
                </p>
              )}
              <Button
                onClick={saveDescontos}
                disabled={saving || !hasChanges}
                size="sm"
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
