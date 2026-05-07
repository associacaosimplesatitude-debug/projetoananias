import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RetencaoKanban, type KanbanCliente } from "@/components/admin/retencao/RetencaoKanban";
import { DispararCampanhaModal } from "@/components/admin/retencao/DispararCampanhaModal";
import { useUserRole } from "@/hooks/useUserRole";
import { useVendedor } from "@/hooks/useVendedor";
import { Shield, AlertTriangle, Clock, XCircle, CheckCircle, Megaphone } from "lucide-react";

interface RetencaoDashboard {
  faixas: { verde: number; amarelo: number; vermelho: number; perdido: number; fechados: number };
  kanban_clientes: KanbanCliente[];
}

export default function EbdRetencao() {
  const { isAdmin, isGerenteEbd } = useUserRole();
  const { vendedor } = useVendedor();
  const [filtroVendedor, setFiltroVendedor] = useState<string>("");
  const [filtroCanal, setFiltroCanal] = useState<string>("");
  const [campanhaOpen, setCampanhaOpen] = useState(false);
  const queryClient = useQueryClient();
  const podeDisparar = isAdmin || isGerenteEbd;

  // For non-admin, use their vendedor_id
  const vendedorIdParam = isAdmin ? (filtroVendedor || null) : vendedor?.id || null;

  const { data, isLoading } = useQuery<RetencaoDashboard>({
    queryKey: ["retencao-dashboard", vendedorIdParam],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_retencao_dashboard", {
        p_vendedor_id: vendedorIdParam,
      });
      if (error) throw error;
      return data as unknown as RetencaoDashboard;
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Realtime: atualiza quando chega novo contato (ex.: clique em botão WhatsApp)
  useEffect(() => {
    const channel = supabase
      .channel("retencao-contatos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ebd_retencao_contatos" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["retencao-dashboard"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Load vendedores for filter (admin only)
  const { data: vendedores } = useQuery({
    queryKey: ["vendedores-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendedores")
        .select("id, nome")
        .eq("status", "ativo")
        .order("nome");
      return data || [];
    },
    enabled: isAdmin,
  });

  // Load disparos map (last sent date per cliente)
  const { data: disparosMap = {} } = useQuery<Record<string, string>>({
    queryKey: ["retencao-disparos-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("retencao_disparos")
        .select("cliente_id, enviado_em")
        .eq("status", "sucesso")
        .order("enviado_em", { ascending: false });
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => {
        if (!map[r.cliente_id]) map[r.cliente_id] = r.enviado_em;
      });
      return map;
    },
    enabled: podeDisparar,
  });

  const faixas = data?.faixas || { verde: 0, amarelo: 0, vermelho: 0, perdido: 0, fechados: 0 };

  const cards = [
    { label: "Ativos (0-30d)", value: faixas.verde, icon: Shield, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
    { label: "Atenção (30-60d)", value: faixas.amarelo, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30" },
    { label: "Crítico (60-90d)", value: faixas.vermelho, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
    { label: "Urgente (90+d)", value: faixas.perdido, icon: XCircle, color: "text-muted-foreground", bg: "bg-muted/40" },
    { label: "Fechados (mês atual)", value: faixas.fechados, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🔄 Retenção de Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe clientes por tempo desde a última compra e registre contatos
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {cards.map(c => (
          <Card key={c.label} className={c.bg}>
            <CardContent className="p-4 flex items-center gap-3">
              <c.icon className={`h-8 w-8 ${c.color}`} />
              <div>
                {isLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                )}
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {isAdmin && (
          <Select value={filtroVendedor} onValueChange={v => setFiltroVendedor(v === "todos" ? "" : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos os vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os vendedores</SelectItem>
              {vendedores?.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={filtroCanal} onValueChange={v => setFiltroCanal(v === "todos" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os canais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os canais</SelectItem>
            <SelectItem value="E-commerce">E-commerce</SelectItem>
            <SelectItem value="Mercado Pago">Mercado Pago</SelectItem>
            <SelectItem value="Faturado">Faturado</SelectItem>
          </SelectContent>
        </Select>

        {podeDisparar && (
          <>
            <Button
              variant="outline"
              onClick={async () => {
                const { toast } = await import("sonner");
                toast.info("Disparando backfill (pode demorar)...");
                const { data, error } = await supabase.functions.invoke("backfill-interesse-presente");
                if (error) toast.error("Erro: " + error.message);
                else toast.success(`Backfill: ${data?.sucesso ?? 0} ok, ${data?.falha ?? 0} falha (total ${data?.total ?? 0})`);
              }}
            >
              Reenviar interesse pendentes
            </Button>
            <Button onClick={() => setCampanhaOpen(true)}>
              <Megaphone className="h-4 w-4 mr-2" />
              Disparar campanha WhatsApp
            </Button>
          </>
        )}
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : (
        <RetencaoKanban
          clientes={data?.kanban_clientes || []}
          filtroVendedor={filtroVendedor}
          filtroCanal={filtroCanal}
          disparosMap={disparosMap}
        />
      )}

      {podeDisparar && (
        <DispararCampanhaModal
          open={campanhaOpen}
          onOpenChange={setCampanhaOpen}
          clientes={data?.kanban_clientes || []}
          onDispatched={() => {
            queryClient.invalidateQueries({ queryKey: ["retencao-dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["retencao-disparos-map"] });
          }}
        />
      )}
    </div>
  );
}
