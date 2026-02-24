import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

interface InvoiceUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: any;
  customerId: string;
  onSuccess: () => void;
  mode?: 'create' | 'replace' | 'edit';
}

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(2000, i).toLocaleString("pt-BR", { month: "long" }),
}));

export function InvoiceUploadModal({ open, onOpenChange, invoice, customerId, onSuccess, mode = 'create' }: InvoiceUploadModalProps) {
  const isNewInvoice = !invoice;
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoice_number || "");
  const [issueDate, setIssueDate] = useState(invoice?.issue_date || "");
  const [amount, setAmount] = useState(invoice?.amount?.toString() || "");
  const [notes, setNotes] = useState(invoice?.notes || "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  const handleSubmit = async () => {
    if (!file && isNewInvoice) {
      toast.error("Selecione um arquivo PDF");
      return;
    }
    if (isNewInvoice && !customerId) {
      toast.error("Configure o Customer ID nas Integrações do Google Ads");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      let pdfUrl = invoice?.pdf_url || null;
      let pdfFilename = invoice?.pdf_filename || null;

      const month = isNewInvoice ? parseInt(selectedMonth) : (invoice?.competencia_month || new Date().getMonth() + 1);
      const year = isNewInvoice ? parseInt(selectedYear) : (invoice?.competencia_year || new Date().getFullYear());

      if (file) {
        const path = `invoices/${customerId}/${year}-${String(month).padStart(2, '0')}/${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('google_docs')
          .upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;

        pdfUrl = path;
        pdfFilename = file.name;
      }

      if (isNewInvoice) {
        // INSERT new record
        const { error } = await supabase
          .from('google_ads_invoices')
          .insert({
            competencia_month: month,
            competencia_year: year,
            customer_id: customerId,
            invoice_number: invoiceNumber || null,
            issue_date: issueDate || null,
            amount: amount ? parseFloat(amount) : null,
            notes: notes || null,
            pdf_url: pdfUrl,
            pdf_filename: pdfFilename,
            status: 'EM_VALIDACAO',
            created_by: user.id,
          } as any);
        if (error) {
          if (error.code === '23505') {
            toast.error("Já existe uma nota para esta competência");
            return;
          }
          throw error;
        }
      } else {
        // UPDATE existing record
        const { error } = await supabase
          .from('google_ads_invoices')
          .update({
            invoice_number: invoiceNumber || null,
            issue_date: issueDate || null,
            amount: amount ? parseFloat(amount) : null,
            notes: notes || null,
            pdf_url: pdfUrl,
            pdf_filename: pdfFilename,
            ...(mode !== 'edit' ? { status: mode === 'replace' ? 'GERADA' : 'EM_VALIDACAO' } : {}),
            updated_by: user.id,
          } as any)
          .eq('id', invoice.id);
        if (error) throw error;
      }

      toast.success(isNewInvoice ? "Nota fiscal criada com sucesso" : mode === 'edit' ? "Nota fiscal atualizada com sucesso" : mode === 'replace' ? "Arquivo substituído com sucesso" : "Nota fiscal enviada com sucesso");
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
          <DialogTitle>
            {isNewInvoice ? 'Upload Nota Fiscal' : mode === 'edit' ? 'Editar Nota Fiscal' : mode === 'replace' ? 'Substituir Arquivo' : 'Upload Nota Fiscal'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isNewInvoice && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mês</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
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
            {isNewInvoice ? 'Criar e Enviar' : mode === 'edit' ? 'Salvar' : mode === 'replace' ? 'Substituir' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
