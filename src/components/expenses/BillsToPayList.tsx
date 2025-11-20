import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Calendar, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Bill {
  id: string;
  description: string;
  amount: number;
  category_main: string;
  category_sub: string;
  due_date: string;
  status: string;
  is_recurring: boolean;
}

interface BillsToPayListProps {
  bills: Bill[];
  onMarkAsPaid: (bill: Bill) => void;
}

export const BillsToPayList = ({ bills, onMarkAsPaid }: BillsToPayListProps) => {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'overdue':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Atrasada
          </Badge>
        );
      case 'due_today':
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-amber-500">
            <Calendar className="h-3 w-3" />
            Vence Hoje
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            A Pagar
          </Badge>
        );
    }
  };

  if (bills.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-semibold">Nenhuma conta pendente</p>
        <p className="text-muted-foreground">Todas as contas estão em dia!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bills.map((bill) => (
        <div
          key={bill.id}
          className={`p-4 rounded-lg border ${
            bill.status === 'overdue'
              ? 'border-destructive bg-destructive/5'
              : bill.status === 'due_today'
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
              : 'border-border'
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold truncate">{bill.description}</h3>
                {bill.is_recurring && (
                  <Badge variant="outline" className="text-xs">
                    Recorrente
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(bill.due_date), "dd 'de' MMMM", { locale: ptBR })}
                </span>
                <span>{bill.category_main}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-lg font-bold">{formatCurrency(bill.amount)}</p>
                {getStatusBadge(bill.status)}
              </div>
              <Button
                size="sm"
                onClick={() => onMarkAsPaid(bill)}
                className="shrink-0"
              >
                Marcar como Pago
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};