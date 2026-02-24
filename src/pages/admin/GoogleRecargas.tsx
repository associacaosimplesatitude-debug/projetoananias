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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TopupPixModal } from "@/components/google/TopupPixModal";
import { Wallet, Plus, Copy, Eye, EyeOff, CheckCircle, XCircle, Upload, Loader2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  SOLICITADA: "bg-blue-100 text-blue-800",
  AGUARDANDO_CODIGO_PIX: "bg-yellow-100 text-yellow-800",
  PIX_DISPONIVEL: "bg-green-100 text-green-800",
  AGUARDANDO_PAGAMENTO: "bg-orange-100 text-orange-800",
  PAGO_EM_CONFERENCIA: "bg-purple-100 text-purple-800",
  CONFIRMADO: "bg-emerald-100 text-emerald-800",
  CANCELADO: "bg-red-100 text-red-800",
  EXPIRADO: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  SOLICITADA: "Solicitada",
  AGUARDANDO_CODIGO_PIX: "Aguardando PIX",
  PIX_DISPONIVEL: "PIX Disponível",
  AGUARDANDO_PAGAMENTO: "Aguardando Pagamento",
  PAGO_EM_CONFERENCIA: "Pago (em conferência)",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
};

export default function GoogleRecargas() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "admin";

  const [statusFilter, setStatusFilter] = useState("all");
  const [requestOpen, setRequestOpen] = useState(false);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [selectedTopupId, setSelectedTopupId] = useState("");
  const [showPixMap, setShowPixMap] = useState<Record<string, boolean>>({});

  // Request form
  const [reqAmount, setReqAmount] = useState("");
  const [reqDate, setReqDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [reqLoading, setReqLoading] = useState(false);

  // Query para buscar saldo real do Google Ads via API
  const { data: saldo = 0, isLoading: saldoLoading } = useQuery({
    queryKey: ["google-ads-saldo"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-ads-dashboard", {
        body: { action: "balance" },
      });
      if (error) {
        console.error("Erro ao buscar saldo Google Ads:", error);
        return 0;
      }
      return data?.balance ?? 0;
    },
    retry: 1,
    staleTime: 60_000,
  });

  const { data: settings } = useQuery({
    queryKey: ["system-settings-customer-id-topups"],
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

  const { data: topups = [], isLoading } = useQuery({
    queryKey: ["google-topups", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("google_ads_topups")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["google-topups"] });

  const handleRequest = async () => {
    if (!reqAmount || parseFloat(reqAmount) <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!customerId) {
      toast.error("Configure o Customer ID nas Integrações do Google Ads");
      return;
    }
    setReqLoading(true);
    try {
      const { error } = await supabase.from("google_ads_topups").insert({
        customer_id: customerId,
        requested_by: user?.id,
        requested_amount: parseFloat(reqAmount),
        requested_at: reqDate,
        status: "AGUARDANDO_CODIGO_PIX",
      } as any);
      if (error) throw error;
      toast.success("Recarga solicitada! Código PIX disponível em até 3 horas.");
      setRequestOpen(false);
      setReqAmount("");
      setReqDate(new Date().toISOString().split("T")[0]);
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReqLoading(false);
    }
  };

  const handleCopyPix = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código PIX copiado!");
  };

  const handleMarkPaid = async (topup: any) => {
    try {
      const { error } = await supabase
        .from("google_ads_topups")
        .update({
          status: "PAGO_EM_CONFERENCIA",
          paid_marked_by: user?.id,
          paid_marked_at: new Date().toISOString(),
          updated_by: user?.id,
        } as any)
        .eq("id", topup.id);
      if (error) throw error;
      toast.success("Marcado como pago. Aguardando confirmação do Admin.");
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleConfirm = async (topup: any) => {
    try {
      const { error } = await supabase
        .from("google_ads_topups")
        .update({
          status: "CONFIRMADO",
          updated_by: user?.id,
        } as any)
        .eq("id", topup.id);
      if (error) throw error;
      toast.success("Recarga confirmada!");
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCancel = async (topup: any) => {
    try {
      const { error } = await supabase
        .from("google_ads_topups")
        .update({
          status: "CANCELADO",
          updated_by: user?.id,
        } as any)
        .eq("id", topup.id);
      if (error) throw error;
      toast.success("Recarga cancelada");
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleShowPix = (id: string) => {
    setShowPixMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskPix = (code: string) => {
    if (code.length <= 10) return "••••••••";
    return code.slice(0, 6) + "••••••" + code.slice(-4);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="space-y-6">
      {/* Saldo Card */}
      <Card className="bg-primary text-primary-foreground border-0">
        <CardContent className="pt-6 pb-6 flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Saldo Atual (Google Ads)</p>
            <p className="text-4xl font-bold mt-1">
              {saldoLoading ? <Loader2 className="h-8 w-8 animate-spin inline" /> : formatCurrency(saldo)}
            </p>
          </div>
          <Button variant="secondary" size="lg" onClick={() => setRequestOpen(true)}>
            <Plus className="h-5 w-5 mr-2" /> Adicionar Saldo
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Recargas (PIX) — Google Ads
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Solicitações de recarga via PIX</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4">
            <div className="w-52">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
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
          <CardTitle className="text-lg">Recargas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : topups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma recarga encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PIX</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topups.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">
                      {new Date(t.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(t.requested_amount)}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[t.status] || ""}>{STATUS_LABELS[t.status] || t.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {t.pix_code ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">
                            {showPixMap[t.id] ? t.pix_code : maskPix(t.pix_code)}
                          </span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => toggleShowPix(t.id)}>
                            {showPixMap[t.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleCopyPix(t.pix_code)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Admin: inserir PIX */}
                        {isAdmin && t.status === "AGUARDANDO_CODIGO_PIX" && (
                          <Button size="sm" variant="outline" onClick={() => { setSelectedTopupId(t.id); setPixModalOpen(true); }}>
                            Inserir PIX
                          </Button>
                        )}
                        {/* Financeiro/todos: marcar como pago */}
                        {(t.status === "PIX_DISPONIVEL" || t.status === "AGUARDANDO_PAGAMENTO") && (
                          <Button size="sm" onClick={() => handleMarkPaid(t)}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Marcar Pago
                          </Button>
                        )}
                        {/* Admin: confirmar */}
                        {isAdmin && t.status === "PAGO_EM_CONFERENCIA" && (
                          <Button size="sm" onClick={() => handleConfirm(t)}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Confirmar
                          </Button>
                        )}
                        {/* Pago em conferência - financeiro */}
                        {!isAdmin && t.status === "PAGO_EM_CONFERENCIA" && (
                          <span className="text-xs text-muted-foreground">Aguardando confirmação</span>
                        )}
                        {/* Admin: cancelar */}
                        {isAdmin && !["CONFIRMADO", "CANCELADO", "EXPIRADO"].includes(t.status) && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleCancel(t)}>
                            <XCircle className="h-3 w-3 mr-1" /> Cancelar
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

      {/* Request Modal */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Recarga</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" value={reqAmount} onChange={e => setReqAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Data *</Label>
              <Input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancelar</Button>
            <Button onClick={handleRequest} disabled={reqLoading}>
              {reqLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Solicitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIX Modal (Admin) */}
      <TopupPixModal
        open={pixModalOpen}
        onOpenChange={setPixModalOpen}
        topupId={selectedTopupId}
        onSuccess={refresh}
      />
    </div>
  );
}
