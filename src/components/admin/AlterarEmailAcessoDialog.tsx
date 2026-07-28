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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AlterarEmailAcessoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: { id: string; nome_igreja: string; email_superintendente: string | null } | null;
  onSuccess?: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function AlterarEmailAcessoDialog({
  open,
  onOpenChange,
  cliente,
  onSuccess,
}: AlterarEmailAcessoDialogProps) {
  const [novoEmail, setNovoEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setNovoEmail("");
  }, [open, cliente?.id]);

  const handleSave = async () => {
    const email = novoEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      toast.error("Informe um email válido");
      return;
    }
    if (email === (cliente?.email_superintendente || "").toLowerCase()) {
      toast.error("O novo email é igual ao atual");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-cliente-email", {
        body: { cliente_id: cliente?.id, novo_email: email },
      });

      if (error) {
        const ctx = (error as { context?: Response }).context;
        let msg = error.message;
        try {
          const parsed = await ctx?.json();
          if (parsed?.error) msg = parsed.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      toast.success("Email de acesso atualizado com sucesso");
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar email");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar email de acesso</DialogTitle>
          <DialogDescription>
            {cliente?.nome_igreja} — o email de login do cliente será atualizado em todo o sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email atual</Label>
            <Input value={cliente?.email_superintendente || "—"} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="novo-email">Novo email</Label>
            <Input
              id="novo-email"
              type="email"
              autoComplete="off"
              placeholder="novo@email.com"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
