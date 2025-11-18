import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FinancialExpense, expenseCategories, ExpenseMainCategory } from '@/types/financial';
import { TrendingDown, Save, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const FinancialExpenses = () => {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<FinancialExpense[]>([]);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    valor: '',
    categoriaMain: '' as ExpenseMainCategory,
    categoriaSub: '',
    descricao: '',
  });

  const mainCategories = Object.keys(expenseCategories) as ExpenseMainCategory[];
  const subCategories = formData.categoriaMain ? expenseCategories[formData.categoriaMain] : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newExpense: FinancialExpense = {
      id: Math.random().toString(36).substr(2, 9),
      data: formData.data,
      valor: parseFloat(formData.valor),
      categoria: {
        main: formData.categoriaMain,
        sub: formData.categoriaSub,
      },
      descricao: formData.descricao,
      createdAt: new Date().toISOString(),
    };

    setExpenses((prev) => [newExpense, ...prev]);
    
    setFormData({
      data: new Date().toISOString().split('T')[0],
      valor: '',
      categoriaMain: '' as ExpenseMainCategory,
      categoriaSub: '',
      descricao: '',
    });

    toast({
      title: 'Despesa registrada!',
      description: `Lançamento de R$ ${parseFloat(formData.valor).toFixed(2)} registrado com sucesso.`,
    });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-destructive text-destructive-foreground">
              <TrendingDown className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Lançamento de Despesas</h1>
              <p className="text-muted-foreground">Registre as saídas financeiras</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle>Nova Despesa</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="data">Data do Pagamento *</Label>
                  <Input
                    id="data"
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valor">Valor (R$) *</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    placeholder="0,00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoria-main">Categoria Principal *</Label>
                  <Select
                    value={formData.categoriaMain}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        categoriaMain: value as ExpenseMainCategory,
                        categoriaSub: '',
                      })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
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

                {formData.categoriaMain && (
                  <div className="space-y-2">
                    <Label htmlFor="categoria-sub">Subcategoria *</Label>
                    <Select
                      value={formData.categoriaSub}
                      onValueChange={(value) => setFormData({ ...formData, categoriaSub: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a subcategoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {subCategories.map((sub) => (
                          <SelectItem key={sub} value={sub}>
                            {sub}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição / Histórico *</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Histórico do pagamento"
                    rows={3}
                    required
                  />
                </div>

                <Button type="submit" className="w-full gap-2">
                  <Save className="h-4 w-4" />
                  Registrar Despesa
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Expenses List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Últimos Lançamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma despesa registrada ainda</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="p-3 rounded-lg border bg-destructive/5 border-destructive/20"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <Badge variant="secondary" className="mb-1">
                            {expense.categoria.sub}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {expense.categoria.main}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatDate(expense.data)}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-destructive">
                          {formatCurrency(expense.valor)}
                        </p>
                      </div>
                      <p className="text-sm">{expense.descricao}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FinancialExpenses;
