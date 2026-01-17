import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Eye, Download, Calendar, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LotePagamento {
  id: string;
  referencia: string;
  mes_referencia: string;
  tipo: string;
  valor_total: number;
  quantidade_itens: number;
  status: string;
  created_at: string;
  pago_em: string | null;
}

interface LotePagamentoListProps {
  lotes: LotePagamento[];
  onViewDetails?: (loteId: string) => void;
  isLoading?: boolean;
}

export function LotePagamentoList({ lotes, onViewDetails, isLoading }: LotePagamentoListProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pago":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Pago
          </Badge>
        );
      case "fechado":
        return (
          <Badge variant="secondary">
            <FileText className="h-3 w-3 mr-1" />
            Fechado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Calendar className="h-3 w-3 mr-1" />
            Aberto
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Nenhum lote de pagamento encontrado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Lotes de Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referência</TableHead>
              <TableHead>Mês</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Pago em</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lotes.map(lote => (
              <TableRow key={lote.id}>
                <TableCell className="font-medium">{lote.referencia}</TableCell>
                <TableCell>
                  {format(parseISO(lote.mes_referencia), "MMM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{lote.tipo === 'dia_05' ? 'Dia 05' : lote.tipo}</Badge>
                </TableCell>
                <TableCell>{lote.quantidade_itens}</TableCell>
                <TableCell className="text-right font-semibold text-purple-600">
                  R$ {lote.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>{getStatusBadge(lote.status)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {format(parseISO(lote.created_at), "dd/MM/yyyy")}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {lote.pago_em 
                    ? format(parseISO(lote.pago_em), "dd/MM/yyyy")
                    : <span className="text-muted-foreground">-</span>
                  }
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {onViewDetails && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(lote.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
