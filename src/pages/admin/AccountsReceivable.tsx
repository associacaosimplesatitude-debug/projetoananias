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
import { Plus, Trash2, Search, CheckCircle2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';

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
  created_at: string;
  updated_at: string;
}

export default function AdminAccountsReceivable() {
  const [accounts, setAccounts] = useState<AccountReceivable[]>([]);
  const [churches, setChurches] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'overdue' | 'paid'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isMarkingMultiple, setIsMarkingMultiple] = useState(false);
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
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
    // Buscar todos os clientes
    const { data: allChurches } = await supabase
      .from('churches')
      .select('id, church_name, monthly_fee, payment_due_day')
      .order('church_name');
    
    // Buscar clientes com contas abertas
    const { data: openAccounts } = await supabase
      .from('accounts_receivable')
      .select('church_id')
      .eq('status', 'open');
    
    const churchesWithOpenAccounts = new Set(openAccounts?.map(acc => acc.church_id) || []);
    
    // Filtrar apenas clientes sem contas abertas
    const availableChurches = allChurches?.filter(church => !churchesWithOpenAccounts.has(church.id)) || [];
    
    setChurches(availableChurches);
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
    setSelectedAccounts([]);
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

  const markMultipleAsPaid = async () => {
    setIsMarkingMultiple(true);
    
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('accounts_receivable')
      .update({ 
        status: 'paid',
        payment_date: today
      })
      .in('id', selectedAccounts);
    
    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível processar a baixa em lote',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: `${selectedAccounts.length} contas marcadas como pagas`,
      });
      setSelectedAccounts([]);
      fetchAccounts();
    }
    
    setIsMarkingMultiple(false);
    setShowBatchConfirm(false);
  };

  const cancelReceivable = async (account: AccountReceivable) => {
    // Se for parcelado, deletar todas as parcelas relacionadas
    if (account.payment_type === 'parcelas' && account.installments) {
      const { error } = await supabase
        .from('accounts_receivable')
        .delete()
        .eq('church_id', account.church_id)
        .eq('payment_type', 'parcelas')
        .eq('installments', account.installments)
        .gte('created_at', new Date(new Date(account.created_at).getTime() - 1000).toISOString())
        .lte('created_at', new Date(new Date(account.created_at).getTime() + 1000).toISOString());
      
      if (error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível cancelar a cobrança',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: `Cobrança cancelada com sucesso! ${account.installments} parcelas foram removidas.`,
        });
        fetchAccounts();
      }
    } else {
      // Para pagamentos únicos ou recorrentes, deletar apenas essa conta
      const { error } = await supabase
        .from('accounts_receivable')
        .delete()
        .eq('id', account.id);
      
      if (error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível cancelar a cobrança',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: 'Cobrança cancelada com sucesso',
        });
        fetchAccounts();
      }
    }
  };

  const getFilteredAccounts = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let filtered = accounts;
    
    // Aplicar filtro de status
    switch (filter) {
      case 'open':
        filtered = filtered.filter(acc => acc.status === 'open');
        break;
      case 'overdue':
        filtered = filtered.filter(acc => 
          acc.status === 'open' && new Date(acc.due_date) < today
        );
        break;
      case 'paid':
        filtered = filtered.filter(acc => acc.status === 'paid');
        break;
    }
    
    // Aplicar busca por cliente
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(acc => 
        acc.church_name.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  };

  const filteredAccounts = getFilteredAccounts();
  
  // Contas abertas que podem ser selecionadas (apenas as visíveis na lista filtrada)
  const selectableAccounts = filteredAccounts.filter(acc => acc.status !== 'paid');
  
  // Verificar se todas as contas selecionáveis estão marcadas
  const allSelectableSelected = selectableAccounts.length > 0 && 
    selectableAccounts.every(acc => selectedAccounts.includes(acc.id));

  const toggleSelectAccount = (id: string) => {
    setSelectedAccounts(prev => 
      prev.includes(id) 
        ? prev.filter(accId => accId !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(selectableAccounts.map(acc => acc.id));
    }
  };

  // Calcular total selecionado
  const selectedTotal = selectedAccounts.reduce((sum, id) => {
    const account = accounts.find(acc => acc.id === id);
    return sum + (account?.amount || 0);
  }, 0);

  // Contas selecionadas para exibir no dialog
  const selectedAccountsDetails = selectedAccounts
    .map(id => accounts.find(acc => acc.id === id))
    .filter(Boolean) as AccountReceivable[];

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
                  <Label htmlFor="church">Cliente</Label>
                  <Select
                    value={formData.church_id}
                    onValueChange={handleChurchChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {churches.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          Nenhum cliente disponível (todos possuem contas abertas)
                        </div>
                      ) : (
                        churches.map((church) => (
                          <SelectItem key={church.id} value={church.id}>
                            {church.church_name}
                          </SelectItem>
                        ))
                      )}
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
        
        {/* Filtros e Busca */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
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
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Barra de Ações em Lote */}
        {selectedAccounts.length > 0 && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="py-3 px-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    {selectedAccounts.length} conta{selectedAccounts.length > 1 ? 's' : ''} selecionada{selectedAccounts.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-semibold text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedTotal)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAccounts([])}
                  >
                    Cancelar Seleção
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowBatchConfirm(true)}
                    disabled={isMarkingMultiple}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Dar Baixa em Lote
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Lista de Contas a Receber ({filteredAccounts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    {selectableAccounts.length > 0 && (
                      <Checkbox
                        checked={allSelectableSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Selecionar todas"
                      />
                    )}
                  </TableHead>
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
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {searchTerm ? 'Nenhuma conta encontrada para esta busca' : 'Nenhuma conta encontrada'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account) => (
                    <TableRow key={account.id} className={selectedAccounts.includes(account.id) ? 'bg-primary/5' : ''}>
                      <TableCell>
                        {account.status !== 'paid' && (
                          <Checkbox
                            checked={selectedAccounts.includes(account.id)}
                            onCheckedChange={() => toggleSelectAccount(account.id)}
                            aria-label={`Selecionar ${account.church_name}`}
                          />
                        )}
                      </TableCell>
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
                        <div className="flex gap-2 justify-end">
                          {account.status !== 'paid' && (
                            <Button
                              size="sm"
                              onClick={() => markAsPaid(account.id)}
                              variant="outline"
                            >
                              Marcar como Pago
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancelar Cobrança</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {account.payment_type === 'parcelas' 
                                    ? `Tem certeza que deseja cancelar esta cobrança? Todas as ${account.installments} parcelas serão removidas. Esta ação não pode ser desfeita.`
                                    : 'Tem certeza que deseja cancelar esta cobrança? Esta ação não pode ser desfeita.'}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Voltar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => cancelReceivable(account)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Cancelar Cobrança
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Dialog de Confirmação de Baixa em Lote */}
        <AlertDialog open={showBatchConfirm} onOpenChange={setShowBatchConfirm}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Baixa em Lote</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>Você está prestes a marcar {selectedAccounts.length} conta{selectedAccounts.length > 1 ? 's' : ''} como paga{selectedAccounts.length > 1 ? 's' : ''}:</p>
                  
                  <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                    {selectedAccountsDetails.slice(0, 5).map(acc => (
                      <div key={acc.id} className="flex justify-between text-sm">
                        <span className="truncate">{acc.church_name}</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(acc.amount)}
                        </span>
                      </div>
                    ))}
                    {selectedAccountsDetails.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        + {selectedAccountsDetails.length - 5} mais...
                      </p>
                    )}
                  </div>
                  
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total:</span>
                    <span className="text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedTotal)}
                    </span>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Data de pagamento: {new Date().toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isMarkingMultiple}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={markMultipleAsPaid}
                disabled={isMarkingMultiple}
              >
                {isMarkingMultiple ? 'Processando...' : 'Confirmar Baixa'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
