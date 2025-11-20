import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Bill {
  id: string;
  description: string;
  amount: number;
  category_main: string;
  category_sub: string;
  due_date: string;
  paid_date?: string;
  paid_amount?: number;
  receipt_path?: string;
  is_recurring: boolean;
}

interface ExpenseHistoryListProps {
  bills: Bill[];
  onViewReceipt: (receiptPath: string) => void;
}

export const ExpenseHistoryList = ({ bills, onViewReceipt }: ExpenseHistoryListProps) => {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (bills.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-semibold">Nenhum pagamento registrado</p>
        <p className="text-muted-foreground">O histórico de pagamentos aparecerá aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bills.map((bill) => (
        <div key={bill.id} className="p-4 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold truncate">{bill.description}</h3>
                {bill.is_recurring && (
                  <Badge variant="outline" className="text-xs">
                    Recorrente
                  </Badge>
                )}
                <Badge variant="default" className="bg-green-600">
                  Pago
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Pago em: {bill.paid_date ? format(new Date(bill.paid_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '-'}
                </span>
                <span>{bill.category_main}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-lg font-bold">
                  {formatCurrency(bill.paid_amount || bill.amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Previsto: {formatCurrency(bill.amount)}
                </p>
              </div>
              {bill.receipt_path && (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => onViewReceipt(bill.receipt_path!)}
                  title="Ver comprovante"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};