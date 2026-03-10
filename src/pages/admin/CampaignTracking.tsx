import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, RefreshCw, Send, MousePointerClick, Eye, ShoppingCart, DollarSign, BarChart3, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CampaignTracking() {
  const { campanha_id } = useParams<{ campanha_id: string }>();
  const navigate = useNavigate();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch campaign info
  const { data: campaign } = useQuery({
    queryKey: ["campaign-info", campanha_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_campanhas")
        .select("id, nome, status, total_publico, total_enviados")
        .eq("id", campanha_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!campanha_id,
  });

  // Fetch campaign links
  const { data: links, refetch: refetchLinks } = useQuery({
    queryKey: ["campaign-links", campanha_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_links")
        .select("*")
        .eq("campaign_id", campanha_id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!campanha_id,
  });

  // Fetch campaign events
  const { data: events, refetch: refetchEvents } = useQuery({
    queryKey: ["campaign-events", campanha_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_events")
        .select("*")
        .eq("campaign_id", campanha_id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!campanha_id,
  });

  // Auto-refresh every 60s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refetchLinks();
      refetchEvents();
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, refetchLinks, refetchEvents]);

  const handleRefresh = () => {
    refetchLinks();
    refetchEvents();
  };

  // Compute metrics
  const messageSent = events?.filter(e => e.event_type === "message_sent").length || 0;
  const clickedLink = links?.filter(l => l.first_accessed_at !== null).length || 0;
  const pageViewedUnique = new Set(events?.filter(e => e.event_type === "page_viewed").map(e => e.link_id)).size;
  const panelAccessed = events?.filter(e => e.event_type === "panel_accessed").length || 0;
  const purchases = events?.filter(e => e.event_type === "purchase_completed") || [];
  const totalRevenue = purchases.reduce((sum, e) => {
    const val = (e.event_data as any)?.valor;
    return sum + (val ? Number(val) : 0);
  }, 0);
  const conversionRate = messageSent > 0 ? ((panelAccessed / messageSent) * 100).toFixed(1) : "0";

  // Funnel data
  const totalSent = messageSent || campaign?.total_enviados || 0;
  const funnelSteps = [
    { label: "Enviados", value: totalSent, icon: Send },
    { label: "Clicaram", value: clickedLink, icon: MousePointerClick },
    { label: "Acessaram", value: pageViewedUnique, icon: Eye },
    { label: "Painel", value: panelAccessed, icon: ShoppingCart },
    { label: "Compraram", value: purchases.length, icon: DollarSign },
  ];

  // Build per-client table
  const clientRows = (links || []).map(link => {
    const linkEvents = events?.filter(e => e.link_id === link.id) || [];
    const sentEvent = linkEvents.find(e => e.event_type === "message_sent");
    const pageEvent = linkEvents.find(e => e.event_type === "page_viewed");
    const panelEvent = linkEvents.find(e => e.event_type === "panel_accessed");
    const purchaseEvent = linkEvents.find(e => e.event_type === "purchase_completed");
    const sessionEvent = linkEvents.find(e => e.event_type === "session_end");
    const duration = sessionEvent ? (sessionEvent.event_data as any)?.duration_seconds : null;

    return {
      id: link.id,
      name: link.customer_name || "—",
      phone: link.customer_phone || "—",
      messageSent: !!sentEvent,
      clickedLink: !!link.first_accessed_at,
      clickedAt: link.first_accessed_at,
      pageViewed: !!pageEvent,
      pageViewedAt: pageEvent?.created_at,
      panelAccessed: !!panelEvent,
      panelAccessedAt: panelEvent?.created_at,
      purchased: !!purchaseEvent,
      purchaseValue: purchaseEvent ? (purchaseEvent.event_data as any)?.valor : null,
      duration,
      token: link.token,
    };
  });

  const StatusIcon = ({ active }: { active: boolean }) => (
    <span className={active ? "text-green-600" : "text-muted-foreground/40"}>{active ? "✅" : "❌"}</span>
  );

  const formatDate = (d: string | null) => {
    if (!d) return null;
    try { return format(new Date(d), "dd/MM HH:mm", { locale: ptBR }); } catch { return "—"; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/whatsapp")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">📊 Rastreamento: {campaign?.nome || "..."}</h2>
            <p className="text-sm text-muted-foreground">Acompanhe o desempenho da campanha em tempo real</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Mensagens Enviadas", value: messageSent, icon: Send, emoji: "📤" },
          { label: "Clicaram no Link", value: clickedLink, icon: MousePointerClick, emoji: "👆" },
          { label: "Acessaram a Página", value: pageViewedUnique, icon: Eye, emoji: "👁️" },
          { label: "Acessaram o Painel", value: panelAccessed, icon: ShoppingCart, emoji: "🛒" },
          { label: "Receita Gerada", value: `R$ ${totalRevenue.toFixed(2)}`, icon: DollarSign, emoji: "💰" },
          { label: "Taxa de Conversão", value: `${conversionRate}%`, icon: BarChart3, emoji: "📊" },
        ].map((m, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{m.emoji} {m.label}</p>
              <p className="text-2xl font-bold mt-1">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {funnelSteps.map((step, i) => {
              const pct = totalSent > 0 ? (step.value / totalSent) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-28 text-sm font-medium flex items-center gap-2">
                    <step.icon className="h-4 w-4 text-muted-foreground" />
                    {step.label}
                  </div>
                  <div className="flex-1 bg-muted rounded-full h-7 relative overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                      {step.value} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Client Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhes por Cliente ({clientRows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-center">Enviada</TableHead>
                  <TableHead className="text-center">Clicou</TableHead>
                  <TableHead className="text-center">Página</TableHead>
                  <TableHead className="text-center">Painel</TableHead>
                  <TableHead className="text-center">Comprou</TableHead>
                  <TableHead className="text-center">Tempo</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhum link de rastreamento encontrado para esta campanha.
                    </TableCell>
                  </TableRow>
                ) : (
                  clientRows.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">{row.name}</TableCell>
                      <TableCell className="text-sm">{row.phone}</TableCell>
                      <TableCell className="text-center"><StatusIcon active={row.messageSent} /></TableCell>
                      <TableCell className="text-center">
                        <StatusIcon active={row.clickedLink} />
                        {row.clickedAt && <div className="text-[10px] text-muted-foreground">{formatDate(row.clickedAt)}</div>}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusIcon active={row.pageViewed} />
                        {row.pageViewedAt && <div className="text-[10px] text-muted-foreground">{formatDate(row.pageViewedAt)}</div>}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusIcon active={row.panelAccessed} />
                        {row.panelAccessedAt && <div className="text-[10px] text-muted-foreground">{formatDate(row.panelAccessedAt)}</div>}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusIcon active={row.purchased} />
                        {row.purchaseValue && (
                          <div className="text-[10px] text-green-600 font-semibold">R$ {Number(row.purchaseValue).toFixed(2)}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {row.duration ? `${Math.round(row.duration)}s` : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => window.open(`/oferta/${row.token}`, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3" /> Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
