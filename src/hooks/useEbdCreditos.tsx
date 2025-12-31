import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Credito {
  id: string;
  cliente_id: string;
  tipo: string;
  valor: number;
  descricao: string | null;
  validade: string | null;
  usado: boolean;
  usado_em: string | null;
  pedido_id: string | null;
  created_at: string;
}

export function useEbdCreditos(clienteId: string | null) {
  const { data: creditos = [], isLoading, refetch } = useQuery({
    queryKey: ["ebd-creditos", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const { data, error } = await supabase
        .from("ebd_creditos")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Credito[];
    },
    enabled: !!clienteId,
  });

  const creditosDisponiveis = creditos.filter((c) => !c.usado);
  const creditosUsados = creditos.filter((c) => c.usado);

  const totalDisponivel = creditosDisponiveis.reduce(
    (sum, c) => sum + Number(c.valor),
    0
  );
  const totalUsado = creditosUsados.reduce(
    (sum, c) => sum + Number(c.valor),
    0
  );

  return {
    creditos,
    creditosDisponiveis,
    creditosUsados,
    totalDisponivel,
    totalUsado,
    isLoading,
    refetch,
  };
}

export function useEbdCreditosPorClientes(clienteIds: string[]) {
  const { data: creditos = [], isLoading } = useQuery({
    queryKey: ["ebd-creditos-multi", clienteIds],
    queryFn: async () => {
      if (clienteIds.length === 0) return [];
      const { data, error } = await supabase
        .from("ebd_creditos")
        .select("*")
        .in("cliente_id", clienteIds);
      if (error) throw error;
      return data as Credito[];
    },
    enabled: clienteIds.length > 0,
  });

  // Agrupar por cliente
  const creditosPorCliente: Record<
    string,
    { disponiveis: number; usados: number }
  > = {};

  creditos.forEach((c) => {
    if (!creditosPorCliente[c.cliente_id]) {
      creditosPorCliente[c.cliente_id] = { disponiveis: 0, usados: 0 };
    }
    if (c.usado) {
      creditosPorCliente[c.cliente_id].usados += Number(c.valor);
    } else {
      creditosPorCliente[c.cliente_id].disponiveis += Number(c.valor);
    }
  });

  return {
    creditosPorCliente,
    isLoading,
  };
}
