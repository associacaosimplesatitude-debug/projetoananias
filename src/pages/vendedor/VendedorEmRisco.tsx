import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, AlertTriangle } from "lucide-react";
import { differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useVendedor } from "@/hooks/useVendedor";

interface Cliente {
  id: string;
  nome_igreja: string;
  email_superintendente: string | null;
  ultimo_login: string | null;
  status_ativacao_ebd: boolean;
}

export default function VendedorEmRisco() {
  const navigate = useNavigate();
  const { vendedor, isLoading: vendedorLoading } = useVendedor();

  const { data: clientesRisco = [], isLoading } = useQuery({
    queryKey: ["vendedor-clientes-risco", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("*")
        .eq("vendedor_id", vendedor.id)
        .eq("status_ativacao_ebd", true)
        .order("ultimo_login", { ascending: true, nullsFirst: true });
      if (error) throw error;
      
      // Filter clients at risk (no login > 30 days or never logged in)
      return (data as Cliente[]).filter(c => {
        if (!c.ultimo_login) return true;
        const diasSemLogin = differenceInDays(new Date(), new Date(c.ultimo_login));
        return diasSemLogin > 30;
      });
    },
    enabled: !!vendedor?.id,
  });

  const handleFazerPedido = (cliente: Cliente) => {
    navigate(`/vendedor/catalogo?clienteId=${cliente.id}&clienteNome=${encodeURIComponent(cliente.nome_igreja)}`);
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
        <h2 className="text-2xl font-bold">Clientes em Risco</h2>
        <p className="text-muted-foreground">Clientes sem login há mais de 30 dias - requerem atenção</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {clientesRisco.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum cliente em risco
            </p>
          ) : (
            <div className="space-y-4">
              {clientesRisco.map((cliente) => {
                const diasSemLogin = cliente.ultimo_login
                  ? differenceInDays(new Date(), new Date(cliente.ultimo_login))
                  : null;

                return (
                  <div
                    key={cliente.id}
                    className="flex items-center justify-between p-4 border rounded-lg border-destructive/50 bg-destructive/5"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{cliente.nome_igreja}</p>
                      <p className="text-sm text-muted-foreground">
                        {cliente.email_superintendente}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="destructive">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {diasSemLogin
                          ? `${diasSemLogin} dias sem login`
                          : "Nunca logou"}
                      </Badge>
                      <Button
                        variant="outline"
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
