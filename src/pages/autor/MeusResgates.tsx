import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck, 
  XCircle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRoyaltiesAuth } from "@/hooks/useRoyaltiesAuth";

interface ResgateItem {
  produto_id: string;
  titulo: string;
  quantidade: number;
  valor_unitario: number;
  desconto_aplicado: number;
}

interface Resgate {
  id: string;
  data_solicitacao: string;
  status: string;
  valor_total: number;
  itens: ResgateItem[];
  observacoes: string | null;
}

const statusConfig = {
  pendente: { label: "Pendente", icon: Clock, variant: "secondary" as const, color: "text-yellow-600" },
  aprovado: { label: "Aprovado", icon: CheckCircle2, variant: "default" as const, color: "text-blue-600" },
  enviado: { label: "Enviado", icon: Truck, variant: "default" as const, color: "text-green-600" },
  cancelado: { label: "Cancelado", icon: XCircle, variant: "destructive" as const, color: "text-red-600" },
};

export default function MeusResgates() {
  const { autorId } = useRoyaltiesAuth();

  const { data: resgates, isLoading } = useQuery({
    queryKey: ["meus-resgates", autorId],
    queryFn: async () => {
      if (!autorId) return [];

      const { data, error } = await supabase
        .from("royalties_resgates")
        .select("*")
        .eq("autor_id", autorId)
        .order("data_solicitacao", { ascending: false });

      if (error) throw error;
      
      // Parse itens from JSONB
      return (data || []).map(item => ({
        ...item,
        itens: (item.itens as unknown as ResgateItem[]) || [],
      })) as Resgate[];
    },
    enabled: !!autorId,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const stats = {
    total: resgates?.length || 0,
    pendentes: resgates?.filter((r) => r.status === "pendente").length || 0,
    aprovados: resgates?.filter((r) => r.status === "aprovado" || r.status === "enviado").length || 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meus Resgates</h1>
        <p className="text-muted-foreground">
          Acompanhe o status das suas solicitações de resgate.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Resgates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span className="text-2xl font-bold">{stats.pendentes}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aprovados/Enviados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">{stats.aprovados}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Resgates */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : resgates?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Você ainda não fez nenhum resgate.</p>
              <p className="text-sm">Acesse a Loja para trocar seus royalties por produtos!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resgates?.map((resgate) => {
                  const config = statusConfig[resgate.status as keyof typeof statusConfig];
                  const Icon = config?.icon || Clock;
                  return (
                    <TableRow key={resgate.id}>
                      <TableCell>
                        {format(new Date(resgate.data_solicitacao), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {Array.isArray(resgate.itens) && resgate.itens.slice(0, 2).map((item, idx) => (
                            <p key={idx} className="text-sm">
                              {item.quantidade}× {item.titulo.length > 30 ? item.titulo.slice(0, 30) + "..." : item.titulo}
                            </p>
                          ))}
                          {Array.isArray(resgate.itens) && resgate.itens.length > 2 && (
                            <p className="text-xs text-muted-foreground">
                              +{resgate.itens.length - 2} mais
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(resgate.valor_total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={config?.variant} className="gap-1">
                          <Icon className="h-3 w-3" />
                          {config?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {resgate.observacoes || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
