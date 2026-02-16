import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, LogIn, Settings, CheckCircle, AlertTriangle, Phone, MessageSquare, DollarSign, Calendar, Mail, Lock, Clock, ChevronDown, Star, Zap } from "lucide-react";
import { useVendedor } from "@/hooks/useVendedor";

type FunnelStage = "compra_aprovada" | "aguardando_login" | "pendente_config" | "ativos" | "zona_renovacao" | "recompra";

interface FunilTracking {
  fase_atual: number;
  fase1_link_clicado: boolean;
  concluido: boolean;
  ultima_mensagem_em: string | null;
}

interface ClienteItem {
  id: string;
  nome_igreja: string;
  telefone: string | null;
  whatsapp_status: string | null;
  valor_compra?: number;
  data_compra?: string;
  email_superintendente?: string | null;
  senha_temporaria?: string | null;
  ultimo_login?: string | null;
  data_primeira_compra?: string;
  data_recompra?: string;
  dias_entre_compras?: number;
  valor_primeira_compra?: number;
  funil_tracking?: FunilTracking | null;
}

const faseLabels: Record<number, string> = {
  1: "Bem-vindo",
  2: "Lembrete Login",
  3: "Onboarding",
  4: "Config. Escala",
  5: "Ativo",
};

const faseColors: Record<number, string> = {
  1: "bg-blue-500",
  2: "bg-orange-500",
  3: "bg-yellow-500",
  4: "bg-purple-500",
  5: "bg-emerald-500",
};

const stages = [
  { key: "compra_aprovada" as FunnelStage, label: "Primeira Compra", icon: ShoppingCart, color: "bg-red-500", widthPercent: 100 },
  { key: "aguardando_login" as FunnelStage, label: "Aguardando Login", icon: LogIn, color: "bg-orange-500", widthPercent: 80 },
  { key: "pendente_config" as FunnelStage, label: "Pendente Config.", icon: Settings, color: "bg-yellow-500", widthPercent: 60 },
  { key: "ativos" as FunnelStage, label: "Ativos", icon: CheckCircle, color: "bg-emerald-500", widthPercent: 40 },
  { key: "zona_renovacao" as FunnelStage, label: "Zona de Renovação", icon: AlertTriangle, color: "bg-green-700", widthPercent: 25 },
  { key: "recompra" as FunnelStage, label: "Recompra", icon: Star, color: "bg-amber-500", widthPercent: 20 },
];

function getWhatsAppBadge(status: string | null) {
  switch (status) {
    case "enviada": return <Badge className="bg-blue-500 hover:bg-blue-600 text-xs">Enviada</Badge>;
    case "entregue": return <Badge className="bg-green-500 hover:bg-green-600 text-xs">Entregue</Badge>;
    case "lida": return <Badge className="bg-green-700 hover:bg-green-800 text-xs">Lida</Badge>;
    case "erro": return <Badge variant="destructive" className="text-xs">Erro</Badge>;
    default: return <Badge variant="secondary" className="text-xs">Sem envio</Badge>;
  }
}

interface VendedorFunilProps {
  isAdminView?: boolean;
}

