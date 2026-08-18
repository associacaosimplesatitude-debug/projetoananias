import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";

const PERIODS = [
  { label: "Hoje", key: "today" },
  { label: "Ontem", key: "yesterday" },
  { label: "7 dias", key: "7d" },
  { label: "30 dias", key: "30d" },
  { label: "Mês atual", key: "month" },
  { label: "Todo o período", key: "all" },
  { label: "Personalizado", key: "custom" },
] as const;

function getDateRange(period: string, customStart?: string, customEnd?: string) {
  const today = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");

  switch (period) {
    case "today": return { startDate: fmt(today), endDate: fmt(today) };
    case "yesterday": { const y = subDays(today, 1); return { startDate: fmt(y), endDate: fmt(y) }; }
    case "7d": return { startDate: fmt(subDays(today, 6)), endDate: fmt(today) };
    case "30d": return { startDate: fmt(subDays(today, 29)), endDate: fmt(today) };
    case "month": return { startDate: fmt(startOfMonth(today)), endDate: fmt(today) };
    case "all": return { startDate: undefined, endDate: undefined };
    case "custom": return { startDate: customStart || fmt(today), endDate: customEnd || fmt(today) };
    default: return { startDate: fmt(today), endDate: fmt(today) };
  }
}

const brl = (v: number) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: number) => Number(v || 0).toLocaleString("pt-BR");
const pct = (v: number) => `${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Ativo") return "default";
  if (status === "Pausado") return "secondary";
  return "outline";
}

export default function MetaAdsDashboard() {
  const [period, setPeriod] = useState("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { startDate, endDate } = getDateRange(period, customStart, customEnd);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["meta-ads-campaigns", period, startDate, endDate],
    retry: false,
    throwOnError: false,
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-ads-dashboard`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "campaigns", period, startDate, endDate }),
        }
      );
      const json = await resp.json().catch(() => null);
      if (!resp.ok || json?.error) {
        throw new Error(
          json?.error || `Erro ${resp.status} ao carregar métricas do Meta Ads`
        );
      }
      return json;
    },
  });

  const s = data?.summary;
  const cards = [
    { label: "Investimento", value: s ? brl(s.spend) : "—", bg: "bg-blue-600" },
    { label: "Impressões", value: s ? num(s.impressions) : "—", bg: "bg-indigo-600" },
    { label: "Cliques", value: s ? num(s.clicks) : "—", bg: "bg-red-600" },
    { label: "CTR médio", value: s ? pct(s.ctr) : "—", bg: "bg-gray-600" },
    { label: "Resultados", value: s ? num(s.results) : "—", bg: "bg-emerald-600" },
    { label: "Custo por resultado", value: s ? brl(s.cost_per_result) : "—", bg: "bg-gray-700" },
  ];

  const campaigns = data?.campaigns || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Meta Ads</h1>
        <p className="text-muted-foreground">Campanhas de Facebook e Instagram da conta de anúncios</p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        {PERIODS.map((p) => (
          <Button
            key={p.key}
            variant={period === p.key ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
        {period === "custom" && (
          <div className="flex gap-2 items-center">
            <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-40" />
            <span>até</span>
            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40" />
            <Button size="sm" onClick={() => refetch()}>Buscar</Button>
          </div>
        )}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">Erro ao carregar métricas: {(error as Error).message}</p>
            <p className="text-sm text-muted-foreground mt-1">Verifique as credenciais do Meta (token e conta de anúncios).</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => (
          <Card key={card.label} className={`${card.bg} text-white border-0`}>
            <CardContent className="pt-6 pb-6">
              <p className="text-sm opacity-90">{card.label}</p>
              <p className="text-2xl font-bold mt-1">
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : campaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">Nenhuma campanha encontrada no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Orçamento</TableHead>
                    <TableHead className="text-right">Investimento</TableHead>
                    <TableHead className="text-right">Impressões</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Resultados</TableHead>
                    <TableHead className="text-right">Custo/result.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium max-w-xs truncate" title={c.name}>{c.name}</TableCell>
                      <TableCell><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        {c.daily_budget
                          ? `${brl(c.daily_budget)}/dia`
                          : c.lifetime_budget
                            ? `${brl(c.lifetime_budget)} total`
                            : "—"}
                      </TableCell>
                      <TableCell className="text-right">{brl(c.spend)}</TableCell>
                      <TableCell className="text-right">{num(c.impressions)}</TableCell>
                      <TableCell className="text-right">{num(c.clicks)}</TableCell>
                      <TableCell className="text-right">{pct(c.ctr)}</TableCell>
                      <TableCell className="text-right">{num(c.results)}</TableCell>
                      <TableCell className="text-right">{c.results > 0 ? brl(c.cost_per_result) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
