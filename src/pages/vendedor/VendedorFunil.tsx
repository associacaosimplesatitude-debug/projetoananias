import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, LogIn, Settings, CheckCircle, AlertTriangle, Phone, MessageSquare, DollarSign, Calendar } from "lucide-react";
import { useVendedor } from "@/hooks/useVendedor";

type FunnelStage = "compra_aprovada" | "aguardando_login" | "pendente_config" | "ativos" | "zona_renovacao";

interface ClienteItem {
  id: string;
  nome_igreja: string;
  telefone: string | null;
  whatsapp_status: string | null;
  valor_compra?: number;
  data_compra?: string;
}

const stages = [
  { key: "compra_aprovada" as FunnelStage, label: "Primeira Compra", icon: ShoppingCart, color: "bg-blue-500", textColor: "text-blue-600", borderColor: "border-blue-500" },
  { key: "aguardando_login" as FunnelStage, label: "Aguardando Login", icon: LogIn, color: "bg-yellow-500", textColor: "text-yellow-600", borderColor: "border-yellow-500" },
  { key: "pendente_config" as FunnelStage, label: "Pendente Config.", icon: Settings, color: "bg-orange-500", textColor: "text-orange-600", borderColor: "border-orange-500" },
  { key: "ativos" as FunnelStage, label: "Ativos", icon: CheckCircle, color: "bg-green-500", textColor: "text-green-600", borderColor: "border-green-500" },
  { key: "zona_renovacao" as FunnelStage, label: "Zona de Renovação", icon: AlertTriangle, color: "bg-red-500", textColor: "text-red-600", borderColor: "border-red-500" },
];

const PRIMEIRA_COMPRA_START = "2025-12-01T00:00:00Z";

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

/** Helper: fetch pedido IDs from ebd_shopify_pedidos created >= Dec 2025 */
async function fetchPedidoIdsDezembro(): Promise<string[]> {
  const { data } = await supabase
    .from("ebd_shopify_pedidos")
    .select("id")
    .gte("created_at", PRIMEIRA_COMPRA_START);
  return data?.map((d) => d.id) || [];
}

