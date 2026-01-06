import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag } from "lucide-react";
import { useVendedor } from "@/hooks/useVendedor";
import { PlaybookClienteCard } from "@/components/vendedor/PlaybookClienteCard";

interface Cliente {
  id: string;
  nome_igreja: string;
  nome_superintendente: string | null;
  email_superintendente: string | null;
  telefone: string | null;
  cnpj: string | null;
  status_ativacao_ebd: boolean;
  ultimo_login: string | null;
  data_proxima_compra: string | null;
  data_inicio_ebd: string | null;
  senha_temporaria: string | null;
}

export default function VendedorPosVenda() {
  const { vendedor, isLoading: vendedorLoading } = useVendedor();

  // Buscar clientes que tem pedidos Shopify mas não ativaram o painel
  const { data: clientesPosVenda = [], isLoading, refetch } = useQuery({
    queryKey: ["vendedor-pos-venda", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];
      
      // Primeiro, buscar os IDs de clientes que tem pedidos
      const { data: pedidosClientes, error: pedidosError } = await supabase
        .from("ebd_shopify_pedidos")
        .select("cliente_id")
        .eq("vendedor_id", vendedor.id)
        .not("cliente_id", "is", null);
      
      if (pedidosError) throw pedidosError;
      
      const clienteIds = [...new Set(pedidosClientes.map(p => p.cliente_id).filter(Boolean))];
      
      if (clienteIds.length === 0) return [];
      
      // Buscar esses clientes que NÃO ativaram o painel
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("*")
        .eq("vendedor_id", vendedor.id)
        .eq("status_ativacao_ebd", false)
        .in("id", clienteIds)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Cliente[];
    },
    enabled: !!vendedor?.id,
  });

  if (vendedorLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-blue-500" />
          Pós-Venda E-commerce
        </h2>
        <p className="text-muted-foreground">
          Clientes que compraram na loja mas ainda não ativaram o painel
        </p>
      </div>

      {clientesPosVenda.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum cliente pendente de pós-venda
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Clientes que compram na loja e ainda não ativaram o painel aparecerão aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clientesPosVenda.map((cliente) => (
            <PlaybookClienteCard
              key={cliente.id}
              cliente={cliente}
              type="pos_venda"
              onRefresh={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
