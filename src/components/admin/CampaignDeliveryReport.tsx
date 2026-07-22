import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Download, Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type StatusFiltro =
  | "todos"
  | "pendente"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "cancelado_optout"
  | "respondidos";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  pendente:         { label: "Pendente",   variant: "outline" },
  sent:             { label: "Enviada",    variant: "secondary" },
  delivered:        { label: "Entregue",   variant: "default", className: "bg-blue-500/15 text-blue-700 border-blue-300" },
  read:             { label: "Lida",       variant: "default", className: "bg-green-500/15 text-green-700 border-green-300" },
  failed:           { label: "Falha",      variant: "destructive" },
  cancelado_optout: { label: "Opt-out",    variant: "outline", className: "bg-amber-500/15 text-amber-700 border-amber-300" },
};

const PAGE_SIZE = 50;

function pct(num: number, den: number) {
  if (!den) return 0;
  return (num / den) * 100;
}

function fmt(d?: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM HH:mm", { locale: ptBR }); } catch { return "—"; }
}

export default function CampaignDeliveryReport({ campanhaId }: { campanhaId: string }) {
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("todos");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  // Campanha (com agregados)
  const { data: camp, refetch: refetchCamp } = useQuery({
    queryKey: ["wpp-camp-delivery", campanhaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_campanhas")
        .select("id, nome, status, total_publico, total_enviados, total_entregues, total_lidos, total_falhas, total_respondidos, total_link_clicks, iniciada_em, finalizada_em")
        .eq("id", campanhaId)
        .single();
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  // Destinatários (todos, para tabela + tabela de erros + timeline + CSV)
  const { data: dests = [], refetch: refetchDests } = useQuery({
    queryKey: ["wpp-camp-dest", campanhaId],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("whatsapp_campanha_destinatarios")
          .select("id, telefone, nome, status_envio, enviado_em, entregue_em, lido_em, falhou_em, respondido_em, erro_codigo, erro_mensagem")
          .eq("campanha_id", campanhaId)
          .order("enviado_em", { ascending: true, nullsFirst: true })
          .range(from, from + step - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < step) break;
        from += step;
      }
      return all;
    },
    refetchInterval: camp?.status === "processando" ? 30_000 : false,
  });

  // Meta Template Analytics (cliques agregados no botão do template, por período)
  const { data: metaAnalytics } = useQuery({
    queryKey: ["wpp-camp-meta-analytics", campanhaId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-template-analytics", {
        body: { campanha_id: campanhaId },
      });
      if (error) return { enabled: false, message: "Não foi possível consultar o Meta." } as any;
      return data as { enabled: boolean; clicked?: number; message?: string };
    },
    refetchInterval: 5 * 60_000,
    retry: false,
  });

  // Realtime opcional

  useEffect(() => {
    const ch = supabase
      .channel(`campanha-delivery-${campanhaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_campanha_destinatarios", filter: `campanha_id=eq.${campanhaId}` },
        () => { refetchDests(); refetchCamp(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [campanhaId, refetchCamp, refetchDests]);

  // Reset paginação ao filtrar
  useEffect(() => { setPagina(1); }, [filtroStatus, busca]);

  // KPIs
  const totalPublico = camp?.total_publico ?? 0;
  const enviadas     = camp?.total_enviados ?? 0;
  const entregues    = camp?.total_entregues ?? 0;
  const lidas        = camp?.total_lidos ?? 0;
  const falhas       = camp?.total_falhas ?? 0;
  const respostas    = camp?.total_respondidos ?? 0;

  const taxaFalha = pct(falhas, totalPublico);

  // Timeline (msgs por hora)
  const timeline = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dests) {
      if (!d.enviado_em) continue;
      const dt = new Date(d.enviado_em);
      dt.setMinutes(0, 0, 0);
      const k = dt.toISOString();
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ hora: format(new Date(k), "dd/MM HH'h'", { locale: ptBR }), count: v }));
  }, [dests]);

  // Erros agregados
  const erros = useMemo(() => {
    const map = new Map<string, { codigo: string; mensagem: string; count: number }>();
    for (const d of dests) {
      if (d.status_envio !== "failed") continue;
      const k = `${d.erro_codigo || "—"}::${d.erro_mensagem || "Sem detalhes"}`;
      const cur = map.get(k);
      if (cur) cur.count++;
      else map.set(k, { codigo: d.erro_codigo || "—", mensagem: d.erro_mensagem || "Sem detalhes", count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [dests]);

  // Tabela filtrada
  const filtrados = useMemo(() => {
    return dests.filter((d) => {
      if (filtroStatus === "respondidos") {
        if (!d.respondido_em) return false;
      } else if (filtroStatus !== "todos") {
        if (d.status_envio !== filtroStatus) return false;
      }
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        const hay = `${d.nome || ""} ${d.telefone || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dests, filtroStatus, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginados = filtrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  // Funil (barras horizontais)
  const funil = [
    { label: "Total Público", value: totalPublico, color: "bg-muted" },
    { label: "Enviadas",      value: enviadas,     color: "bg-slate-400" },
    { label: "Entregues",     value: entregues,    color: "bg-blue-500" },
    { label: "Lidas",         value: lidas,        color: "bg-green-500" },
    { label: "Respondidas",   value: respostas,    color: "bg-purple-500" },
  ];
  const maxFunil = Math.max(totalPublico, 1);

  const exportarCSV = () => {
    const headers = ["telefone","nome","status","enviado_em","entregue_em","lido_em","falhou_em","respondido_em","erro_codigo","erro_mensagem"];
    const linhas = dests.map((d) => headers.map((h) => {
      const v = (d as any)[h === "status" ? "status_envio" : h];
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(","));
    const csv = [headers.join(","), ...linhas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campanha-${campanhaId}-destinatarios.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const kpis: Array<{ label: string; valor: number; sub: string | null; tone: string; alert?: boolean; tooltip?: string }> = [
    { label: "Total Público",  valor: totalPublico, sub: null,                                            tone: "border-l-muted-foreground/40" },
    { label: "Enviadas",       valor: enviadas,     sub: `${pct(enviadas, totalPublico).toFixed(1)}%`,    tone: "border-l-slate-400" },
    { label: "Entregues",      valor: entregues,    sub: `${pct(entregues, enviadas).toFixed(1)}%`,       tone: "border-l-blue-500" },
    { label: "Falhas",         valor: falhas,       sub: `${taxaFalha.toFixed(1)}%`,                      tone: "border-l-red-500", alert: taxaFalha > 5 },
    { label: "Respostas",      valor: respostas,    sub: `${pct(respostas, entregues).toFixed(1)}%`,      tone: "border-l-purple-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">📨 Relatório de Entrega</h3>
          <p className="text-sm text-muted-foreground">Status em tempo real vindo da Meta (WhatsApp Cloud API)</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportarCSV}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map((k, i) => (
          <Card key={i} className={`border-l-4 ${k.tone}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {k.label}
                {k.alert && <AlertTriangle className="h-3 w-3 text-red-500" />}
                {k.tooltip && (
                  <TooltipProvider>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex"><Info className="h-3 w-3 text-muted-foreground" /></button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">{k.tooltip}</TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                )}
              </p>
              <p className="text-2xl font-bold mt-1">{k.valor.toLocaleString("pt-BR")}</p>
              {k.sub && <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>}
            </CardContent>
          </Card>
        ))}
        {/* Cliques no Botão (Meta) — agregado por template no período */}
        <Card className="border-l-4 border-l-fuchsia-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Cliques no Botão (Meta)
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex"><Info className="h-3 w-3 text-muted-foreground" /></button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Cliques agregados do Meta para este template no período da campanha. Pode incluir cliques de outras campanhas que usaram o mesmo template nas mesmas datas. Atualiza a cada poucos minutos.
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </p>
            {metaAnalytics?.enabled ? (
              <>
                <p className="text-2xl font-bold mt-1">{(metaAnalytics.clicked ?? 0).toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">via Meta Template Analytics</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold mt-1 text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {metaAnalytics?.message || "Habilite Template Analytics no Meta Business Suite para ver esta métrica."}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Funil */}
      <Card>
        <CardHeader><CardTitle className="text-base">Funil de Entrega</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {funil.map((f, i) => {
              const w = pct(f.value, maxFunil);
              const prev = i > 0 ? funil[i - 1].value : f.value;
              const drop = prev > 0 ? 100 - pct(f.value, prev) : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-32 text-sm font-medium">{f.label}</div>
                  <div className="flex-1 bg-muted rounded-md h-8 relative overflow-hidden">
                    <div className={`h-full rounded-md ${f.color} transition-all duration-500`} style={{ width: `${Math.max(w, 1)}%` }} />
                    <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-foreground">
                      {f.value.toLocaleString("pt-BR")} ({w.toFixed(1)}%)
                    </span>
                  </div>
                  {i > 0 && (
                    <div className="w-20 text-xs text-muted-foreground text-right">
                      {drop > 0 ? `−${drop.toFixed(1)}%` : "—"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader><CardTitle className="text-base">Envios por hora</CardTitle></CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de envio ainda.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Falhas por motivo */}
      {erros.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Falhas por motivo</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {erros.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{e.codigo}</TableCell>
                    <TableCell className="text-sm">{e.mensagem}</TableCell>
                    <TableCell className="text-right font-semibold">{e.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tabela de destinatários */}
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">Destinatários ({filtrados.length.toLocaleString("pt-BR")})</CardTitle>
            <Input
              placeholder="Buscar por nome ou telefone…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-64"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ["todos", "Todos"],
              ["pendente", "Pendente"],
              ["sent", "Enviada"],
              ["delivered", "Entregue"],
              ["read", "Lida"],
              ["failed", "Falha"],
              ["cancelado_optout", "Opt-out"],
              ["respondidos", "Respondidas"],
            ] as Array<[StatusFiltro, string]>).map(([key, label]) => (
              <Badge
                key={key}
                variant={filtroStatus === key ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFiltroStatus(key)}
              >
                {label}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviada</TableHead>
                  <TableHead>Entregue</TableHead>
                  <TableHead>Lida</TableHead>
                  <TableHead>Respondida</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum destinatário.</TableCell>
                  </TableRow>
                ) : paginados.map((d) => {
                  const st = STATUS_LABEL[d.status_envio] || { label: d.status_envio, variant: "outline" as const, className: undefined };
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.telefone}</TableCell>
                      <TableCell className="text-sm">{d.nome || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant} className={st.className}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{fmt(d.enviado_em)}</TableCell>
                      <TableCell className="text-xs">{fmt(d.entregue_em)}</TableCell>
                      <TableCell className="text-xs">{fmt(d.lido_em)}</TableCell>
                      <TableCell className="text-xs">{fmt(d.respondido_em)}</TableCell>
                      <TableCell className="text-xs">
                        {d.erro_codigo || d.erro_mensagem ? (
                          <div>
                            <div className="font-mono">{d.erro_codigo}</div>
                            <div className="text-muted-foreground">{d.erro_mensagem}</div>
                          </div>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">Página {pagina} de {totalPaginas}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={pagina === totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
