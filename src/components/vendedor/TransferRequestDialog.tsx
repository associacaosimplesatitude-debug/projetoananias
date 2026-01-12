import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVendedor } from "@/hooks/useVendedor";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Send, ArrowRightLeft } from "lucide-react";

interface TransferRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  nomeCliente: string;
  nomeVendedorAtual: string;
  vendedorAtualId: string | null;
  onSuccess?: () => void;
}

export function TransferRequestDialog({
  open,
  onOpenChange,
  clienteId,
  nomeCliente,
  nomeVendedorAtual,
  vendedorAtualId,
  onSuccess,
}: TransferRequestDialogProps) {
  const { vendedor } = useVendedor();
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState("");

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!vendedor?.id) throw new Error("Vendedor não identificado");

      const { error } = await supabase.from("ebd_transfer_requests").insert({
        cliente_id: clienteId,
        vendedor_solicitante_id: vendedor.id,
        vendedor_atual_id: vendedorAtualId,
        motivo_solicitacao: motivo || null,
        status: "pendente",
      });

      if (error) {
        // Se for erro de duplicidade, já existe uma requisição pendente
        if (error.code === "23505") {
          throw new Error("Já existe uma solicitação pendente para este cliente.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfer-requests"] });
      toast.success("Solicitação enviada! Aguarde aprovação do gerente.");
      setMotivo("");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao enviar solicitação");
    },
  });

  const handleSubmit = () => {
    createRequestMutation.mutate();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Solicitar Transferência de Cliente
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-2">
            <p>
              O cliente <strong>"{nomeCliente}"</strong> já está cadastrado e pertence ao vendedor{" "}
              <strong>{nomeVendedorAtual}</strong>.
            </p>
            <p className="text-sm">
              Ao solicitar a transferência, o gerente será notificado e poderá aprovar ou recusar sua solicitação.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Label htmlFor="motivo" className="text-sm font-medium">
            Motivo da solicitação (opcional)
          </Label>
          <Textarea
            id="motivo"
            placeholder="Ex: Cliente entrou em contato comigo pedindo atendimento, cliente da minha região..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            className="mt-2"
          />
        </div>

        <AlertDialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={createRequestMutation.isPending}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createRequestMutation.isPending}
          >
            {createRequestMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Solicitar Transferência
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
