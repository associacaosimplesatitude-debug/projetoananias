import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Clock, User } from "lucide-react";

export interface ComissaoHierarquicaItem {
  id: string;
  tipo_beneficiario: 'gerente' | 'admin';
  beneficiario_id: string | null;
  beneficiario_email: string | null;
  beneficiario_nome: string;
  vendedor_origem_id: string | null;
  vendedor_origem_nome: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  valor_venda: number;
  percentual_comissao: number;
  valor_comissao: number;
  data_vencimento: string;
  data_liberacao: string | null;
  status: string;
  pago_em: string | null;
  created_at: string;
}

interface ComissaoHierarquicaTableProps {
  comissoes: ComissaoHierarquicaItem[];
  onMarcarPaga?: (id: string) => void;
  isUpdating?: boolean;
  showActions?: boolean;
  tipo: 'gerente' | 'admin';
}

export function ComissaoHierarquicaTable({
  comissoes,
  onMarcarPaga,
  isUpdating = false,
  showActions = true,
  tipo,
}: ComissaoHierarquicaTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paga':
        return <Badge className="bg-green-500 text-white"><Check className="h-3 w-3 mr-1" />Paga</Badge>;
      case 'liberada':
        return <Badge className="bg-blue-500 text-white">Liberada</Badge>;
      case 'pendente':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (comissoes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhuma comissão de {tipo === 'gerente' ? 'gerentes' : 'admin'} encontrada</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tipo === 'gerente' ? 'Gerente' : 'Beneficiário'}</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="text-right">Valor Venda</TableHead>
            <TableHead className="text-right">Comissão ({tipo === 'gerente' ? '%' : '1.5%'})</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead className="text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {comissoes.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{item.beneficiario_nome}</p>
                    {item.beneficiario_email && (
                      <p className="text-xs text-muted-foreground">{item.beneficiario_email}</p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">{item.vendedor_origem_nome || '-'}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm truncate max-w-[150px] block">{item.cliente_nome || '-'}</span>
              </TableCell>
              <TableCell className="text-right font-medium">
                R$ {item.valor_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right font-bold text-green-600">
                R$ {item.valor_comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell>
                {format(parseISO(item.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
              </TableCell>
              <TableCell>{getStatusBadge(item.status)}</TableCell>
              {showActions && (
                <TableCell className="text-right">
                  {item.status !== 'paga' && onMarcarPaga && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onMarcarPaga(item.id)}
                      disabled={isUpdating}
                    >
                      <Check className="h-4 w-4 mr-1" />
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
