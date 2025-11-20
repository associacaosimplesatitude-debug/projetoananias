import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { expenseCategories, ExpenseMainCategory } from '@/types/financial';

interface RecurringExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
}

export const RecurringExpenseDialog = ({ open, onOpenChange, onSave }: RecurringExpenseDialogProps) => {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category_main: '' as ExpenseMainCategory,
    category_sub: '',
    frequency: 'monthly',
    due_day: '',
    end_date: '',
  });

  const mainCategories = Object.keys(expenseCategories) as ExpenseMainCategory[];
  const subCategories = formData.category_main ? expenseCategories[formData.category_main] : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSave({
      description: formData.description,
      amount: parseFloat(formData.amount),
      category_main: formData.category_main,
      category_sub: formData.category_sub,
      frequency: formData.frequency,
      due_day: parseInt(formData.due_day),
      end_date: formData.end_date || null,
    });

    setFormData({
      description: '',
      amount: '',
      category_main: '' as ExpenseMainCategory,
      category_sub: '',
      frequency: 'monthly',
      due_day: '',
      end_date: '',
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova Despesa Recorrente</DialogTitle>
            <DialogDescription>
              Configure uma despesa que se repete mensalmente
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                placeholder="Ex: Aluguel do templo"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount">Valor *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                placeholder="0,00"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category-main">Categoria Principal *</Label>
                <Select
                  value={formData.category_main}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category_main: value as ExpenseMainCategory, category_sub: '' })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {mainCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category-sub">Subcategoria *</Label>
                <Select
                  value={formData.category_sub}
                  onValueChange={(value) => setFormData({ ...formData, category_sub: value })}
                  required
                  disabled={!formData.category_main}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {subCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="frequency">Frequência *</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="due-day">Dia do Vencimento *</Label>
                <Input
                  id="due-day"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.due_day}
                  onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                  required
                  placeholder="1-31"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="end-date">Data de Fim (Opcional)</Label>
              <Input
                id="end-date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};