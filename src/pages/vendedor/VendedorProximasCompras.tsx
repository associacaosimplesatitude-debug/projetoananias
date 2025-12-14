import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useVendedor } from "@/hooks/useVendedor";

interface Cliente {
  id: string;
  nome_igreja: string;
  nome_superintendente: string | null;
  email_superintendente: string | null;
  telefone: string | null;
  data_proxima_compra: string | null;
  status_ativacao_ebd: boolean;
}

export default function VendedorProximasCompras() {
  const navigate = useNavigate();
  const { vendedor, isLoading: vendedorLoading } = useVendedor();

  const { data: clientesProximaCompra = [], isLoading } = useQuery({
    queryKey: ["vendedor-proximas-compras", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("*")
        .eq("vendedor_id", vendedor.id)
        .eq("status_ativacao_ebd", true)
        .not("data_proxima_compra", "is", null)
        .order("data_proxima_compra", { ascending: true });
      if (error) throw error;
      return data as Cliente[];
    },
    enabled: !!vendedor?.id,
  });

  const handleFazerPedido = (cliente: Cliente) => {
    navigate(`/vendedor/shopify?clienteId=${cliente.id}&clienteNome=${encodeURIComponent(cliente.nome_igreja)}`);
  };

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
        <h2 className="text-2xl font-bold">Próximas Compras Previstas</h2>
        <p className="text-muted-foreground">Clientes ordenados por data prevista da próxima compra</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {clientesProximaCompra.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma previsão de compra
            </p>
          ) : (
            <div className="space-y-4">
              {clientesProximaCompra.map((cliente) => {
                const diasRestantes = differenceInDays(
                  new Date(cliente.data_proxima_compra!),
                  new Date()
                );
                const isUrgent = diasRestantes <= 7;
                const isWarning = diasRestantes <= 14;

                return (
                  <div
                    key={cliente.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{cliente.nome_igreja}</p>
                      <p className="text-sm text-muted-foreground">
                        {cliente.nome_superintendente || cliente.email_superintendente || "Sem contato"}
                      </p>
                      {cliente.telefone && (
                        <p className="text-sm text-muted-foreground">
                          {cliente.telefone}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right space-y-1">
                        <Badge
                          variant={isUrgent ? "destructive" : isWarning ? "secondary" : "outline"}
                        >
                          {diasRestantes < 0
                            ? `${Math.abs(diasRestantes)} dias atrasado`
                            : diasRestantes === 0
                            ? "Hoje!"
                            : `Em ${diasRestantes} dias`}
                        </Badge>
                        <p className="text-sm font-medium">
                          {format(new Date(cliente.data_proxima_compra!), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => handleFazerPedido(cliente)}
                      >
                        <ShoppingCart className="mr-1 h-4 w-4" />
                        FAZER PEDIDO
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
