import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Wallet,
  ExternalLink,
  FileText,
  Download,
  AlertTriangle,
  RefreshCw,
  BarChart3,
} from "lucide-react";

interface Metrics {
  conversions_value: number;
  clicks: number;
  cost: number;
  impressions: number;
  conversions: number;
  average_cpc: number;
}

interface Balance {
  approved_limit: number;
  amount_served: number;
  remaining: number;
  status: string;
}

interface Invoice {
  id: string;
  type: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  total: number;
  pdf_url: string | null;
}

const LOW_BALANCE_THRESHOLD = 50;

function MetricCard({
  label,
  value,
  subtitle,
  variant,
  loading,
}: {
  label: string;
  value: string;
  subtitle?: string;
  variant: "blue" | "red" | "gray";
  loading: boolean;
}) {
  const bg =
    variant === "blue"
      ? "bg-blue-600 text-white"
      : variant === "red"
        ? "bg-red-600 text-white"
        : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100";

  const subtitleColor =
    variant === "blue" || variant === "red"
      ? "text-white/70"
      : "text-muted-foreground";

  return (
    <div className={`rounded-xl p-4 ${bg}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${variant === "blue" || variant === "red" ? "text-white/80" : "text-muted-foreground"}`}>
        {label}
      </p>
      {loading ? (
        <Skeleton className={`h-8 w-24 mt-1 ${variant === "blue" || variant === "red" ? "bg-white/20" : ""}`} />
      ) : (
        <>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className={`text-xs mt-0.5 ${subtitleColor}`}>{subtitle}</p>}
        </>
      )}
    </div>
  );
}

