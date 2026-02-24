import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, QrCode } from "lucide-react";

interface TopupPixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topupId: string;
  onSuccess: () => void;
}

export function TopupPixModal({ open, onOpenChange, topupId, onSuccess }: TopupPixModalProps) {
  const [pixCode, setPixCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!pixCode.trim()) {
      toast.error("Informe o código PIX");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      let qrUrl: string | null = null;
      if (qrFile) {
        const path = `topups/${topupId}/qr-${qrFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('google_docs')
          .upload(path, qrFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('google_docs').getPublicUrl(path);
        qrUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from('google_ads_topups')
        .update({
          pix_code: pixCode,
          pix_qr_url: qrUrl,
          pix_expires_at: expiresAt || null,
          status: 'PIX_DISPONIVEL',
          provided_by: user.id,
          provided_at: new Date().toISOString(),
          updated_by: user.id,
        } as any)
        .eq('id', topupId);
      if (error) throw error;

      toast.success("PIX inserido com sucesso");
      onSuccess();
      onOpenChange(false);
      setPixCode("");
      setExpiresAt("");
      setQrFile(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao inserir PIX");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Inserir Código PIX
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Código PIX (Copia e Cola)</Label>
            <Input
              value={pixCode}
              onChange={e => setPixCode(e.target.value)}
              placeholder="Cole o código PIX aqui..."
              className="font-mono text-sm"
            />
          </div>
          <div>
            <Label>Expiração (opcional)</Label>
            <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </div>
          <div>
            <Label>QR Code (imagem, opcional)</Label>
            <Input type="file" accept="image/*" onChange={e => setQrFile(e.target.files?.[0] || null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
            Salvar PIX
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
