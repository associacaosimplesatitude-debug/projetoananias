import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Filter } from 'lucide-react';

interface AccountReceivable {
  id: string;
  church_id: string;
  church_name: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  description: string;
  payment_type: string;
  installments: number | null;
  current_installment: number | null;
}

export default function AdminAccountsReceivable() {
  const [accounts, setAccounts] = useState<AccountReceivable[]>([]);
  const [churches, setChurches] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'overdue' | 'paid'>('all');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    church_id: '',
    amount: '',
    due_date: '',
    description: '',
    payment_type: 'unica',
    installments: '',
  });

  useEffect(() => {
    fetchAccounts();
    fetchChurches();
  }, []);

  const fetchChurches = async () => {
    const { data } = await supabase
      .from('churches')
      .select('id, church_name, monthly_fee, payment_due_day')
      .order('church_name');
    setChurches(data || []);
  };

  const handleChurchChange = (churchId: string) => {
    const selectedChurch = churches.find(c => c.id === churchId);
    if (selectedChurch) {
      // Calcular a data de vencimento baseada no payment_due_day
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const dueDay = selectedChurch.payment_due_day || 10;
      
      // Se o dia já passou neste mês, usar o próximo mês
      const dueDate = new Date(currentYear, currentMonth, dueDay);
      if (dueDate < today) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }
      
      setFormData({
        ...formData,
        church_id: churchId,
        amount: selectedChurch.monthly_fee?.toString() || '',
        due_date: dueDate.toISOString().split('T')[0],
      });
    }
  };

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts_receivable')
      .select(`
        *,
        churches (church_name)
      `)
      .order('due_date', { ascending: true });
    
    const formattedAccounts = data?.map(account => ({
      ...account,
      church_name: (account.churches as any)?.church_name || '',
    })) || [];
    
    setAccounts(formattedAccounts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Se for pagamento parcelado, criar múltiplas contas
    if (formData.payment_type === 'parcelas' && formData.installments) {
      const numInstallments = parseInt(formData.installments);
      const installmentAmount = parseFloat(formData.amount) / numInstallments;
      const dueDate = new Date(formData.due_date);
      
      const installmentsData = [];
      for (let i = 1; i <= numInstallments; i++) {
        const installmentDueDate = new Date(dueDate);
        installmentDueDate.setMonth(installmentDueDate.getMonth() + (i - 1));
        
        installmentsData.push({
          church_id: formData.church_id,
          amount: installmentAmount,
          due_date: installmentDueDate.toISOString().split('T')[0],
          description: `${formData.description} - Parcela ${i}/${numInstallments}`,
          status: 'open',
          payment_type: 'parcelas',
          installments: numInstallments,
          current_installment: i,
        });
      }
      
      const { error } = await supabase
        .from('accounts_receivable')
        .insert(installmentsData);
      
      if (error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível criar as contas a receber',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: `${numInstallments} parcelas criadas com sucesso`,
        });
        setOpen(false);
        setFormData({ church_id: '', amount: '', due_date: '', description: '', payment_type: 'unica', installments: '' });
        fetchAccounts();
      }
    } else {
      const { error } = await supabase
        .from('accounts_receivable')
        .insert({
          church_id: formData.church_id,
          amount: parseFloat(formData.amount),
          due_date: formData.due_date,
          description: formData.description,
          status: 'open',
          payment_type: formData.payment_type,
        });
      
      if (error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível criar a conta a receber',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: 'Conta a receber criada com sucesso',
        });
        setOpen(false);
        setFormData({ church_id: '', amount: '', due_date: '', description: '', payment_type: 'unica', installments: '' });
        fetchAccounts();
      }
    }
  };

  const markAsPaid = async (id: string) => {
    const { error } = await supabase
      .from('accounts_receivable')
      .update({ 
        status: 'paid',
        payment_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', id);
    
    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível marcar como pago',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Conta marcada como paga',
      });
      fetchAccounts();
    }
  };

  const getFilteredAccounts = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (filter) {
      case 'open':
        return accounts.filter(acc => acc.status === 'open');
      case 'overdue':
        return accounts.filter(acc => 
          acc.status === 'open' && new Date(acc.due_date) < today
        );
      case 'paid':
        return accounts.filter(acc => acc.status === 'paid');
      default:
        return accounts;
    }
  };

  const filteredAccounts = getFilteredAccounts();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Contas a Receber</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Conta a Receber</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="church">Igreja</Label>
                <Select
                  value={formData.church_id}
                  onValueChange={handleChurchChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a igreja" />
                  </SelectTrigger>
                  <SelectContent>
                    {churches.map((church) => (
                      <SelectItem key={church.id} value={church.id}>
                        {church.church_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment_type">Tipo de Pagamento</Label>
                <Select
                  value={formData.payment_type}
                  onValueChange={(value) => setFormData({ ...formData, payment_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unica">Única</SelectItem>
                    <SelectItem value="recorrente">Recorrente</SelectItem>
                    <SelectItem value="parcelas">Parcelas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.payment_type === 'parcelas' && (
                <div className="space-y-2">
                  <Label htmlFor="installments">Número de Parcelas</Label>
                  <Input
                    id="installments"
                    type="number"
                    min="2"
                    value={formData.installments}
                    onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                    required
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="due_date">Data de Vencimento</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="flex gap-2 mb-4">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          Todas
        </Button>
        <Button
          variant={filter === 'open' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('open')}
        >
          Abertas
        </Button>
        <Button
          variant={filter === 'overdue' ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => setFilter('overdue')}
        >
          Atrasadas
        </Button>
        <Button
          variant={filter === 'paid' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('paid')}
        >
          Pagas
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Lista de Contas a Receber ({filteredAccounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Igreja</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhuma conta encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.church_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {account.payment_type === 'unica' ? 'Única' :
                       account.payment_type === 'recorrente' ? 'Recorrente' :
                       `${account.current_installment}/${account.installments}`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(account.amount)}
                  </TableCell>
                  <TableCell>
                    {new Date(account.due_date).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    {account.payment_date 
                      ? new Date(account.payment_date).toLocaleDateString('pt-BR')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      account.status === 'paid' ? 'default' : 
                      new Date(account.due_date) < new Date() ? 'destructive' : 
                      'secondary'
                    }>
                      {account.status === 'paid' ? 'Pago' : 
                       new Date(account.due_date) < new Date() ? 'Atrasado' : 
                       'Aberto'}
                    </Badge>
                  </TableCell>
                  <TableCell>{account.description}</TableCell>
                  <TableCell className="text-right">
                    {account.status !== 'paid' && (
                      <Button
                        size="sm"
                        onClick={() => markAsPaid(account.id)}
                        variant="outline"
                      >
                        Marcar como Pago
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
