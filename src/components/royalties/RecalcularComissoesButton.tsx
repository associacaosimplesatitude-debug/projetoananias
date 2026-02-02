import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function RecalcularComissoesButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleRecalcular = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("recalcular_royalties_pendentes");

      if (error) throw error;

      const result = data?.[0] || { vendas_atualizadas: 0, total_antes: 0, total_depois: 0 };
      const diferenca = result.total_depois - result.total_antes;

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["royalties-vendas"] });
      queryClient.invalidateQueries({ queryKey: ["royalties-total-a-pagar"] });
      queryClient.invalidateQueries({ queryKey: ["royalties-top-autores"] });
      queryClient.invalidateQueries({ queryKey: ["royalties-top-livros"] });
      queryClient.invalidateQueries({ queryKey: ["royalties-vendas-mensal"] });
      queryClient.invalidateQueries({ queryKey: ["royalties-vendas-mes"] });

      toast.success(
        `Recálculo concluído! ${result.vendas_atualizadas} vendas atualizadas.`,
        {
          description: `Antes: ${formatCurrency(result.total_antes)} → Depois: ${formatCurrency(result.total_depois)} (${diferenca >= 0 ? "+" : ""}${formatCurrency(diferenca)})`,
          duration: 8000,
        }
      );
    } catch (error: any) {
      console.error("Erro ao recalcular comissões:", error);
      toast.error("Erro ao recalcular comissões", {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
      setDialogOpen(false);
    }
  };

  return (
    <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={isLoading}>
          <Calculator className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Recalculando..." : "Recalcular Comissões"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recalcular Comissões Pendentes</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Esta ação irá recalcular <strong>todas</strong> as comissões de vendas pendentes
              (não pagas) usando o <strong>Valor Líquido</strong> atual de cada livro.
            </p>
            <p className="text-amber-600">
              ⚠️ Vendas já pagas não serão afetadas.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleRecalcular} disabled={isLoading}>
            {isLoading ? "Processando..." : "Confirmar Recálculo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
