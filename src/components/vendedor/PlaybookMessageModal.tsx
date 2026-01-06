import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface PlaybookMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  message: string;
  readOnly?: boolean;
}

export function PlaybookMessageModal({
  open,
  onOpenChange,
  title,
  description,
  message,
  readOnly = false,
}: PlaybookMessageModalProps) {
  const [copied, setCopied] = useState(false);
  const [editedMessage, setEditedMessage] = useState(message);

  // Reset edited message when modal opens with new message
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setEditedMessage(message);
      setCopied(false);
    }
    onOpenChange(newOpen);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedMessage);
      setCopied(true);
      toast.success("Mensagem copiada para a área de transferência!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erro ao copiar mensagem");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Textarea
            value={editedMessage}
            onChange={(e) => !readOnly && setEditedMessage(e.target.value)}
            readOnly={readOnly}
            className="min-h-[200px] resize-none font-mono text-sm whitespace-pre-wrap"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
          <Button onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copiar Mensagem
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
