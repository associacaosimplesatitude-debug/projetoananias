import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useChurchData } from '@/hooks/useChurchData';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_type: string;
}

interface Transfer {
  id: string;
  data: string;
  valor: number;
  conta_origem: string;
  conta_destino: string;
  historico: string;
  created_at: string;
}

const BankTransfers = () => {
  const { churchId } = useChurchData();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [transferDate, setTransferDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [amount, setAmount] = useState('');
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (churchId) {
      fetchAccounts();
      fetchTransfers();
    }
  }, [churchId]);

  const fetchAccounts = async () => {
    if (!churchId) return;

    const { data, error } = await supabase
      .from('bank_accounts')
      .select('id, bank_name, account_number, account_type')
      .eq('church_id', churchId)
      .eq('is_active', true)
      .order('bank_name');

    if (error) {
      console.error('Error fetching accounts:', error);
      return;
    }

    setAccounts(data || []);
  };

  const fetchTransfers = async () => {
    if (!churchId) return;

    const { data, error } = await supabase
      .from('lancamentos_contabeis')
      .select('*')
      .eq('church_id', churchId)
      .like('historico', 'Transferência:%')
      .order('data', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching transfers:', error);
      return;
    }

    // Transformar os dados para o formato de Transfer
    const transfersData = data?.map(lancamento => ({
      id: lancamento.id,
      data: lancamento.data,
      valor: Number(lancamento.valor),
      conta_origem: lancamento.conta_credito,
      conta_destino: lancamento.conta_debito,
      historico: lancamento.historico,
      created_at: lancamento.created_at,
    })) || [];

    setTransfers(transfersData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!churchId) return;

    // Validações
    if (!fromAccount || !toAccount || !amount || !transferDate) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    if (fromAccount === toAccount) {
      toast({
        title: 'Erro',
        description: 'A conta de origem e destino não podem ser iguais.',
        variant: 'destructive',
      });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({
        title: 'Erro',
        description: 'O valor deve ser maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Mapear os nomes das contas para os códigos do plano de contas
      const getAccountCode = (accountId: string) => {
        if (accountId === 'caixa_geral') {
          return '1.1.1.01'; // Caixa Geral
        } else {
          return '1.1.2.01'; // Contas Correntes
        }
      };

      const contaOrigemCodigo = getAccountCode(fromAccount);
      const contaDestinoCodigo = getAccountCode(toAccount);

      // Obter os nomes das contas para o histórico
      let fromAccountName = 'Caixa Geral';
      let toAccountName = 'Caixa Geral';

      if (fromAccount !== 'caixa_geral') {
        const account = accounts.find(acc => acc.id === fromAccount);
        fromAccountName = account ? `${account.bank_name} - ${account.account_number}` : 'Conta Bancária';
      }

      if (toAccount !== 'caixa_geral') {
        const account = accounts.find(acc => acc.id === toAccount);
        toAccountName = account ? `${account.bank_name} - ${account.account_number}` : 'Conta Bancária';
      }

      const transferDescription = description || `De ${fromAccountName} para ${toAccountName}`;

      // Criar lançamento contábil
      // Débito: Conta de Destino (aumenta o ativo da conta destino)
      // Crédito: Conta de Origem (diminui o ativo da conta origem)
      const { error } = await supabase
        .from('lancamentos_contabeis')
        .insert({
          church_id: churchId,
          data: transferDate,
          historico: `Transferência: ${transferDescription}`,
          conta_debito: contaDestinoCodigo,
          conta_credito: contaOrigemCodigo,
          valor: numericAmount,
          documento: null,
        });

      if (error) throw error;

      toast({
        title: 'Transferência realizada!',
        description: 'A transferência foi registrada com sucesso.',
      });

      // Resetar formulário
      setTransferDate(format(new Date(), 'yyyy-MM-dd'));
      setAmount('');
      setFromAccount('');
      setToAccount('');
      setDescription('');
      setDialogOpen(false);

      // Recarregar transferências
      fetchTransfers();
    } catch (error) {
      console.error('Error creating transfer:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao registrar a transferência.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  // Criar lista de opções de contas (Caixa Geral + contas bancárias)
  const accountOptions = [
    { id: 'caixa_geral', name: 'Caixa Geral' },
    ...accounts.map(acc => ({
      id: acc.id,
      name: `${acc.bank_name} - ${acc.account_number} (${acc.account_type})`,
    })),
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary text-primary-foreground">
                <ArrowLeftRight className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Transferências entre Contas</h1>
                <p className="text-muted-foreground">Registre transferências entre Caixa Geral e Contas Bancárias</p>
              </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Transferência
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nova Transferência</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="transferDate">Data da Transferência *</Label>
                    <Input
                      id="transferDate"
                      type="date"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor Transferido *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fromAccount">Conta de Origem *</Label>
                    <Select value={fromAccount} onValueChange={setFromAccount} required>
                      <SelectTrigger id="fromAccount">
                        <SelectValue placeholder="Selecione a conta de origem" />
                      </SelectTrigger>
                      <SelectContent>
                        {accountOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="toAccount">Conta de Destino *</Label>
                    <Select value={toAccount} onValueChange={setToAccount} required>
                      <SelectTrigger id="toAccount">
                        <SelectValue placeholder="Selecione a conta de destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {accountOptions
                          .filter(option => option.id !== fromAccount)
                          .map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição (Opcional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Ex: Depósito do caixa no Banco X"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                      {loading ? 'Processando...' : 'Confirmar Transferência'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Lista de Transferências */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Transferências</CardTitle>
            <CardDescription>Últimas 50 transferências realizadas</CardDescription>
          </CardHeader>
          <CardContent>
            {transfers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma transferência registrada ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((transfer) => (
                      <TableRow key={transfer.id}>
                        <TableCell className="font-medium">
                          {formatDate(transfer.data)}
                        </TableCell>
                        <TableCell className="max-w-md">
                          {transfer.historico.replace('Transferência: ', '')}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(transfer.valor)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BankTransfers;
