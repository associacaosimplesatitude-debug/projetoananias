import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { AlertCircle, MessageSquare, AlertTriangle, BarChart3, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AgenteIAIndex() {
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ["agente-ia-index-stats"],
    refetchInterval: 10_000,
    queryFn: async () => {
      const seventyTwoH = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
      const twentyFourH = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

      const [pend, ativas, esc, recentPend, recentAny] = await Promise.all([
        supabase.from("agente_ia_mensagens").select("id", { count: "exact", head: true })
          .eq("status_aprovacao", "pendente").eq("role", "assistant"),
        supabase.from("agente_ia_conversas").select("id", { count: "exact", head: true }).eq("status", "ativa"),
        supabase.from("agente_ia_escalations").select("id", { count: "exact", head: true }).eq("status", "aberta"),
        supabase.from("agente_ia_mensagens").select("id", { count: "exact", head: true })
          .eq("status_aprovacao", "pendente").gte("created_at", seventyTwoH),
        supabase.from("agente_ia_mensagens").select("id", { count: "exact", head: true })
          .gte("created_at", twentyFourH),
      ]);

      return {
        pendentes: pend.count ?? 0,
        ativas: ativas.count ?? 0,
        escalations: esc.count ?? 0,
        recentPend: recentPend.count ?? 0,
        recentAny: recentAny.count ?? 0,
      };
    },
  });

  const banner = (() => {
    if (!stats) return null;
    if (stats.recentPend > 0)
      return { color: "bg-green-50 border-green-200 text-green-800", text: "Agente em modo supervisionado (mensagens pendentes nas últimas 72h)" };
    if (stats.recentAny === 0)
      return { color: "bg-muted border-border text-muted-foreground", text: "Agente inativo (sem mensagens nas últimas 24h)" };
    return { color: "bg-amber-50 border-amber-200 text-amber-800", text: "Agente em modo autônomo (sem aprovações pendentes nas últimas 72h)" };
  })();

  const cards = [
    {
      title: "Aprovações pendentes",
      count: stats?.pendentes ?? 0,
      icon: AlertCircle,
      to: "/admin/agente-ia/aprovacoes",
      highlight: (stats?.pendentes ?? 0) > 0,
    },
    {
      title: "Conversas ativas",
      count: stats?.ativas ?? 0,
      icon: MessageSquare,
      to: "/admin/agente-ia/conversas",
    },
    {
      title: "Escalations abertas",
      count: stats?.escalations ?? 0,
      icon: AlertTriangle,
      to: "/admin/agente-ia/escalations",
    },
    {
      title: "Métricas (7 dias)",
      count: null,
      icon: BarChart3,
      to: "/admin/agente-ia/metricas",
    },
  ];

  return (
    <div className="space-y-6">
      {banner && (
        <div className={cn("rounded-md border px-4 py-3 text-sm font-medium", banner.color)}>
          {banner.text}
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card
            key={c.title}
            onClick={() => navigate(c.to)}
            className={cn(
              "cursor-pointer hover:shadow-md transition-shadow",
              c.highlight && "border-destructive ring-2 ring-destructive/20",
            )}
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
              <c.icon className={cn("h-5 w-5 text-muted-foreground", c.highlight && "text-destructive")} />
            </CardHeader>
            <CardContent>
              {c.count !== null ? (
                <div className={cn("text-3xl font-bold", c.highlight && "text-destructive")}>{c.count}</div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  Ver dashboard <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
