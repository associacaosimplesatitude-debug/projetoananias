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

  // Buscar clientes atribuídos do e-commerce que ainda não ativaram o painel
  const { data: clientesPosVenda = [], isLoading, refetch } = useQuery({
    queryKey: ["vendedor-pos-venda", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];

      // 1) Clientes do vendedor com painel ainda NÃO ativado
      const { data: clientes, error: clientesError } = await supabase
        .from("ebd_clientes")
        .select("*")
        .eq("vendedor_id", vendedor.id)
        .eq("status_ativacao_ebd", false)
        .order("created_at", { ascending: false });

      if (clientesError) throw clientesError;
      if (!clientes || clientes.length === 0) return [];

      // 2) Identificar quais desses clientes vieram do e-commerce (tem pedido Shopify pelo e-mail)
      const emails = Array.from(
        new Set(
          clientes
            .map((c: any) => (c.email_superintendente || "").toLowerCase().trim())
            .filter(Boolean)
        )
      );

      if (emails.length === 0) return [];

      const { data: pedidos, error: pedidosError } = await supabase
        .from("ebd_shopify_pedidos")
        .select("customer_email")
        .in("customer_email", emails);

      if (pedidosError) throw pedidosError;

      const emailsComPedido = new Set(
        (pedidos || [])
          .map((p: any) => (p.customer_email || "").toLowerCase().trim())
          .filter(Boolean)
      );

      // Pós-venda e-commerce = (tem pedido) + (painel não ativado)
      return (clientes as any[]).filter((c: any) =>
        emailsComPedido.has((c.email_superintendente || "").toLowerCase().trim())
      ) as Cliente[];
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
