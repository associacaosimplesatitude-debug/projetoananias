import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useVendedor } from "@/hooks/useVendedor";

interface Cliente {
  id: string;
  nome_igreja: string;
  nome_responsavel: string | null;
  nome_superintendente: string | null;
  email_superintendente: string | null;
  status_ativacao_ebd: boolean;
}

export default function VendedorPendentes() {
  const navigate = useNavigate();
  const { vendedor, isLoading: vendedorLoading } = useVendedor();

  const { data: clientesPendentes = [], isLoading } = useQuery({
    queryKey: ["vendedor-clientes-pendentes", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("*")
        .eq("vendedor_id", vendedor.id)
        .eq("status_ativacao_ebd", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Cliente[];
    },
    enabled: !!vendedor?.id,
  });

  const handleFazerPedido = (cliente: Cliente) => {
    navigate(`/vendedor/catalogo?clienteId=${cliente.id}&clienteNome=${encodeURIComponent(cliente.nome_igreja)}`);
  };

  const handleAtivarPainel = (cliente: Cliente) => {
    navigate(`/vendedor/ativacao?clienteId=${cliente.id}&clienteNome=${encodeURIComponent(cliente.nome_igreja)}`);
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
        <h2 className="text-2xl font-bold">Pendentes de Ativação</h2>
        <p className="text-muted-foreground">Clientes que ainda não tiveram o Painel EBD ativado</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {clientesPendentes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum cliente pendente de ativação
            </p>
          ) : (
            <div className="space-y-4">
              {clientesPendentes.map((cliente) => (
                <div
                  key={cliente.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{cliente.nome_igreja}</p>
                    <p className="text-sm text-muted-foreground">
                      {cliente.nome_responsavel || cliente.nome_superintendente || "Sem responsável"}
                    </p>
                    {cliente.email_superintendente && (
                      <p className="text-sm text-muted-foreground">
                        {cliente.email_superintendente}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleFazerPedido(cliente)}
                    >
                      <ShoppingCart className="mr-1 h-4 w-4" />
                      FAZER PEDIDO
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleAtivarPainel(cliente)}
                    >
                      <Play className="mr-1 h-4 w-4" />
                      ATIVAR PAINEL EBD
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
