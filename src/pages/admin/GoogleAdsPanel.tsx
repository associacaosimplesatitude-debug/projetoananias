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

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
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

  async function fetchInvoices() {
    setLoadingInvoices(true);
    try {
      const now = new Date();
      const data = await callEdge("invoices", {
        year: now.getFullYear().toString(),
        month: (now.getMonth() + 1).toString().padStart(2, "0"),
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
            <Button
              variant="outline"
              onClick={() => window.open("https://ads.google.com/aw/billing/payments", "_blank")}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir Faturamento Google Ads
            </Button>
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
            <Button variant="outline" size="sm" onClick={fetchInvoices} disabled={loadingInvoices}>
              {loadingInvoices ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
          <CardDescription>Notas fiscais emitidas pelo Google Ads no mês atual.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 && !loadingInvoices ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum documento encontrado.
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
                        <Button size="sm" variant="ghost" onClick={() => window.open(inv.pdf_url!, "_blank")}>
                          <Download className="h-4 w-4" />
                        </Button>
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
