import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Percent, Loader2 } from "lucide-react";

interface DescontoFaturamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: {
    id: string;
    nome_igreja: string;
    desconto_faturamento?: number | null;
  } | null;
  onSuccess: () => void;
}

export function DescontoFaturamentoDialog({
  open,
  onOpenChange,
  cliente,
  onSuccess,
}: DescontoFaturamentoDialogProps) {
  const [desconto, setDesconto] = useState<string>("0");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (cliente) {
      setDesconto(cliente.desconto_faturamento?.toString() || "0");
    }
  }, [cliente]);

  const handleSave = async () => {
    if (!cliente) return;

    const descontoNum = parseFloat(desconto) || 0;
    if (descontoNum < 0 || descontoNum > 100) {
      toast.error("Desconto deve ser entre 0% e 100%");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("ebd_clientes")
        .update({ desconto_faturamento: descontoNum })
        .eq("id", cliente.id);

      if (error) throw error;

      toast.success(`Desconto de ${descontoNum}% configurado para ${cliente.nome_igreja}`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar desconto:", error);
      toast.error("Erro ao salvar desconto");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            Desconto do Vendedor
          </DialogTitle>
          <DialogDescription>
            Configure o desconto especial para <strong>{cliente?.nome_igreja}</strong>. 
            Este desconto será aplicado automaticamente em todos os pedidos do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="desconto">Desconto (%)</Label>
            <div className="relative">
              <Input
                id="desconto"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                className="pr-8"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Este desconto será aplicado em todos os pedidos, independente da forma de pagamento.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Desconto"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