export default function VendedorFunil({ isAdminView = false }: VendedorFunilProps) {
  const [expandedStage, setExpandedStage] = useState<FunnelStage | null>(null);
  const { vendedor } = useVendedor();

  // Counts query
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["funil-counts", isAdminView ? "admin" : vendedor?.id],
    queryFn: async () => {
      const vendedorFilter = isAdminView ? null : vendedor?.id;

      // Compra Aprovada - filtered by pedidos from Dec/2025+
      const pedidoIds = await fetchPedidoIdsDezembro();
      let compraAprovada = 0;
      if (pedidoIds.length > 0) {
        // Process in batches of 100 to avoid URL length limits
        for (let i = 0; i < pedidoIds.length; i += 100) {
          const batch = pedidoIds.slice(i, i + 100);
          let q1 = supabase.from("ebd_pos_venda_ecommerce")
            .select("id", { count: "exact", head: true })
            .eq("status", "pendente")
            .in("pedido_id", batch);
          if (vendedorFilter) q1 = q1.eq("vendedor_id", vendedorFilter);
          const { count } = await q1;
          compraAprovada += count || 0;
        }
      }

      // Aguardando Login
      let q2 = supabase.from("ebd_clientes").select("id", { count: "exact", head: true })
        .eq("status_ativacao_ebd", false).eq("is_pos_venda_ecommerce", false);
      if (vendedorFilter) q2 = q2.eq("vendedor_id", vendedorFilter);
      const { count: aguardandoLogin } = await q2;

      // Pendente Config
      let q3 = supabase.from("ebd_clientes").select("id", { count: "exact", head: true })
        .eq("status_ativacao_ebd", true).eq("onboarding_concluido", false);
      if (vendedorFilter) q3 = q3.eq("vendedor_id", vendedorFilter);
      const { count: pendenteConfig } = await q3;

      // Ativos (login nos últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      let q4 = supabase.from("ebd_clientes").select("id", { count: "exact", head: true })
        .eq("status_ativacao_ebd", true).eq("onboarding_concluido", true)
        .gte("ultimo_login", thirtyDaysAgo.toISOString());
      if (vendedorFilter) q4 = q4.eq("vendedor_id", vendedorFilter);
      const { count: ativos } = await q4;

      // Zona de Renovação (próxima compra entre hoje e hoje+15)
      const today = new Date().toISOString().split("T")[0];
      const in15 = new Date();
      in15.setDate(in15.getDate() + 15);
      const in15Str = in15.toISOString().split("T")[0];
      let q5 = supabase.from("ebd_clientes").select("id", { count: "exact", head: true })
        .gte("data_proxima_compra", today).lte("data_proxima_compra", in15Str);
      if (vendedorFilter) q5 = q5.eq("vendedor_id", vendedorFilter);
      const { count: zonaRenovacao } = await q5;

      return {
        compra_aprovada: compraAprovada,
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

      let results: { id: string; nome_igreja: string; telefone: string | null; valor_compra?: number; data_compra?: string }[] = [];

      if (expandedStage === "compra_aprovada") {
        // 1. Fetch pos_venda records
        let q = supabase.from("ebd_pos_venda_ecommerce").select("id, cliente_id, pedido_id").eq("status", "pendente");
        if (vendedorFilter) q = q.eq("vendedor_id", vendedorFilter);
        const { data: posVendaData } = await q.limit(500);

        if (posVendaData && posVendaData.length > 0) {
          const pedidoIds = posVendaData.map((d) => d.pedido_id).filter(Boolean) as string[];

          // 2. Fetch pedidos from Dec/2025+ with valor and date
          let pedidoMap: Record<string, { valor_total: number; created_at: string }> = {};
          if (pedidoIds.length > 0) {
            const { data: pedidos } = await supabase
              .from("ebd_shopify_pedidos")
              .select("id, valor_total, created_at")
              .in("id", pedidoIds)
              .gte("created_at", PRIMEIRA_COMPRA_START);

            if (pedidos) {
              for (const p of pedidos) {
                pedidoMap[p.id] = { valor_total: p.valor_total, created_at: p.created_at };
              }
            }
          }

          // 3. Filter pos_venda to only those with valid pedidos (Dec/2025+)
          const filteredPosVenda = posVendaData.filter((d) => d.pedido_id && pedidoMap[d.pedido_id]);
          const clienteIds = filteredPosVenda.map((d) => d.cliente_id).filter(Boolean) as string[];

          if (clienteIds.length > 0) {
            const { data: clientes } = await supabase.from("ebd_clientes").select("id, nome_igreja, telefone").in("id", clienteIds);
            if (clientes) {
              // Build a map from cliente_id -> pedido info
              const clientePedidoMap: Record<string, { valor_total: number; created_at: string }> = {};
              for (const pv of filteredPosVenda) {
                if (pv.cliente_id && pv.pedido_id && pedidoMap[pv.pedido_id]) {
                  clientePedidoMap[pv.cliente_id] = pedidoMap[pv.pedido_id];
                }
              }

              results = clientes.map((c) => ({
                ...c,
                valor_compra: clientePedidoMap[c.id]?.valor_total,
                data_compra: clientePedidoMap[c.id]?.created_at,
              }));
            }
          }
        }
      } else {
        let q = supabase.from("ebd_clientes").select("id, nome_igreja, telefone");
        if (vendedorFilter) q = q.eq("vendedor_id", vendedorFilter);

        if (expandedStage === "aguardando_login") {
          q = q.eq("status_ativacao_ebd", false).eq("is_pos_venda_ecommerce", false);
        } else if (expandedStage === "pendente_config") {
          q = q.eq("status_ativacao_ebd", true).eq("onboarding_concluido", false);
        } else if (expandedStage === "ativos") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          q = q.eq("status_ativacao_ebd", true).eq("onboarding_concluido", true).gte("ultimo_login", thirtyDaysAgo.toISOString());
        } else if (expandedStage === "zona_renovacao") {
          const today = new Date().toISOString().split("T")[0];
          const in15 = new Date();
          in15.setDate(in15.getDate() + 15);
          q = q.gte("data_proxima_compra", today).lte("data_proxima_compra", in15.toISOString().split("T")[0]);
        }

        const { data } = await q.limit(100);
        results = data || [];
      }

      // Fetch WhatsApp status for each client
      const phones = results.map((r) => r.telefone).filter(Boolean) as string[];
      let whatsappMap: Record<string, string> = {};

      if (phones.length > 0) {
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
      }

      return results.map((r) => ({
        id: r.id,
        nome_igreja: r.nome_igreja,
        telefone: r.telefone,
        whatsapp_status: r.telefone ? whatsappMap[r.telefone] || null : null,
        valor_compra: r.valor_compra,
        data_compra: r.data_compra,
      }));
    },
    enabled: !!expandedStage && (isAdminView || !!vendedor),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Funil de Vendas</h1>
        <p className="text-muted-foreground">
          {isAdminView ? "Visão geral de todos os clientes em cada etapa do ciclo de 90 dias." : "Acompanhe seus clientes em cada etapa do ciclo de 90 dias."}
        </p>
      </div>

      {/* Funnel Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stages.map((stage) => {
          const Icon = stage.icon;
          const count = counts?.[stage.key] ?? 0;
          const isExpanded = expandedStage === stage.key;

          return (
            <Card
              key={stage.key}
              className={`cursor-pointer transition-all hover:shadow-md ${isExpanded ? `ring-2 ring-offset-2 ${stage.borderColor}` : ""}`}
              onClick={() => setExpandedStage(isExpanded ? null : stage.key)}
            >
              <CardContent className="p-4 text-center space-y-2">
                <div className={`mx-auto w-10 h-10 rounded-full ${stage.color} flex items-center justify-center`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                {countsLoading ? (
                  <Skeleton className="h-8 w-12 mx-auto" />
                ) : (
                  <p className={`text-2xl font-bold ${stage.textColor}`}>{count}</p>
                )}
                <p className="text-xs text-muted-foreground font-medium">{stage.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Expanded Client List */}
      {expandedStage && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              {stages.find((s) => s.key === expandedStage)?.label}
              <Badge variant="outline">{clients?.length || 0} clientes</Badge>
              {expandedStage === "compra_aprovada" && (
                <span className="text-xs text-muted-foreground font-normal">(a partir de Dez/2025)</span>
              )}
            </h3>

            {clientsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : clients && clients.length > 0 ? (
              <div className="divide-y">
                {clients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{client.nome_igreja}</p>
                      {client.telefone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {client.telefone}
                        </p>
                      )}
                    </div>
                    {/* Valor e Data da compra - só para Primeira Compra */}
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
}
