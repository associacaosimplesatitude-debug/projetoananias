import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  FileText, 
  Loader2, 
  ExternalLink, 
  AlertCircle,
  Check,
  Circle,
  RefreshCw
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type NfeStage = 'idle' | 'creating' | 'sending' | 'polling' | 'authorized' | 'error';

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

const STEPS = [
  { key: 'creating', label: 'Criando NF-e' },
  { key: 'sending', label: 'Transmitindo SEFAZ' },
  { key: 'polling', label: 'Aguardando Autorização' },
];

function getStepStatus(stepKey: string, currentStage: NfeStage): 'completed' | 'active' | 'pending' | 'error' {
  const stageOrder = ['idle', 'creating', 'sending', 'polling', 'authorized', 'error'];
  const stepOrder = ['creating', 'sending', 'polling'];
  
  if (currentStage === 'error') return 'error';
  if (currentStage === 'authorized') return 'completed';
  
  const currentIndex = stepOrder.indexOf(currentStage);
  const stepIndex = stepOrder.indexOf(stepKey);
  
  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
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
  const [nfeStage, setNfeStage] = useState<NfeStage>(
    initialNfeUrl && !initialNfePendente ? 'authorized' : 'idle'
  );
  const [nfeUrl, setNfeUrl] = useState<string | null>(initialNfeUrl || null);
  const [nfeError, setNfeError] = useState<string | null>(null);
  const [pollingAttempt, setPollingAttempt] = useState(0);

  const handleGenerateNfe = async () => {
    if (!blingOrderId) {
      toast.error("ID do pedido não disponível");
      return;
    }

    setNfeError(null);
    setNfeStage('creating');
    setPollingAttempt(0);

    try {
      // Simular delay visual para etapa de criação
      await new Promise(resolve => setTimeout(resolve, 500));
      setNfeStage('sending');

      const { data, error } = await supabase.functions.invoke('bling-generate-nfe', {
        body: { bling_order_id: blingOrderId }
      });

      if (error) throw error;

      // Verificar stage retornado
      const stage = data?.stage;

      if (data?.success === false) {
        // Extrair erro fiscal detalhado
        let errorMsg = data.fiscal_error || data.error || "Erro ao gerar NF-e";
        
        // Tentar extrair erros de campos específicos (validação do Bling)
        const rawData = data.raw;
        if (rawData?.error?.fields) {
          const fields = rawData.error.fields;
          let fieldsErrors: string[] = [];
          
          if (Array.isArray(fields)) {
            fieldsErrors = fields.map((f: any) => f?.msg || f?.message).filter(Boolean);
          } else if (typeof fields === 'object') {
            fieldsErrors = Object.entries(fields).map(([key, val]: [string, any]) => {
              const msg = typeof val === 'string' ? val : val?.msg || val?.message;
              return msg ? `${key}: ${msg}` : null;
            }).filter(Boolean) as string[];
          }
          
          if (fieldsErrors.length > 0) {
            errorMsg = fieldsErrors.join(' | ');
          }
        }
        
        // Verificar payload_error e fallback_error para erros combinados
        if (rawData?.payload_error?.error?.fields || rawData?.fallback_error?.error?.fields) {
          const payloadFields = rawData?.payload_error?.error?.fields;
          const fallbackFields = rawData?.fallback_error?.error?.fields;
          const allFields = payloadFields || fallbackFields;
          
          if (Array.isArray(allFields)) {
            const msgs = allFields.map((f: any) => f?.msg || f?.message).filter(Boolean);
            if (msgs.length > 0) errorMsg = msgs.join(' | ');
          }
        }
        
        console.error(`[NF-e] Erro na etapa '${stage}':`, errorMsg, data.raw);
        setNfeError(errorMsg);
        setNfeStage('error');
        return;
      }

      // Atualizar stage baseado na resposta
      if (stage === 'polling' || data?.nfe_pendente) {
        setNfeStage('polling');
        setPollingAttempt(data?.polling_attempts || 4);
        toast.info("NF-e ainda em processamento. Clique novamente em alguns segundos.");
        return;
      }

      if (data?.nfe_url || stage === 'authorized') {
        setNfeUrl(data.nfe_url);
        setNfeStage('authorized');
        toast.success("NF-e autorizada com sucesso!");
        return;
      }

      // Fallback para pendente
      setNfeStage('polling');
      toast.info(data.message || "NF-e em processamento...");

    } catch (err: any) {
      console.error("Erro ao gerar NF-e:", err);
      setNfeError("Erro de conexão: " + (err.message || "Tente novamente"));
      setNfeStage('error');
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

  const isProcessing = ['creating', 'sending', 'polling'].includes(nfeStage);

  const getCardBorderColor = () => {
    switch (nfeStage) {
      case 'authorized': return 'border-green-500';
      case 'error': return 'border-destructive';
      case 'creating':
      case 'sending':
      case 'polling':
        return 'border-primary';
      default: return 'border-border';
    }
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

          {/* Seção de NF-e - Card com borda colorida */}
          <div className={cn(
            "border-2 rounded-lg p-4 space-y-4 transition-colors",
            getCardBorderColor()
          )}>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-medium">Central de Comando Fiscal</span>
            </div>

            {/* Estado IDLE - Botão inicial */}
            {nfeStage === 'idle' && (
              <>
                <p className="text-sm text-muted-foreground">
                  Clique para gerar e transmitir a NF-e para a SEFAZ.
                </p>
                <Button
                  onClick={handleGenerateNfe}
                  className="w-full"
                  variant="default"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar e Transmitir NF-e
                </Button>
              </>
            )}

            {/* Estados de processamento - Stepper visual */}
            {isProcessing && (
              <div className="space-y-3">
                {STEPS.map((step, index) => {
                  const status = getStepStatus(step.key, nfeStage);
                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      {/* Ícone do status */}
                      <div className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-full",
                        status === 'completed' && "bg-green-500 text-white",
                        status === 'active' && "bg-primary text-primary-foreground",
                        status === 'pending' && "bg-muted text-muted-foreground",
                        status === 'error' && "bg-destructive text-destructive-foreground"
                      )}>
                        {status === 'completed' && <Check className="h-4 w-4" />}
                        {status === 'active' && <Loader2 className="h-4 w-4 animate-spin" />}
                        {status === 'pending' && <Circle className="h-3 w-3" />}
                        {status === 'error' && <AlertCircle className="h-4 w-4" />}
                      </div>
                      
                      {/* Texto do step */}
                      <div className="flex-1">
                        <span className={cn(
                          "text-sm",
                          status === 'completed' && "text-green-600 dark:text-green-400",
                          status === 'active' && "text-foreground font-medium",
                          status === 'pending' && "text-muted-foreground",
                          status === 'error' && "text-destructive"
                        )}>
                          Etapa {index + 1}/3: {step.label}
                          {status === 'active' && step.key === 'polling' && pollingAttempt > 0 && (
                            <span className="text-muted-foreground ml-1">
                              (tentativa {pollingAttempt}/4)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Estado AUTHORIZED - Sucesso */}
            {nfeStage === 'authorized' && nfeUrl && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">NF-e Autorizada com sucesso!</span>
                </div>
                <Button
                  onClick={handlePrintDanfe}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Imprimir DANFE
                </Button>
              </div>
            )}

            {/* Estado POLLING pendente (após tentativas) */}
            {nfeStage === 'polling' && !isProcessing && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <RefreshCw className="h-5 w-5" />
                  <span className="font-medium">NF-e em processamento</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  A SEFAZ ainda está processando. Aguarde alguns segundos e tente novamente.
                </p>
                <Button
                  onClick={handleGenerateNfe}
                  className="w-full"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verificar Novamente
                </Button>
              </div>
            )}

            {/* Estado ERROR - Erro com detalhes */}
            {nfeStage === 'error' && (
              <div className="space-y-3">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <span className="font-medium">Erro na emissão</span>
                  </div>
                  <p className="text-sm text-destructive/90 break-words">
                    {nfeError}
                  </p>
                </div>
                <Button
                  onClick={handleGenerateNfe}
                  className="w-full"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
              </div>
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
