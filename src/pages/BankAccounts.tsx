import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useChurchData } from '@/hooks/useChurchData';
import { Building2, Plus, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BankAccount {
  id: string;
  bank_name: string;
  agency: string;
  account_number: string;
  account_type: string;
  initial_balance: number;
  initial_balance_date: string;
  is_active: boolean;
}

const BANKS = [
  'Banco do Brasil',
  'Bradesco',
  'Caixa Econômica Federal',
  'Itaú',
  'Santander',
  'Banrisul',
  'Sicoob',
  'Sicredi',
  'Inter',
  'Nubank',
  'Cora',
  'C6 Bank',
  'Neon',
  'PagBank',
  'Outro'
];

const BankAccounts = () => {
  const { toast } = useToast();
  const { churchId } = useChurchData();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState({
    bank_name: '',
    agency: '',
    account_number: '',
    account_type: 'Corrente',
    initial_balance: '',
    initial_balance_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (churchId) {
      fetchAccounts();
    }
  }, [churchId]);

  const fetchAccounts = async () => {
    if (!churchId) return;

    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('church_id', churchId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar contas:', error);
      return;
    }

    setAccounts(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!churchId) {
      toast({
        title: 'Erro',
        description: 'Igreja não identificada.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingAccount) {
        // Update
        const { error } = await supabase
          .from('bank_accounts')
          .update({
            bank_name: formData.bank_name,
            agency: formData.agency,
            account_number: formData.account_number,
            account_type: formData.account_type,
            initial_balance: parseFloat(formData.initial_balance),
            initial_balance_date: formData.initial_balance_date,
          })
          .eq('id', editingAccount.id);

        if (error) throw error;

        toast({
          title: 'Conta atualizada!',
          description: 'A conta bancária foi atualizada com sucesso.',
        });
      } else {
        // Insert
        const initialBalance = parseFloat(formData.initial_balance);
        
        // 1. Inserir a conta bancária
        const { error: accountError } = await supabase
          .from('bank_accounts')
          .insert({
            church_id: churchId,
            bank_name: formData.bank_name,
            agency: formData.agency,
            account_number: formData.account_number,
            account_type: formData.account_type,
            initial_balance: initialBalance,
            initial_balance_date: formData.initial_balance_date,
          });

        if (accountError) throw accountError;

        // 2. Se houver saldo inicial, criar lançamento contábil de abertura
        if (initialBalance > 0) {
          // 2.1 Lançamento no Livro Diário (lancamentos_contabeis)
          const { error: entryError } = await supabase
            .from('lancamentos_contabeis')
            .insert({
              church_id: churchId,
              data: formData.initial_balance_date,
              conta_debito: '1.1.2.01', // Contas Correntes (Ativo)
              conta_credito: '3.1.1.01', // Capital Social / Fundo Patrimonial
              valor: initialBalance,
              historico: `Lançamento de Saldo Inicial - ${formData.bank_name}`,
              documento: `Abertura de Conta - ${formData.account_number}`,
            });

          if (entryError) {
            console.error('Erro ao criar lançamento de abertura:', entryError);
            // Não bloqueia o cadastro da conta, mas avisa o usuário
            toast({
              title: 'Atenção',
              description:
                'Conta cadastrada, mas houve um erro ao registrar o saldo inicial no sistema contábil.',
              variant: 'destructive',
            });
            return;
          }

          // 2.2 Lançamento nas Entradas financeiras para integração com o Dashboard
          const { error: financialEntryError } = await supabase
            .from('financial_entries')
            .insert({
              church_id: churchId,
              data: formData.initial_balance_date,
              tipo: '1.1.2.01', // Usa a conta de Contas Correntes apenas para fins de agrupamento
              descricao: `Saldo inicial da conta bancária - ${formData.bank_name}`,
              valor: initialBalance,
              payment_account: `${formData.bank_name} - Ag: ${formData.agency} - Conta: ${formData.account_number}`,
            });

          if (financialEntryError) {
            console.error('Erro ao criar entrada financeira de saldo inicial:', financialEntryError);
            toast({
              title: 'Atenção',
              description:
                'Conta cadastrada, mas houve um erro ao integrar o saldo inicial com o Dashboard financeiro.',
              variant: 'destructive',
            });
            return;
          }
        }

        toast({
          title: 'Conta cadastrada!',
          description:
            'A conta bancária foi cadastrada e o saldo inicial foi registrado no sistema contábil.',
        });
      }

      fetchAccounts();
      handleCloseDialog();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      bank_name: account.bank_name,
      agency: account.agency,
      account_number: account.account_number,
      account_type: account.account_type,
      initial_balance: account.initial_balance.toString(),
      initial_balance_date: account.initial_balance_date,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente desativar esta conta?')) return;

    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Conta desativada!',
        description: 'A conta bancária foi desativada.',
      });

      fetchAccounts();
    } catch (error: any) {
      toast({
        title: 'Erro ao desativar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAccount(null);
    setFormData({
      bank_name: '',
      agency: '',
      account_number: '',
      account_type: 'Corrente',
      initial_balance: '',
      initial_balance_date: new Date().toISOString().split('T')[0],
    });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Contas Bancárias</h1>
                <p className="text-muted-foreground">Gerencie as contas bancárias da igreja</p>
              </div>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Conta
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-lg">{account.bank_name}</span>
                  <Badge variant="secondary">{account.account_type}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Agência</p>
                  <p className="font-medium">{account.agency}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Conta</p>
                  <p className="font-medium">{account.account_number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Saldo Inicial</p>
                  <p className="font-bold text-lg">{formatCurrency(account.initial_balance)}</p>
                  <p className="text-xs text-muted-foreground">
                    em {new Date(account.initial_balance_date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(account)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDelete(account.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Desativar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {accounts.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Nenhuma conta bancária cadastrada ainda.
                  <br />
                  Clique em "Nova Conta" para adicionar.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da conta bancária da igreja
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bank_name">Banco *</Label>
                <Select
                  value={formData.bank_name}
                  onValueChange={(value) => setFormData({ ...formData, bank_name: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agency">Agência *</Label>
                  <Input
                    id="agency"
                    value={formData.agency}
                    onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                    placeholder="0001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account_number">Número da Conta *</Label>
                  <Input
                    id="account_number"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="12345-6"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_type">Tipo de Conta *</Label>
                <Select
                  value={formData.account_type}
                  onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Corrente">Conta Corrente</SelectItem>
                    <SelectItem value="Poupança">Conta Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initial_balance">Saldo Inicial (R$) *</Label>
                  <Input
                    id="initial_balance"
                    type="number"
                    step="0.01"
                    value={formData.initial_balance}
                    onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                    placeholder="0,00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="initial_balance_date">Data do Saldo *</Label>
                  <Input
                    id="initial_balance_date"
                    type="date"
                    value={formData.initial_balance_date}
                    onChange={(e) => setFormData({ ...formData, initial_balance_date: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingAccount ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BankAccounts;