export default function GoogleAdsPanel() {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  // Default to previous month for invoices
  const prevMonth = new Date();
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const defaultInvoiceMonth = (prevMonth.getMonth() + 1).toString().padStart(2, "0");
  const defaultInvoiceYear = prevMonth.getFullYear().toString();

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [invoiceMonth, setInvoiceMonth] = useState(defaultInvoiceMonth);
  const [invoiceYear, setInvoiceYear] = useState(defaultInvoiceYear);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  async function callEdge(action: string, extra?: Record<string, string>) {
    const res = await supabase.functions.invoke("google-ads-data", {
      body: { action, ...extra },
    });
    if (res.error) throw res.error;
    if (!res.data?.success) throw new Error(res.data?.error || "Erro desconhecido");
    return res.data.data;
  }

  async function fetchMetrics() {
    setLoadingMetrics(true);
    try {
      const data = await callEdge("metrics", { start: startDate, end: endDate });
      setMetrics(data);
    } catch {
      toast.error("Erro ao carregar métricas do Google Ads");
    } finally {
      setLoadingMetrics(false);
    }
  }

  async function fetchBalance() {
    setLoadingBalance(true);
    try {
      const data = await callEdge("balance");
      setBalance(data);
    } catch {
      toast.error("Erro ao carregar saldo");
    } finally {
      setLoadingBalance(false);
    }
  }

  async function fetchInvoices(month?: string, year?: string) {
    setLoadingInvoices(true);
    try {
      const data = await callEdge("invoices", {
        year: year || invoiceYear,
        month: month || invoiceMonth,
      });
      setInvoices(data || []);
    } catch {
      toast.error("Erro ao carregar documentos fiscais");
    } finally {
      setLoadingInvoices(false);
    }
  }

  async function fetchAll() {
    await Promise.all([fetchMetrics(), fetchBalance(), fetchInvoices()]);
    setInitialLoad(false);
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fmtNum = (v: number) => v.toLocaleString("pt-BR");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Google Ads</h1>
          <p className="text-muted-foreground">
            Métricas, saldo e documentos fiscais da sua conta Google Ads.
          </p>
        </div>
        <Button onClick={fetchAll} disabled={loadingMetrics || loadingBalance || loadingInvoices}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar Tudo
        </Button>
      </div>

      {/* Low balance alert */}
      {balance && balance.remaining < LOW_BALANCE_THRESHOLD && balance.status !== "NO_BUDGET" && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Saldo baixo!</p>
            <p className="text-sm text-muted-foreground">
              Seu saldo restante é {fmt(balance.remaining)}. Adicione fundos para evitar pausas nas campanhas.
            </p>
          </div>
        </div>
      )}

      {/* Metrics Cards - Google Ads style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Valor conv."
          value={metrics ? fmt(metrics.conversions_value) : "—"}
          subtitle={metrics ? `${metrics.conversions.toFixed(0)} conversões` : undefined}
          variant="blue"
          loading={initialLoad && loadingMetrics}
        />
        <MetricCard
          label="Cliques"
          value={metrics ? fmtNum(metrics.clicks) : "—"}
          subtitle={metrics ? `${fmtNum(metrics.impressions)} impressões` : undefined}
          variant="red"
          loading={initialLoad && loadingMetrics}
        />
        <MetricCard
          label="CPC méd."
          value={metrics ? fmt(metrics.average_cpc) : "—"}
          variant="gray"
          loading={initialLoad && loadingMetrics}
        />
        <MetricCard
          label="Custo"
          value={metrics ? fmt(metrics.cost) : "—"}
          variant="gray"
          loading={initialLoad && loadingMetrics}
        />
      </div>

      {/* Date filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>Data Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label>Data Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-44" />
            </div>
            <Button onClick={fetchMetrics} disabled={loadingMetrics}>
              {loadingMetrics ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BarChart3 className="h-4 w-4 mr-2" />}
              Buscar Métricas
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Balance + Add Funds */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-5 w-5" /> Saldo da Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingBalance && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {balance && !loadingBalance && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Limite aprovado</span>
                  <span className="font-medium">{fmt(balance.approved_limit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Gasto</span>
                  <span className="font-medium">{fmt(balance.amount_served)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-semibold">Restante</span>
                  <span className={`font-bold text-lg ${balance.remaining < LOW_BALANCE_THRESHOLD ? "text-destructive" : "text-green-600"}`}>
                    {fmt(balance.remaining)}
                  </span>
                </div>
                <Badge variant={balance.status === "APPROVED" ? "default" : "secondary"}>
                  {balance.status}
                </Badge>
              </div>
            )}
            {!balance && !loadingBalance && (
              <p className="text-sm text-muted-foreground">Nenhum dado de saldo disponível.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ExternalLink className="h-5 w-5" /> Adicionar Fundos
            </CardTitle>
            <CardDescription>
              Adicione créditos diretamente na sua conta Google Ads.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="https://ads.google.com/aw/billing/payments"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background hover:bg-accent hover:text-accent-foreground"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir Faturamento Google Ads
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" /> Documentos Fiscais
            </CardTitle>
          </div>
          <CardDescription>Selecione o mês e ano para buscar notas fiscais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Mês</Label>
              <Select value={invoiceMonth} onValueChange={setInvoiceMonth}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="01">Janeiro</SelectItem>
                  <SelectItem value="02">Fevereiro</SelectItem>
                  <SelectItem value="03">Março</SelectItem>
                  <SelectItem value="04">Abril</SelectItem>
                  <SelectItem value="05">Maio</SelectItem>
                  <SelectItem value="06">Junho</SelectItem>
                  <SelectItem value="07">Julho</SelectItem>
                  <SelectItem value="08">Agosto</SelectItem>
                  <SelectItem value="09">Setembro</SelectItem>
                  <SelectItem value="10">Outubro</SelectItem>
                  <SelectItem value="11">Novembro</SelectItem>
                  <SelectItem value="12">Dezembro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ano</Label>
              <Select value={invoiceYear} onValueChange={setInvoiceYear}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => fetchInvoices()} disabled={loadingInvoices} size="sm">
              {loadingInvoices ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Buscar
            </Button>
          </div>

          {invoices.length === 0 && !loadingInvoices ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum documento encontrado para {invoiceMonth}/{invoiceYear}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.issue_date || "—"}</TableCell>
                    <TableCell>{inv.type || "—"}</TableCell>
                    <TableCell>{inv.due_date || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(inv.total)}</TableCell>
                    <TableCell className="text-right">
                      {inv.pdf_url ? (
                        <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                          <Download className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
