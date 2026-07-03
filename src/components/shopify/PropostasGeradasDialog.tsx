import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";

export interface PropostaGerada {
  token: string;
  link: string;
  depositoNome: string;
  totalItens: number;
  cepOrigem: string | null;
}

interface PropostasGeradasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteNome: string;
  propostas: PropostaGerada[];
  onClose: () => void;
}

/**
 * Mostrado após o vendedor confirmar um pedido que foi dividido em
 * múltiplas propostas (uma por depósito).
 */
export function PropostasGeradasDialog({
  open,
  onOpenChange,
  clienteNome,
  propostas,
  onClose,
}: PropostasGeradasDialogProps) {
  const isSplit = propostas.length > 1;

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado!");
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  const copyAll = async () => {
    const text = propostas
      .map(
        (p) =>
          `Depósito ${p.depositoNome} — ${p.totalItens} un.\n${p.link}`,
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Todos os links copiados!");
    } catch {
      toast.error("Erro ao copiar links");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {isSplit
              ? `${propostas.length} propostas geradas`
              : "Proposta gerada"}
          </DialogTitle>
          <DialogDescription>
            Cliente: <b>{clienteNome}</b>
            {isSplit && (
              <>
                <br />
                O pedido foi <b>dividido por depósito</b>. Envie os {propostas.length}{" "}
                links ao cliente — cada um traz o frete calculado a partir da
                origem correspondente.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 max-h-96 overflow-y-auto">
          {propostas.map((p, idx) => (
            <div
              key={p.token}
              className="rounded-md border p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Proposta {idx + 1} — {p.depositoNome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.totalItens} un.
                    {p.cepOrigem ? ` · Origem CEP ${p.cepOrigem}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted rounded px-2 py-1 truncate">
                  {p.link}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyLink(p.link)}
                  title="Copiar link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => window.open(p.link, "_blank")}
                  title="Abrir proposta"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          {isSplit && (
            <Button variant="outline" onClick={copyAll}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar todos
            </Button>
          )}
          <Button
            onClick={() => {
              onClose();
              onOpenChange(false);
            }}
          >
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
