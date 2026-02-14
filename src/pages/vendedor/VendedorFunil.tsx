import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, LogIn, Settings, CheckCircle, AlertTriangle, Phone, MessageSquare, DollarSign, Calendar, Mail, Lock, Clock, ChevronDown } from "lucide-react";
import { useVendedor } from "@/hooks/useVendedor";

type FunnelStage = "compra_aprovada" | "aguardando_login" | "pendente_config" | "ativos" | "zona_renovacao";

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
}

const stages = [
  { key: "compra_aprovada" as FunnelStage, label: "Primeira Compra", icon: ShoppingCart, color: "bg-red-500", widthPercent: 100 },
  { key: "aguardando_login" as FunnelStage, label: "Aguardando Login", icon: LogIn, color: "bg-orange-500", widthPercent: 80 },
  { key: "pendente_config" as FunnelStage, label: "Pendente Config.", icon: Settings, color: "bg-yellow-500", widthPercent: 60 },
  { key: "ativos" as FunnelStage, label: "Ativos", icon: CheckCircle, color: "bg-emerald-500", widthPercent: 40 },
  { key: "zona_renovacao" as FunnelStage, label: "Zona de Renovação", icon: AlertTriangle, color: "bg-green-700", widthPercent: 25 },
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

  // Counts + total value query
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["funil-counts", isAdminView ? "admin" : vendedor?.id],
    queryFn: async () => {
      const vendedorFilter = isAdminView ? null : vendedor?.id;

      // Primeira Compra - count + total via new RPC
      const { data: primeiraCompraData } = await supabase.rpc("get_primeira_compra_funil_total", {
        p_vendedor_id: vendedorFilter || null,
      });
      const primeiraCompra = primeiraCompraData as any;

      // Aguardando Login - ultimo_login IS NULL
      let q2 = supabase.from("ebd_clientes").select("id", { count: "exact", head: true })
        .is("ultimo_login", null);
      if (vendedorFilter) q2 = q2.eq("vendedor_id", vendedorFilter);
      const { count: aguardandoLogin } = await q2;

      // Pendente Config - ultimo_login IS NOT NULL AND onboarding_concluido = false
      let q3 = supabase.from("ebd_clientes").select("id", { count: "exact", head: true })
        .not("ultimo_login", "is", null).eq("onboarding_concluido", false);
      if (vendedorFilter) q3 = q3.eq("vendedor_id", vendedorFilter);
      const { count: pendenteConfig } = await q3;

      // Ativos - ultimo_login IS NOT NULL AND onboarding_concluido = true AND login nos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      let q4 = supabase.from("ebd_clientes").select("id", { count: "exact", head: true })
        .not("ultimo_login", "is", null).eq("onboarding_concluido", true)
        .gte("ultimo_login", thirtyDaysAgo.toISOString());
      if (vendedorFilter) q4 = q4.eq("vendedor_id", vendedorFilter);
      const { count: ativos } = await q4;

      // Zona de Renovação
      const today = new Date().toISOString().split("T")[0];
      const in15 = new Date();
      in15.setDate(in15.getDate() + 15);
      const in15Str = in15.toISOString().split("T")[0];
      let q5 = supabase.from("ebd_clientes").select("id", { count: "exact", head: true })
        .gte("data_proxima_compra", today).lte("data_proxima_compra", in15Str);
      if (vendedorFilter) q5 = q5.eq("vendedor_id", vendedorFilter);
      const { count: zonaRenovacao } = await q5;

      return {
        compra_aprovada: primeiraCompra?.count || 0,
        compra_aprovada_total: primeiraCompra?.total || 0,
        aguardando_login: aguardandoLogin || 0,
        pendente_config: pendenteConfig || 0,
        ativos: ativos || 0,
        zona_renovacao: zonaRenovacao || 0,
      };
    },
    enabled: isAdminView || !!vendedor,
  });

  // Expanded stage clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["funil-clients", expandedStage, isAdminView ? "admin" : vendedor?.id],
    queryFn: async (): Promise<ClienteItem[]> => {
      if (!expandedStage) return [];
      const vendedorFilter = isAdminView ? null : vendedor?.id;

      // Primeira Compra - via RPC
      if (expandedStage === "compra_aprovada") {
        const { data: primeiraCompraData } = await supabase.rpc("get_primeira_compra_funil_list", {
          p_vendedor_id: vendedorFilter || null,
          p_limit: 500,
        });
        if (!primeiraCompraData || primeiraCompraData.length === 0) return [];
        const phones = (primeiraCompraData as any[]).map((r: any) => r.customer_phone).filter(Boolean) as string[];
        const whatsappMap = await fetchWhatsAppStatuses(phones);
        return (primeiraCompraData as any[]).map((r: any) => ({
          id: r.id,
          nome_igreja: r.customer_name || r.customer_email,
          telefone: r.customer_phone,
          whatsapp_status: r.customer_phone ? whatsappMap[r.customer_phone] || null : null,
          valor_compra: r.valor_total,
          data_compra: r.created_at,
        }));
      }

      // Outras etapas - consulta ebd_clientes com email, senha, ultimo_login
      let q = supabase.from("ebd_clientes").select("id, nome_igreja, telefone, email_superintendente, senha_temporaria, ultimo_login");
      if (vendedorFilter) q = q.eq("vendedor_id", vendedorFilter);

      if (expandedStage === "aguardando_login") {
        q = q.is("ultimo_login", null);
      } else if (expandedStage === "pendente_config") {
        q = q.not("ultimo_login", "is", null).eq("onboarding_concluido", false);
      } else if (expandedStage === "ativos") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        q = q.not("ultimo_login", "is", null).eq("onboarding_concluido", true).gte("ultimo_login", thirtyDaysAgo.toISOString());
      } else if (expandedStage === "zona_renovacao") {
        const today = new Date().toISOString().split("T")[0];
        const in15 = new Date();
        in15.setDate(in15.getDate() + 15);
        q = q.gte("data_proxima_compra", today).lte("data_proxima_compra", in15.toISOString().split("T")[0]);
      }

      const { data } = await q.limit(500);
      const results = data || [];
      const phones = results.map((r) => r.telefone).filter(Boolean) as string[];
      const whatsappMap = await fetchWhatsAppStatuses(phones);

      return results.map((r) => ({
        id: r.id,
        nome_igreja: r.nome_igreja,
        telefone: r.telefone,
        whatsapp_status: r.telefone ? whatsappMap[r.telefone] || null : null,
        email_superintendente: r.email_superintendente,
        senha_temporaria: r.senha_temporaria,
        ultimo_login: r.ultimo_login,
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
            : "";

          return (
            <div key={stage.key}>
              <div
                className="flex items-center gap-4 cursor-pointer group"
                onClick={() => setExpandedStage(isExpanded ? null : stage.key)}
              >
                {/* Funnel bar */}
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
                {/* Label outside */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">
                    {stage.label}{extraLabel}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* Expanded Client List */}
              {isExpanded && (
                <Card className="mt-2 mb-2">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      {stage.label}
                      <Badge variant="outline">{clients?.length || 0} clientes</Badge>
                      {stage.key === "compra_aprovada" && (
                        <span className="text-xs text-muted-foreground font-normal">(a partir de Dez/2025)</span>
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
                            </div>
                            {/* Details row */}
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
                              {expandedStage !== "compra_aprovada" && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> Último login: {formatLoginDate(client.ultimo_login)}
                                </span>
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
