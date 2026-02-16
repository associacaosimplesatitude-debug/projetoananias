import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer } from "recharts";
import { Mail, Eye, MousePointerClick, TrendingUp, Loader2 } from "lucide-react";
import { format, subDays, startOfWeek, differenceInWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo } from "react";

interface Props {
  isAdminView?: boolean;
  vendedorId?: string | null;
}

export default function EmailMetricsTab({ isAdminView = false, vendedorId }: Props) {
  const thirtyDaysAgo = useMemo(() => subDays(new Date(), 30).toISOString(), []);

  const { data: rawLogs = [], isLoading } = useQuery({
    queryKey: ["ebd-email-metrics", isAdminView ? "all" : vendedorId, thirtyDaysAgo],
    queryFn: async () => {
      let query = supabase
        .from("ebd_email_logs")
        .select("id, created_at, status, email_aberto, link_clicado")
        .gte("created_at", thirtyDaysAgo)
        .eq("status", "enviado")
        .order("created_at", { ascending: true });

      if (!isAdminView && vendedorId) {
        query = query.eq("vendedor_id", vendedorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isAdminView || !!vendedorId,
  });

  // Summary stats
  const stats = useMemo(() => {
    const total = rawLogs.length;
    const abertos = rawLogs.filter((l) => l.email_aberto).length;
    const clicados = rawLogs.filter((l) => l.link_clicado).length;
    const dias = 30;
    return {
      total,
      taxaAbertura: total > 0 ? Math.round((abertos / total) * 100) : 0,
      taxaClique: total > 0 ? Math.round((clicados / total) * 100) : 0,
      mediaDia: total > 0 ? (total / dias).toFixed(1) : "0",
    };
  }, [rawLogs]);

  // Daily chart data
  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; abertos: number; naoAbertos: number }>();

    // Fill all 30 days
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "dd/MM");
      map.set(key, { date: key, abertos: 0, naoAbertos: 0 });
    }

    rawLogs.forEach((log) => {
      const key = format(new Date(log.created_at), "dd/MM");
      const entry = map.get(key);
      if (entry) {
        if (log.email_aberto) entry.abertos++;
        else entry.naoAbertos++;
      }
    });

    return Array.from(map.values());
  }, [rawLogs]);

  // Weekly chart data
  const weeklyData = useMemo(() => {
    if (rawLogs.length === 0) return [];

    const now = new Date();
    const weekStart = startOfWeek(subDays(now, 27), { locale: ptBR });
    const totalWeeks = differenceInWeeks(now, weekStart) + 1;
    const weeks: { semana: string; taxaAbertura: number; taxaClique: number }[] = [];

    for (let w = 0; w < totalWeeks; w++) {
      const wStart = new Date(weekStart);
      wStart.setDate(wStart.getDate() + w * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 7);

      const weekLogs = rawLogs.filter((l) => {
        const d = new Date(l.created_at);
        return d >= wStart && d < wEnd;
      });

      const total = weekLogs.length;
      const abertos = weekLogs.filter((l) => l.email_aberto).length;
      const clicados = weekLogs.filter((l) => l.link_clicado).length;

      weeks.push({
        semana: `Sem ${w + 1}`,
        taxaAbertura: total > 0 ? Math.round((abertos / total) * 100) : 0,
        taxaClique: total > 0 ? Math.round((clicados / total) * 100) : 0,
      });
    }

    return weeks;
  }, [rawLogs]);

  const barChartConfig = {
    abertos: { label: "Abertos", color: "hsl(142, 71%, 45%)" },
    naoAbertos: { label: "Não abertos", color: "hsl(var(--muted-foreground))" },
  };

  const lineChartConfig = {
    taxaAbertura: { label: "Taxa de Abertura (%)", color: "hsl(142, 71%, 45%)" },
    taxaClique: { label: "Taxa de Clique (%)", color: "hsl(217, 91%, 60%)" },
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Mail className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total (30 dias)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Eye className="h-5 w-5 mx-auto mb-2 text-green-600" />
            <p className="text-3xl font-bold text-green-600">{stats.taxaAbertura}%</p>
            <p className="text-sm text-muted-foreground">Taxa de Abertura</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <MousePointerClick className="h-5 w-5 mx-auto mb-2 text-blue-600" />
            <p className="text-3xl font-bold text-blue-600">{stats.taxaClique}%</p>
            <p className="text-sm text-muted-foreground">Taxa de Clique</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-3xl font-bold">{stats.mediaDia}</p>
            <p className="text-sm text-muted-foreground">Média/dia</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Volume */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Envios por dia (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barChartConfig} className="h-[300px] w-full">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  interval={Math.floor(dailyData.length / 8)}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="abertos" stackId="a" fill="var(--color-abertos)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="naoAbertos" stackId="a" fill="var(--color-naoAbertos)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Weekly Rates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Taxas por semana</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={lineChartConfig} className="h-[300px] w-full">
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="taxaAbertura"
                  stroke="var(--color-taxaAbertura)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="taxaClique"
                  stroke="var(--color-taxaClique)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
