import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, LogIn, Settings, CheckCircle, AlertTriangle, Phone, MessageSquare } from "lucide-react";
import { useVendedor } from "@/hooks/useVendedor";

type FunnelStage = "compra_aprovada" | "aguardando_login" | "pendente_config" | "ativos" | "zona_renovacao";

interface ClienteItem {
  id: string;
  nome_igreja: string;
  telefone: string | null;
  whatsapp_status: string | null;
}

const stages = [
  { key: "compra_aprovada" as FunnelStage, label: "Compra Aprovada", icon: ShoppingCart, color: "bg-blue-500", textColor: "text-blue-600", borderColor: "border-blue-500" },
  { key: "aguardando_login" as FunnelStage, label: "Aguardando Login", icon: LogIn, color: "bg-yellow-500", textColor: "text-yellow-600", borderColor: "border-yellow-500" },
  { key: "pendente_config" as FunnelStage, label: "Pendente Config.", icon: Settings, color: "bg-orange-500", textColor: "text-orange-600", borderColor: "border-orange-500" },
  { key: "ativos" as FunnelStage, label: "Ativos", icon: CheckCircle, color: "bg-green-500", textColor: "text-green-600", borderColor: "border-green-500" },
  { key: "zona_renovacao" as FunnelStage, label: "Zona de Renovação", icon: AlertTriangle, color: "bg-red-500", textColor: "text-red-600", borderColor: "border-red-500" },
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

export default function VendedorFunil() {
  const [expandedStage, setExpandedStage] = useState<FunnelStage | null>(null);
  const { vendedor } = useVendedor();

  // Counts query
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["funil-counts", vendedor?.id],
    queryFn: async () => {
      const vendedorFilter = vendedor?.id;

      // Compra Aprovada - pos venda ecommerce pendente
      let q1 = supabase.from("ebd_pos_venda_ecommerce").select("id", { count: "exact", head: true }).eq("status", "pendente");
      if (vendedorFilter) q1 = q1.eq("vendedor_id", vendedorFilter);
      const { count: compraAprovada } = await q1;

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
        compra_aprovada: compraAprovada || 0,
        aguardando_login: aguardandoLogin || 0,
        pendente_config: pendenteConfig || 0,
        ativos: ativos || 0,
        zona_renovacao: zonaRenovacao || 0,
      };
    },
    enabled: !!vendedor,
  });

  // Expanded stage clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["funil-clients", expandedStage, vendedor?.id],
    queryFn: async (): Promise<ClienteItem[]> => {
      if (!expandedStage) return [];
      const vendedorFilter = vendedor?.id;

      let results: { id: string; nome_igreja: string; telefone: string | null }[] = [];

      if (expandedStage === "compra_aprovada") {
        let q = supabase.from("ebd_pos_venda_ecommerce").select("id, cliente_id").eq("status", "pendente");
        if (vendedorFilter) q = q.eq("vendedor_id", vendedorFilter);
        const { data } = await q.limit(100);
        if (data && data.length > 0) {
          const clienteIds = data.map((d) => d.cliente_id).filter(Boolean) as string[];
          if (clienteIds.length > 0) {
            const { data: clientes } = await supabase.from("ebd_clientes").select("id, nome_igreja, telefone").in("id", clienteIds);
            results = clientes || [];
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
          // Keep only latest per phone
          for (const msg of msgs) {
            if (!whatsappMap[msg.telefone_destino]) {
              whatsappMap[msg.telefone_destino] = msg.status;
            }
          }
        }
      }

      return results.map((r) => ({
        ...r,
        whatsapp_status: r.telefone ? whatsappMap[r.telefone] || null : null,
      }));
    },
    enabled: !!expandedStage && !!vendedor,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Funil de Vendas</h1>
        <p className="text-muted-foreground">Acompanhe seus clientes em cada etapa do ciclo de 90 dias.</p>
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
                    <div className="flex items-center gap-1">
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
