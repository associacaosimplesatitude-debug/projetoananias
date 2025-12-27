import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPlus } from "lucide-react";

export function ClientesParaAtribuirCard() {
  const navigate = useNavigate();

  // Query para contar pedidos online (Shopify) sem vendedor atribuído
  const { data: countSemVendedor = 0 } = useQuery({
    queryKey: ["clientes-para-atribuir"],
    queryFn: async () => {
      // Pedidos pagos do Shopify que não têm vendedor_id
      // Agrupar por email do cliente para contar clientes únicos, não pedidos
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select("customer_email, vendedor_id")
        .is("vendedor_id", null)
        .neq("status_pagamento", "Faturado");

      if (error) throw error;

      // Filtrar apenas pedidos pagos
      const paidStatuses = ["paid", "pago", "approved"];
      
      // Como não temos o status na query, vamos fazer outra abordagem
      // Buscar pedidos sem vendedor
      const { data: pedidosSemVendedor, error: err2 } = await supabase
        .from("ebd_shopify_pedidos")
        .select("id, customer_email, status_pagamento")
        .is("vendedor_id", null)
        .neq("status_pagamento", "Faturado");

      if (err2) throw err2;

      // Filtrar pagos e pegar emails únicos
      const emailsUnicos = new Set(
        (pedidosSemVendedor || [])
          .filter(p => {
            const status = (p.status_pagamento || "").toLowerCase();
            return status === "paid" || status === "pago" || status === "approved";
          })
          .map(p => p.customer_email?.toLowerCase())
          .filter(Boolean)
      );

      return emailsUnicos.size;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const handleClick = () => {
    // Navegar para a página de pedidos online
    navigate("/admin/ebd/pedidos-igrejas");
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20"
      onClick={handleClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
          Clientes para Atribuir
        </CardTitle>
        <UserPlus className="h-5 w-5 text-orange-600" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-orange-700 dark:text-orange-300">
            {countSemVendedor}
          </span>
          {countSemVendedor > 0 && (
            <Badge className="bg-orange-500 hover:bg-orange-600 text-white">
              Pendentes
            </Badge>
          )}
        </div>
        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
          Compraram online, aguardam vendedor
        </p>
      </CardContent>
    </Card>
  );
}
