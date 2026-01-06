import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { differenceInDays } from "date-fns";
import { useVendedor } from "@/hooks/useVendedor";
import { PlaybookClienteCard } from "@/components/vendedor/PlaybookClienteCard";

interface Cliente {
  id: string;
  nome_igreja: string;
  nome_superintendente: string | null;
  email_superintendente: string | null;
  telefone: string | null;
  cnpj: string | null;
  ultimo_login: string | null;
  status_ativacao_ebd: boolean;
  data_proxima_compra: string | null;
  data_inicio_ebd: string | null;
  senha_temporaria: string | null;
}

export default function VendedorEmRisco() {
  const { vendedor, isLoading: vendedorLoading } = useVendedor();

  const { data: clientesRisco = [], isLoading, refetch } = useQuery({
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
          <AlertTriangle className="h-6 w-6 text-destructive" />
          Clientes em Risco
        </h2>
        <p className="text-muted-foreground">
          Clientes sem login há mais de 30 dias - requerem atenção
        </p>
      </div>

      {clientesRisco.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum cliente em risco</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clientesRisco.map((cliente) => (
            <PlaybookClienteCard
              key={cliente.id}
              cliente={cliente}
              type="em_risco"
              onRefresh={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
