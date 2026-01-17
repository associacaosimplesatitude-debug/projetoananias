import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, Clock, AlertTriangle, Calendar, ExternalLink,
  DollarSign, CreditCard, FileText, Wallet
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface ComissaoItem {
  id: string;
  vendedor_id: string | null;
  vendedor_nome: string;
  cliente_id: string;
  cliente_nome: string;
  tipo: 'online' | 'faturado';
  numero_parcela: number;
  total_parcelas: number;
  data_vencimento: string;
  data_liberacao: string | null;
  valor: number;
  valor_comissao: number;
  comissao_status: string;
  metodo_pagamento: string | null;
  bling_order_number: string | null;
  link_danfe: string | null;
}

interface ComissaoTableProps {
  comissoes: ComissaoItem[];
  onMarcarPaga: (id: string) => void;
  isUpdating?: boolean;
  showActions?: boolean;
}

export function ComissaoTable({ comissoes, onMarcarPaga, isUpdating, showActions = true }: ComissaoTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paga":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Paga
          </Badge>
        );
      case "liberada":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <Wallet className="h-3 w-3 mr-1" />
            Liberada
          </Badge>
        );
      case "agendada":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <Calendar className="h-3 w-3 mr-1" />
            Agendada
          </Badge>
        );
      case "atrasada":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Atrasada
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const getTipoBadge = (tipo: string) => {
    if (tipo === "online") {
      return <Badge variant="outline" className="text-blue-600 border-blue-300">Online</Badge>;
    }
    return <Badge variant="outline">Faturado</Badge>;
  };

  const getMetodoBadge = (metodo: string | null) => {
    if (!metodo) return null;
    
    const metodosMap: Record<string, { label: string; icon: JSX.Element }> = {
      pix: { label: "PIX", icon: <DollarSign className="h-3 w-3" /> },
      cartao: { label: "Cartão", icon: <CreditCard className="h-3 w-3" /> },
      cartao_debito: { label: "Débito", icon: <CreditCard className="h-3 w-3" /> },
      credit_card: { label: "Cartão", icon: <CreditCard className="h-3 w-3" /> },
      boleto_avista: { label: "À Vista", icon: <FileText className="h-3 w-3" /> },
      boleto_30: { label: "30d", icon: <FileText className="h-3 w-3" /> },
      boleto_60: { label: "60d", icon: <FileText className="h-3 w-3" /> },
      boleto_90: { label: "90d", icon: <FileText className="h-3 w-3" /> },
    };

    const config = metodosMap[metodo] || { label: metodo, icon: <DollarSign className="h-3 w-3" /> };
    
    return (
      <Badge variant="outline" className="text-xs">
        {config.icon}
        <span className="ml-1">{config.label}</span>
      </Badge>
    );
  };

  if (comissoes.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Nenhuma comissão encontrada para os filtros selecionados.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendedor</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Parcela</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Valor Comissão</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Liberação</TableHead>
            <TableHead>NF</TableHead>
            {showActions && <TableHead>Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {comissoes.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.vendedor_nome}</TableCell>
              <TableCell className="max-w-[180px] truncate">{item.cliente_nome}</TableCell>
              <TableCell>{getTipoBadge(item.tipo)}</TableCell>
              <TableCell>{item.numero_parcela}/{item.total_parcelas}</TableCell>
              <TableCell className="whitespace-nowrap">
                {format(parseISO(item.data_vencimento), "dd/MM/yyyy")}
              </TableCell>
              <TableCell className="text-right font-medium">
                R$ {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right font-semibold text-purple-600">
                R$ {item.valor_comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell>{getStatusBadge(item.comissao_status)}</TableCell>
              <TableCell className="whitespace-nowrap">
                {item.data_liberacao 
                  ? format(parseISO(item.data_liberacao), "dd/MM/yyyy")
                  : <span className="text-muted-foreground">-</span>
                }
              </TableCell>
              <TableCell>
                {item.bling_order_number ? (
                  <div className="flex items-center gap-1">
                    <span className="text-sm">{item.bling_order_number}</span>
                    {item.link_danfe && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => window.open(item.link_danfe!, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              {showActions && (
                <TableCell>
                  {item.comissao_status === "liberada" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onMarcarPaga(item.id)}
                      disabled={isUpdating}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Pagar
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
