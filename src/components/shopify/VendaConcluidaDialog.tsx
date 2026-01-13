import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface VendaConcluidaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteNome: string;
  blingOrderId: number | null;
  blingOrderNumber: string | null;
  nfeUrl?: string | null;
  nfePendente?: boolean;
  onClose: () => void;
}

export function VendaConcluidaDialog({
  open,
  onOpenChange,
  clienteNome,
  blingOrderId,
  blingOrderNumber,
  onClose,
}: VendaConcluidaDialogProps) {
  const navigate = useNavigate();

  const handleClose = () => {
    onOpenChange(false);
    onClose();
  };

  const handleGoToNotas = () => {
    onOpenChange(false);
    onClose();
    navigate("/vendedor/notas-emitidas");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CheckCircle className="h-6 w-6 text-green-500" />
            Venda Concluída!
          </DialogTitle>
          <DialogDescription className="text-base">
            Pedido registrado com sucesso para <strong className="text-foreground">{clienteNome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Informações do Pedido */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pedido Bling:</span>
              <Badge variant="secondary" className="font-mono">
                {blingOrderNumber || blingOrderId || 'N/A'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Atendido
              </Badge>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="space-y-2">
            <Button
              onClick={handleGoToNotas}
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              Ver Notas Emitidas
            </Button>
            <Button
              onClick={handleClose}
              variant="outline"
              className="w-full"
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
