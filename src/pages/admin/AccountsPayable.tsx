import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

interface AccountPayable {
  id: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  description: string;
}

export default function AdminAccountsPayable() {
  const [accounts, setAccounts] = useState<AccountPayable[]>([]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    amount: '',
    due_date: '',
    description: '',
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts_payable')
      .select('*')
      .order('due_date', { ascending: true });
    
    setAccounts(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { error } = await supabase
      .from('accounts_payable')
      .insert({
        amount: parseFloat(formData.amount),
        due_date: formData.due_date,
        description: formData.description,
        status: 'open',
      });
    
    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a conta a pagar',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Conta a pagar criada com sucesso',
      });
      setOpen(false);
      setFormData({ amount: '', due_date: '', description: '' });
      fetchAccounts();
    }
  };

  const markAsPaid = async (id: string) => {
    const { error } = await supabase
      .from('accounts_payable')
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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Contas a Pagar</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Conta a Pagar</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  required
                />
              </div>
              
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Lista de Contas a Pagar</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
