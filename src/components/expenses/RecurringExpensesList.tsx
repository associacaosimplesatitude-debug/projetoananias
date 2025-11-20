import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Calendar } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface RecurringExpense {
  id: string;
  description: string;
  amount: number;
  category_main: string;
  category_sub: string;
  frequency: string;
  due_day: number;
  end_date?: string;
  is_active: boolean;
}

interface RecurringExpensesListProps {
  expenses: RecurringExpense[];
  onDelete: (id: string) => void;
}

export const RecurringExpensesList = ({ expenses, onDelete }: RecurringExpensesListProps) => {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const activeExpenses = expenses.filter(e => e.is_active);

  if (activeExpenses.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-semibold">Nenhuma despesa recorrente</p>
        <p className="text-muted-foreground">Crie uma despesa recorrente para automatizar suas contas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeExpenses.map((expense) => (
        <div key={expense.id} className="p-4 rounded-lg border border-border">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate mb-2">{expense.description}</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Vencimento: Todo dia {expense.due_day}
                </span>
                <span>{expense.category_main}</span>
                {expense.end_date && (
                  <span>
                    Até: {new Date(expense.end_date).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-lg font-bold">{formatCurrency(expense.amount)}</p>
                <Badge variant="secondary">Mensal</Badge>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="text-destructive shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desativar despesa recorrente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá desativar a despesa recorrente. As contas já geradas não serão afetadas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(expense.id)}>
                      Desativar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};