export default function VendedorFunil({ isAdminView = false }: VendedorFunilProps) {
  const [expandedStage, setExpandedStage] = useState<FunnelStage | null>(null);
  const { vendedor } = useVendedor();

  // Unified counts query via RPC
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["funil-counts", isAdminView ? "admin" : vendedor?.id],
    queryFn: async () => {
      const vendedorFilter = isAdminView ? null : vendedor?.id;
      const { data, error } = await supabase.rpc("get_funil_stage_counts", {
        p_vendedor_id: vendedorFilter || null,
      });
      if (error) throw error;
      const result = data as any;
      return {
        compra_aprovada: Number(result?.compra_aprovada || 0),
        compra_aprovada_total: Number(result?.compra_aprovada_total || 0),
        aguardando_login: Number(result?.aguardando_login || 0),
        pendente_config: Number(result?.pendente_config || 0),
        ativos: Number(result?.ativos || 0),
        zona_renovacao: Number(result?.zona_renovacao || 0),
        recompra: Number(result?.recompra || 0),
        recompra_total: Number(result?.recompra_total || 0),
      };
    },
    enabled: isAdminView || !!vendedor,
  });

  // Expanded stage clients via RPC
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["funil-clients", expandedStage, isAdminView ? "admin" : vendedor?.id],
    queryFn: async (): Promise<ClienteItem[]> => {
      if (!expandedStage) return [];
      const vendedorFilter = isAdminView ? null : vendedor?.id;

      const { data, error } = await supabase.rpc("get_funil_stage_list", {
        p_vendedor_id: vendedorFilter || null,
        p_stage: expandedStage,
        p_limit: 500,
      });
      if (error) throw error;

      const rows = (data as any[]) || [];
      const phones = rows.map((r: any) => r.telefone).filter(Boolean) as string[];
      const clienteIds = rows.map((r: any) => r.id).filter(Boolean) as string[];
      
      const [whatsappMap, trackingMap] = await Promise.all([
        fetchWhatsAppStatuses(phones),
        fetchFunilTracking(clienteIds),
      ]);

      return rows.map((r: any) => ({
        id: r.id,
        nome_igreja: r.nome_igreja,
        telefone: r.telefone,
        whatsapp_status: r.telefone ? whatsappMap[r.telefone] || null : null,
        valor_compra: r.valor_compra != null ? Number(r.valor_compra) : undefined,
        data_compra: r.data_compra || undefined,
        email_superintendente: r.email_superintendente,
        senha_temporaria: r.senha_temporaria,
        ultimo_login: r.ultimo_login,
        data_primeira_compra: r.data_primeira_compra || undefined,
        data_recompra: r.data_recompra || undefined,
        dias_entre_compras: r.dias_entre_compras != null ? Number(r.dias_entre_compras) : undefined,
        valor_primeira_compra: r.valor_primeira_compra != null ? Number(r.valor_primeira_compra) : undefined,
        funil_tracking: clienteIds.length > 0 ? trackingMap[r.id] || null : null,
      }));
    },
    enabled: !!expandedStage && (isAdminView || !!vendedor),
  });

  const formatLoginDate = (date: string | null | undefined) => {
    if (!date) return "Nunca";
    return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Funil de Vendas</h1>
        <p className="text-muted-foreground">
          {isAdminView ? "Visão geral de todos os clientes em cada etapa do ciclo de 90 dias." : "Acompanhe seus clientes em cada etapa do ciclo de 90 dias."}
        </p>
      </div>

      {/* Funnel Layout */}
      <div className="space-y-2 max-w-3xl mx-auto">
        {stages.map((stage) => {
          const count = counts?.[stage.key] ?? 0;
          const isExpanded = expandedStage === stage.key;
          const extraLabel = stage.key === "compra_aprovada" && counts?.compra_aprovada_total
            ? ` (R$ ${Number(counts.compra_aprovada_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`
            : stage.key === "recompra" && counts?.recompra_total
            ? ` (R$ ${Number(counts.recompra_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`
            : "";

          return (
            <div key={stage.key}>
              <div
                className="flex items-center gap-4 cursor-pointer group"
                onClick={() => setExpandedStage(isExpanded ? null : stage.key)}
              >
                <div
                  className={`${stage.color} rounded-md h-12 flex items-center justify-center transition-all hover:opacity-90 ${isExpanded ? "ring-2 ring-offset-2 ring-foreground/20" : ""}`}
                  style={{ width: `${stage.widthPercent}%` }}
                >
                  {countsLoading ? (
                    <Skeleton className="h-6 w-10 bg-white/30" />
                  ) : (
                    <span className="text-white font-bold text-lg">{count}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">
                    {stage.label}{extraLabel}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>

              {isExpanded && (
                <Card className="mt-2 mb-2">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      {stage.label}
                      <Badge variant="outline">{clients?.length || 0} clientes</Badge>
                      {stage.key === "compra_aprovada" && (
                        <span className="text-xs text-muted-foreground font-normal">(a partir de Jan/2026)</span>
                      )}
                    </h3>

                    {clientsLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : clients && clients.length > 0 ? (
                      <div className="divide-y">
                        {clients.map((client) => (
                          <div key={client.id} className="py-3 space-y-1">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{client.nome_igreja}</p>
                              </div>
                              {client.valor_compra != null && (
                                <div className="flex items-center gap-1 text-sm font-medium text-green-600 shrink-0">
                                  <DollarSign className="h-3 w-3" />
                                  R$ {client.valor_compra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </div>
                              )}
                              {client.data_compra && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(client.data_compra).toLocaleDateString("pt-BR")}
                                </div>
                              )}
                              <div className="flex items-center gap-1 shrink-0">
                                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                                {getWhatsAppBadge(client.whatsapp_status)}
                              </div>
                              {client.funil_tracking && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <Zap className="h-3 w-3 text-muted-foreground" />
                                  <Badge className={`${faseColors[client.funil_tracking.fase_atual] || "bg-gray-500"} text-white text-xs`}>
                                    F{client.funil_tracking.fase_atual}: {faseLabels[client.funil_tracking.fase_atual] || "?"}
                                  </Badge>
                                  {client.funil_tracking.fase1_link_clicado && (
                                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">Clicou</Badge>
                                  )}
                                  {client.funil_tracking.concluido && (
                                    <Badge className="bg-emerald-600 text-white text-xs">Concluído</Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              {client.telefone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {client.telefone}
                                </span>
                              )}
                              {client.email_superintendente && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {client.email_superintendente}
                                </span>
                              )}
                              {client.senha_temporaria && (
                                <span className="flex items-center gap-1">
                                  <Lock className="h-3 w-3" /> {client.senha_temporaria}
                                </span>
                              )}
                              {expandedStage !== "compra_aprovada" && expandedStage !== "recompra" && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> Último login: {formatLoginDate(client.ultimo_login)}
                                </span>
                              )}
                              {expandedStage === "recompra" && (
                                <>
                                  {client.data_primeira_compra && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" /> 1ª compra: {new Date(client.data_primeira_compra).toLocaleDateString("pt-BR")}
                                      {client.valor_primeira_compra != null && (
                                        <span className="text-green-600 font-medium ml-1">
                                          (R$ {client.valor_primeira_compra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                                        </span>
                                      )}
                                    </span>
                                  )}
                                  {client.data_recompra && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" /> 2ª compra: {new Date(client.data_recompra).toLocaleDateString("pt-BR")}
                                    </span>
                                  )}
                                  {client.dias_entre_compras != null && (
                                    <Badge variant="outline" className="text-xs font-normal">
                                      {client.dias_entre_compras} dias
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente nesta etapa.</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Helper to fetch WhatsApp message statuses for a list of phones */
async function fetchWhatsAppStatuses(phones: string[]): Promise<Record<string, string>> {
  const whatsappMap: Record<string, string> = {};
  if (phones.length === 0) return whatsappMap;
  const { data: msgs } = await supabase
    .from("whatsapp_mensagens")
    .select("telefone_destino, status, created_at")
    .in("telefone_destino", phones)
    .order("created_at", { ascending: false });
  if (msgs) {
    for (const msg of msgs) {
      if (!whatsappMap[msg.telefone_destino]) {
        whatsappMap[msg.telefone_destino] = msg.status;
      }
    }
  }
  return whatsappMap;
}

/** Helper to fetch funil pós-venda tracking for a list of cliente IDs */
async function fetchFunilTracking(clienteIds: string[]): Promise<Record<string, FunilTracking>> {
  const trackingMap: Record<string, FunilTracking> = {};
  if (clienteIds.length === 0) return trackingMap;
  const { data } = await supabase
    .from("funil_posv_tracking")
    .select("cliente_id, fase_atual, fase1_link_clicado, concluido, ultima_mensagem_em")
    .in("cliente_id", clienteIds);
  if (data) {
    for (const row of data) {
      trackingMap[row.cliente_id] = {
        fase_atual: row.fase_atual,
        fase1_link_clicado: row.fase1_link_clicado,
        concluido: row.concluido,
        ultima_mensagem_em: row.ultima_mensagem_em,
      };
    }
  }
  return trackingMap;
}
