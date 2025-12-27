import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCheck } from "lucide-react";

interface ClientesParaAtivarCardProps {
  vendedorId: string;
}

export function ClientesParaAtivarCard({ vendedorId }: ClientesParaAtivarCardProps) {
  const navigate = useNavigate();

  // Query para contar clientes atribuídos ao vendedor com status_ativacao_ebd = false
  const { data: countParaAtivar = 0 } = useQuery({
    queryKey: ["vendedor-clientes-para-ativar", vendedorId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ebd_clientes")
        .select("*", { count: "exact", head: true })
        .eq("vendedor_id", vendedorId)
        .eq("status_ativacao_ebd", false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!vendedorId,
    staleTime: 1000 * 60 * 5,
  });

  const handleClick = () => {
    navigate("/vendedor/pendentes");
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20"
      onClick={handleClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Clientes para Ativar
        </CardTitle>
        <UserCheck className="h-5 w-5 text-blue-600" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-blue-700 dark:text-blue-300">
            {countParaAtivar}
          </span>
          {countParaAtivar > 0 && (
            <Badge className="bg-blue-500 hover:bg-blue-600 text-white">
              Primeira Compra
            </Badge>
          )}
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          Aguardam ativação do painel EBD
        </p>
      </CardContent>
    </Card>
  );
}
