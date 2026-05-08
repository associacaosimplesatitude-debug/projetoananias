import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

type Periodo = "hoje" | "7d" | "30d";
const COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#a855f7"];

export default function AgenteIAMetricas() {
  const [periodo, setPeriodo] = useState<Periodo>("7d");

  const since = useMemo(() => {
    const days = periodo === "hoje" ? 1 : periodo === "7d" ? 7 : 30;
    return startOfDay(subDays(new Date(), days - 1));
  }, [periodo]);

  const { data } = useQuery({
    queryKey: ["agente-ia-metricas", periodo],
    queryFn: async () => {
      const sinceIso = since.toISOString();
      const [convs, escs] = await Promise.all([
        supabase.from("agente_ia_conversas")
          .select("id, status, iniciada_em, gerou_venda, valor_venda, custo_estimado, resolveu_sozinho, ebd_clientes:cliente_id(nome_igreja)")
          .gte("iniciada_em", sinceIso)
          .limit(1000),
        supabase.from("agente_ia_escalations")
          .select("motivo, created_at")
          .gte("created_at", sinceIso)
          .limit(1000),
      ]);
      if (convs.error) throw convs.error;
      if (escs.error) throw escs.error;
      return { conversas: convs.data ?? [], escalations: escs.data ?? [] };
    },
  });

  const kpis = useMemo(() => {
    const c = data?.conversas ?? [];
    const total = c.length;
    const fechadas = c.filter((x: any) => x.status === "fechada");
    const resolvidas = fechadas.filter((x: any) => x.resolveu_sozinho === true).length;
    const taxaResolucao = fechadas.length > 0 ? (resolvidas / fechadas.length) * 100 : 0;
    const vendas = c.filter((x: any) => x.gerou_venda);
    const totalVendas = vendas.reduce((s: number, x: any) => s + Number(x.valor_venda ?? 0), 0);
    const custo = c.reduce((s: number, x: any) => s + Number(x.custo_estimado ?? 0), 0);
    return { total, taxaResolucao, vendasCount: vendas.length, totalVendas, custo };
  }, [data]);

  const porDia = useMemo(() => {
    const c = data?.conversas ?? [];
    const map = new Map<string, number>();
    c.forEach((x: any) => {
      const k = format(new Date(x.iniciada_em), "dd/MM");
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return [...map.entries()].map(([d, count]) => ({ d, count }));
  }, [data]);

  const topMotivos = useMemo(() => {
    const e = data?.escalations ?? [];
    const map = new Map<string, number>();
    e.forEach((x: any) => map.set(x.motivo, (map.get(x.motivo) ?? 0) + 1));
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([motivo, count]) => ({ motivo, count }));
  }, [data]);

  const statusFinal = useMemo(() => {
    const c = data?.conversas ?? [];
    const a = c.filter((x: any) => x.status === "fechada" && x.resolveu_sozinho === true).length;
    const b = c.filter((x: any) => x.status === "escalada").length;
    const ab = c.filter((x: any) => x.status === "fechada" && x.resolveu_sozinho !== true).length;
    return [
      { name: "Autônoma", value: a },
      { name: "Escalada", value: b },
      { name: "Abandonada", value: ab },
    ].filter(x => x.value > 0);
  }, [data]);

  const topVendas = useMemo(() => {
    return (data?.conversas ?? [])
      .filter((x: any) => x.gerou_venda)
      .sort((a: any, b: any) => Number(b.valor_venda ?? 0) - Number(a.valor_venda ?? 0))
      .slice(0, 10);
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["hoje", "7d", "30d"] as Periodo[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`px-3 py-1 rounded-md text-sm border ${periodo === p ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >
            {p === "hoje" ? "Hoje" : p === "7d" ? "7 dias" : "30 dias"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Kpi title="Conversas" value={kpis.total} />
        <Kpi title="Resolução autônoma" value={`${kpis.taxaResolucao.toFixed(1)}%`} />
        <Kpi title="Vendas geradas" value={`R$ ${kpis.totalVendas.toFixed(2)}`} sub={`${kpis.vendasCount} pedidos`} />
        <Kpi title="Custo Anthropic" value={`R$ ${kpis.custo.toFixed(4)}`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Conversas por dia</CardTitle></CardHeader>
          <CardContent style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={porDia}>
                <XAxis dataKey="d" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Top 5 motivos de escalation</CardTitle></CardHeader>
          <CardContent style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={topMotivos} layout="vertical">
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="motivo" fontSize={10} width={140} />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Status final das conversas</CardTitle></CardHeader>
          <CardContent style={{ height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusFinal} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {statusFinal.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 vendas geradas</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {topVendas.length === 0 && <TableRow><TableCell colSpan={2} className="text-muted-foreground text-center py-4">Sem vendas no período</TableCell></TableRow>}
                {topVendas.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{c.ebd_clientes?.nome_igreja ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm font-medium">R$ {Number(c.valor_venda ?? 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ title, value, sub }: { title: string; value: any; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
