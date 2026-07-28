import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface PreviewMensagemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensagem: string;
  titulo?: string;
  descricao?: string;
}

/**
 * Mostra um preview editável da mensagem antes de copiar para a área de
 * transferência. O usuário pode ajustar o texto antes de copiar.
 */
export function PreviewMensagemDialog({
  open,
  onOpenChange,
  mensagem,
  titulo = "Preview da mensagem",
  descricao = "Revise o texto abaixo antes de copiar. Você pode editar se precisar.",
}: PreviewMensagemDialogProps) {
  const [texto, setTexto] = useState(mensagem);

  useEffect(() => {
    if (open) setTexto(mensagem);
  }, [open, mensagem]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Mensagem copiada!");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao copiar mensagem");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={16}
          className="font-mono text-sm whitespace-pre-wrap"
        />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar mensagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
