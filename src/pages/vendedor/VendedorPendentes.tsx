import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useVendedor } from "@/hooks/useVendedor";
import { PlaybookClienteCard } from "@/components/vendedor/PlaybookClienteCard";

interface Cliente {
  id: string;
  nome_igreja: string;
  nome_responsavel: string | null;
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

export default function VendedorPendentes() {
  const { vendedor, isLoading: vendedorLoading } = useVendedor();

  const { data: clientesPendentes = [], isLoading, refetch } = useQuery({
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
          <Clock className="h-6 w-6 text-amber-500" />
          Pendentes de Ativação
        </h2>
        <p className="text-muted-foreground">
          Clientes que ainda não tiveram o Painel EBD ativado
        </p>
      </div>

      {clientesPendentes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum cliente pendente de ativação</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clientesPendentes.map((cliente) => (
            <PlaybookClienteCard
              key={cliente.id}
              cliente={cliente}
              type="ativacao_pendente"
              onRefresh={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
