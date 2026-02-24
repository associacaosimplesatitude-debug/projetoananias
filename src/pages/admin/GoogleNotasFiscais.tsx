import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoiceUploadModal } from "@/components/google/InvoiceUploadModal";
import { FileText, Upload, Download, CheckCircle, Plus, Loader2, Pencil } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: "bg-yellow-100 text-yellow-800 border-yellow-300",
  EM_VALIDACAO: "bg-blue-100 text-blue-800 border-blue-300",
  GERADA: "bg-green-100 text-green-800 border-green-300",
  SUBSTITUIDA: "bg-orange-100 text-orange-800 border-orange-300",
  CANCELADA: "bg-red-100 text-red-800 border-red-300",
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
  { value: "0", label: "Todos" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i).toLocaleString("pt-BR", { month: "long" }),
  })),
];

export default function GoogleNotasFiscais() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "admin";
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState("0");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [uploadMode, setUploadMode] = useState<'create' | 'replace' | 'edit'>('create');
  const [creatingPending, setCreatingPending] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["system-settings-customer-id"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["google_ads_customer_id"]);
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  const customerId = settings?.google_ads_customer_id || "";

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["google-invoices", selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase
        .from("google_ads_invoices")
        .select("*")
        .eq("competencia_year", parseInt(selectedYear))
        .order("competencia_month", { ascending: false });

      if (selectedMonth !== "0") {
        query = query.eq("competencia_month", parseInt(selectedMonth));
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const handleCreatePending = async () => {
    if (!customerId) {
      toast.error("Configure o Customer ID nas Integrações do Google Ads");
      return;
    }
    setCreatingPending(true);
    try {
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      const { error } = await supabase.from("google_ads_invoices").insert({
        competencia_month: month,
        competencia_year: year,
        customer_id: customerId,
        status: "PENDENTE",
        created_by: user?.id,
      } as any);
      if (error) {
        if (error.code === "23505") {
          toast.info("Pendência já existe para este mês");
        } else throw error;
      } else {
        toast.success("Pendência criada para o mês atual");
        queryClient.invalidateQueries({ queryKey: ["google-invoices"] });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingPending(false);
    }
  };

  const handleApprove = async (invoice: any) => {
    const { error } = await supabase
      .from("google_ads_invoices")
      .update({ status: "GERADA", updated_by: user?.id } as any)
      .eq("id", invoice.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Nota aprovada e liberada");
      queryClient.invalidateQueries({ queryKey: ["google-invoices"] });
    }
  };

  const handleDownload = async (invoice: any) => {
    if (!invoice.pdf_url) return;
    try {
      // Support both old format (full public URL) and new format (relative path)
      let path = invoice.pdf_url;
      const publicMatch = invoice.pdf_url.match(/\/object\/public\/google_docs\/(.+)$/);
      if (publicMatch) {
        path = decodeURIComponent(publicMatch[1]);
      }
      
      const { data, error } = await supabase.storage
        .from("google_docs")
        .createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) throw error || new Error("Falha ao gerar URL");
      
      // Download via fetch+blob to avoid ad blocker interference
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error("Falha ao baixar arquivo");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = invoice.invoice_number ? `NF-${invoice.invoice_number}.pdf` : "nota-fiscal.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      toast.error("Erro ao baixar PDF: " + (err.message || "tente novamente"));
    }
  };

  const openUpload = (invoice: any, mode: 'create' | 'replace' | 'edit') => {
    setSelectedInvoice(invoice);
    setUploadMode(mode);
    setUploadOpen(true);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Notas Fiscais — Google Ads
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão de notas fiscais do Google Ads
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button onClick={handleCreatePending} disabled={creatingPending}>
                {creatingPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Criar Pendência do Mês
              </Button>
              <Button variant="outline" onClick={() => { setSelectedInvoice(null); setUploadMode('create'); setUploadOpen(true); }}>
                <Upload className="h-4 w-4 mr-2" /> Upload Nota
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4">
            <div className="w-32">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notas Fiscais</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma nota fiscal encontrada para o período selecionado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Nº Nota</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      {String(inv.competencia_month).padStart(2, "0")}/{inv.competencia_year}
                    </TableCell>
                    <TableCell>{inv.invoice_number || "—"}</TableCell>
                    <TableCell>
                      {inv.amount != null
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(inv.amount)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[inv.status] || ""}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {inv.status === "GERADA" && inv.pdf_url && (
                          <Button size="sm" variant="outline" onClick={() => handleDownload(inv)}>
                            <Download className="h-3 w-3 mr-1" /> PDF
                          </Button>
                        )}
                        {inv.status === "PENDENTE" && !isAdmin && (
                          <span className="text-xs text-muted-foreground">Aguardando emissão do Google Ads</span>
                        )}
                        {isAdmin && inv.status === "PENDENTE" && (
                          <Button size="sm" variant="outline" onClick={() => openUpload(inv, 'create')}>
                            <Upload className="h-3 w-3 mr-1" /> Upload
                          </Button>
                        )}
                        {isAdmin && inv.status === "EM_VALIDACAO" && (
                          <Button size="sm" onClick={() => handleApprove(inv)}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Aprovar
                          </Button>
                        )}
                        {isAdmin && (inv.status === "GERADA" || inv.status === "EM_VALIDACAO") && (
                          <Button size="sm" variant="ghost" onClick={() => openUpload(inv, 'replace')}>
                            Substituir
                          </Button>
                        )}
                        {isAdmin && inv.status !== "CANCELADA" && (
                          <Button size="sm" variant="ghost" onClick={() => openUpload(inv, 'edit')}>
                            <Pencil className="h-3 w-3 mr-1" /> Editar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InvoiceUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        invoice={selectedInvoice}
        customerId={customerId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["google-invoices"] })}
        mode={uploadMode}
      />
    </div>
  );
}
