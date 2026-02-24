import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

interface InvoiceUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: any;
  customerId: string;
  onSuccess: () => void;
  mode?: 'create' | 'replace';
}

export function InvoiceUploadModal({ open, onOpenChange, invoice, customerId, onSuccess, mode = 'create' }: InvoiceUploadModalProps) {
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoice_number || "");
  const [issueDate, setIssueDate] = useState(invoice?.issue_date || "");
  const [amount, setAmount] = useState(invoice?.amount?.toString() || "");
  const [notes, setNotes] = useState(invoice?.notes || "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!file && mode === 'create') {
      toast.error("Selecione um arquivo PDF");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      let pdfUrl = invoice?.pdf_url || null;
      let pdfFilename = invoice?.pdf_filename || null;

      if (file) {
        const month = invoice?.competencia_month || new Date().getMonth() + 1;
        const year = invoice?.competencia_year || new Date().getFullYear();
        const path = `invoices/${customerId}/${year}-${String(month).padStart(2, '0')}/${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('google_docs')
          .upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('google_docs').getPublicUrl(path);
        pdfUrl = urlData.publicUrl;
        pdfFilename = file.name;
      }

      if (invoice?.id) {
        const { error } = await supabase
          .from('google_ads_invoices')
          .update({
            invoice_number: invoiceNumber || null,
            issue_date: issueDate || null,
            amount: amount ? parseFloat(amount) : null,
            notes: notes || null,
            pdf_url: pdfUrl,
            pdf_filename: pdfFilename,
            status: mode === 'replace' ? 'GERADA' : 'EM_VALIDACAO',
            updated_by: user.id,
          } as any)
          .eq('id', invoice.id);
        if (error) throw error;
      }

      toast.success(mode === 'replace' ? "Arquivo substituído com sucesso" : "Nota fiscal enviada com sucesso");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar nota fiscal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'replace' ? 'Substituir Arquivo' : 'Upload Nota Fiscal'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Número da Nota</Label>
            <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ex: 36031372" />
          </div>
          <div>
            <Label>Data de Emissão</Label>
            <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <Label>Arquivo PDF</Label>
            <Input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações opcionais..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            {mode === 'replace' ? 'Substituir' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
