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
import { Plus } from 'lucide-react';

interface AccountPayable {
  id: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  description: string;
  payment_type: string;
  installments: number | null;
  current_installment: number | null;
}

export default function AdminAccountsPayable() {
  const [accounts, setAccounts] = useState<AccountPayable[]>([]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    amount: '',
    due_date: '',
    description: '',
    payment_type: 'unica',
    installments: '1',
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
    
    const amount = parseFloat(formData.amount);
    const installments = parseInt(formData.installments);
    
    // Se for pagamento parcelado, criar múltiplas contas
    if (formData.payment_type === 'parcelada' && installments > 1) {
      const installmentAmount = amount / installments;
      const baseDate = new Date(formData.due_date);
      
      const accountsToCreate = [];
      for (let i = 0; i < installments; i++) {
        const dueDate = new Date(baseDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        
        accountsToCreate.push({
          amount: installmentAmount,
          due_date: dueDate.toISOString().split('T')[0],
          description: `${formData.description} - Parcela ${i + 1}/${installments}`,
          status: 'open',
          payment_type: formData.payment_type,
          installments: installments,
          current_installment: i + 1,
        });
      }
      
      const { error } = await supabase
        .from('accounts_payable')
        .insert(accountsToCreate);
      
      if (error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível criar as contas a pagar',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: `${installments} parcelas criadas com sucesso`,
        });
        setOpen(false);
        setFormData({ amount: '', due_date: '', description: '', payment_type: 'unica', installments: '1' });
        fetchAccounts();
      }
    } else {
      // Pagamento único ou recorrente
      const { error } = await supabase
        .from('accounts_payable')
        .insert({
          amount: amount,
          due_date: formData.due_date,
          description: formData.description,
          status: 'open',
          payment_type: formData.payment_type,
          installments: formData.payment_type === 'parcelada' ? 1 : null,
          current_installment: formData.payment_type === 'parcelada' ? 1 : null,
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
        setFormData({ amount: '', due_date: '', description: '', payment_type: 'unica', installments: '1' });
        fetchAccounts();
      }
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
                <Label htmlFor="payment_type">Tipo de Pagamento</Label>
                <Select
                  value={formData.payment_type}
                  onValueChange={(value) => setFormData({ ...formData, payment_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unica">Única</SelectItem>
                    <SelectItem value="parcelada">Parcelada</SelectItem>
                    <SelectItem value="recorrente">Recorrente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.payment_type === 'parcelada' && (
                <div className="space-y-2">
                  <Label htmlFor="installments">Número de Parcelas</Label>
                  <Input
                    id="installments"
                    type="number"
                    min="2"
                    max="60"
                    value={formData.installments}
                    onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                    required
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="amount">Valor {formData.payment_type === 'parcelada' ? 'Total ' : ''}(R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
                {formData.payment_type === 'parcelada' && formData.amount && formData.installments && (
                  <p className="text-sm text-muted-foreground">
                    {parseInt(formData.installments)}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(formData.amount) / parseInt(formData.installments))}
                  </p>
                )}
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
                <TableHead>Tipo</TableHead>
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
                    <Badge variant="outline">
                      {account.payment_type === 'unica' && 'Única'}
                      {account.payment_type === 'parcelada' && `${account.current_installment}/${account.installments}`}
                      {account.payment_type === 'recorrente' && 'Recorrente'}
                    </Badge>
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
