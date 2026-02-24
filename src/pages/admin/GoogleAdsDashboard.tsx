import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";

const PERIODS = [
  { label: "Hoje", key: "today" },
  { label: "Ontem", key: "yesterday" },
  { label: "7 dias", key: "7d" },
  { label: "30 dias", key: "30d" },
  { label: "Mês atual", key: "month" },
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
    case "custom": return { startDate: customStart || fmt(today), endDate: customEnd || fmt(today) };
    default: return { startDate: fmt(today), endDate: fmt(today) };
  }
}

export default function GoogleAdsDashboard() {
  const [period, setPeriod] = useState("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { startDate, endDate } = getDateRange(period, customStart, customEnd);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["google-ads-metrics", startDate, endDate],
    queryFn: async () => {
      const res = await supabase.functions.invoke("google-ads-dashboard", {
        body: { action: "metrics", startDate, endDate },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
  });

  const cards = [
    { label: "Valor conv.", value: data ? `R$ ${Number(data.conversions_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—", bg: "bg-blue-600", text: "text-white" },
    { label: "Cliques", value: data ? Number(data.clicks).toLocaleString("pt-BR") : "—", bg: "bg-red-600", text: "text-white" },
    { label: "CPC méd.", value: data ? `R$ ${Number(data.average_cpc).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—", bg: "bg-gray-600", text: "text-white" },
    { label: "Custo", value: data ? `R$ ${Number(data.cost).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—", bg: "bg-gray-700", text: "text-white" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Google Ads</h1>
        <p className="text-muted-foreground">Métricas de desempenho da sua conta</p>
      </div>

      {/* Period Filter */}
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

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">Erro ao carregar métricas: {(error as Error).message}</p>
            <p className="text-sm text-muted-foreground mt-1">Verifique as credenciais na aba Integrações.</p>
          </CardContent>
        </Card>
      )}

      {/* Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.label} className={`${card.bg} ${card.text} border-0`}>
            <CardContent className="pt-6 pb-6">
              <p className="text-sm opacity-90">{card.label}</p>
              <p className="text-3xl font-bold mt-1">
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
