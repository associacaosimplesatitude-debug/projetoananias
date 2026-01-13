import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, FileText, Printer, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  nfeUrl: initialNfeUrl,
  nfePendente: initialNfePendente,
  onClose,
}: VendaConcluidaDialogProps) {
  const [isGeneratingNfe, setIsGeneratingNfe] = useState(false);
  const [nfeUrl, setNfeUrl] = useState<string | null>(initialNfeUrl || null);
  const [nfePendente, setNfePendente] = useState(initialNfePendente ?? true);

  const handleGenerateNfe = async () => {
    if (!blingOrderId) {
      toast.error("ID do pedido não disponível");
      return;
    }

    setIsGeneratingNfe(true);
    try {
      const { data, error } = await supabase.functions.invoke('bling-generate-nfe', {
        body: { bling_order_id: blingOrderId }
      });

      if (error) throw error;

      if (data?.nfe_url) {
        setNfeUrl(data.nfe_url);
        setNfePendente(false);
        toast.success("NF-e gerada com sucesso!");
      } else if (data?.nfe_pendente) {
        toast.info("NF-e em processamento. Tente novamente em alguns segundos.");
      } else {
        toast.error("Não foi possível gerar a NF-e. Tente novamente.");
      }
    } catch (err: any) {
      console.error("Erro ao gerar NF-e:", err);
      toast.error("Erro ao gerar NF-e: " + (err.message || "Tente novamente"));
    } finally {
      setIsGeneratingNfe(false);
    }
  };

  const handlePrintDanfe = () => {
    if (nfeUrl) {
      window.open(nfeUrl, '_blank');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
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
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
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

          {/* Seção de NF-e */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-medium">Nota Fiscal</span>
            </div>

            {nfeUrl && !nfePendente ? (
              <>
                <p className="text-sm text-muted-foreground">
                  A NF-e foi gerada. Clique abaixo para visualizar e imprimir a DANFE.
                </p>
                <Button
                  onClick={handlePrintDanfe}
                  className="w-full"
                  variant="default"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver DANFE
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {nfePendente 
                    ? "A NF-e está sendo processada. Clique para tentar buscar ou gerar novamente."
                    : "Gere a nota fiscal para imprimir e entregar ao cliente."}
                </p>
                <Button
                  onClick={handleGenerateNfe}
                  className="w-full"
                  variant="outline"
                  disabled={isGeneratingNfe}
                >
                  {isGeneratingNfe ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando NF-e...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {nfePendente ? "Verificar NF-e" : "Gerar Nota Fiscal"}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>

          {/* Botão Fechar */}
          <Button
            onClick={handleClose}
            variant="secondary"
            className="w-full"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
