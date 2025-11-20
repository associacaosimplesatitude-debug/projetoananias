import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FinancialEntry, EntryType } from '@/types/financial';
import { TrendingUp, Save, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useChurchData } from '@/hooks/useChurchData';

interface RevenueAccount {
  codigo_conta: string;
  nome_conta: string;
}

const FinancialEntries = () => {
  const { toast } = useToast();
  const { churchId } = useChurchData();
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [revenueAccounts, setRevenueAccounts] = useState<RevenueAccount[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    hora: '',
    tipoEntrada: '',
    valor: '',
    recebidoEm: '',
    membroId: '',
    descricao: '',
  });

  // Buscar contas de receita, contas bancárias e entradas do banco
  useEffect(() => {
    const fetchData = async () => {
      if (!churchId) return;

      // Buscar contas de receita analíticas (4.1.x)
      const { data: accountsData, error: accountsError } = await supabase
        .from('plano_de_contas')
        .select('codigo_conta, nome_conta')
        .like('codigo_conta', '4.1.%')
        .eq('tipo_conta', 'Analítica')
        .order('codigo_conta');

      if (accountsError) {
        console.error('Erro ao buscar contas de receita:', accountsError);
      } else if (accountsData) {
        setRevenueAccounts(accountsData);
      }

      // Buscar contas bancárias
      const { data: banksData, error: banksError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('church_id', churchId)
        .eq('is_active', true)
        .order('bank_name');

      if (banksError) {
        console.error('Erro ao buscar contas bancárias:', banksError);
      } else if (banksData) {
        setBankAccounts(banksData);
      }

      // Buscar entradas
      const { data, error } = await supabase
        .from('financial_entries')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar entradas:', error);
        return;
      }

      if (data) {
        const formattedEntries = data.map(entry => ({
          id: entry.id,
          data: entry.data,
          hora: entry.hora || undefined,
          tipo: entry.tipo as EntryType,
          valor: Number(entry.valor),
          membroId: entry.membro_id || undefined,
          membroNome: entry.membro_nome || undefined,
          descricao: entry.descricao,
          createdAt: entry.created_at,
        }));
        setEntries(formattedEntries);
      }
    };

    fetchData();
  }, [churchId]);

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
      // Inserir entrada financeira
      const { data: entryData, error: entryError } = await supabase
        .from('financial_entries')
        .insert({
          church_id: churchId,
          data: formData.data,
          hora: formData.hora || null,
          tipo: formData.tipoEntrada,
          valor: parseFloat(formData.valor),
          membro_id: formData.membroId || null,
          descricao: formData.descricao,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Criar lançamento contábil (partidas dobradas)
      // Débito: Caixa/Banco (onde foi recebido)
      // Crédito: Conta de Receita (tipo de entrada)
      const { error: lancamentoError } = await supabase
        .from('lancamentos_contabeis')
        .insert({
          church_id: churchId,
          data: formData.data,
          historico: `${formData.tipoEntrada} - ${formData.descricao}`,
          conta_debito: formData.recebidoEm,
          conta_credito: formData.tipoEntrada,
          valor: parseFloat(formData.valor),
          documento: entryData.id,
          entry_id: entryData.id,
        });

      if (lancamentoError) throw lancamentoError;

      const newEntry: FinancialEntry = {
        id: entryData.id,
        data: entryData.data,
        hora: entryData.hora || undefined,
        tipo: entryData.tipo as EntryType,
        valor: Number(entryData.valor),
        membroId: entryData.membro_id || undefined,
        membroNome: entryData.membro_nome || undefined,
        descricao: entryData.descricao,
        createdAt: entryData.created_at,
      };
      setEntries((prev) => [newEntry, ...prev]);
      
      setFormData({
        data: new Date().toISOString().split('T')[0],
        hora: '',
        tipoEntrada: '',
        valor: '',
        recebidoEm: '',
        membroId: '',
        descricao: '',
      });

      toast({
        title: 'Entrada registrada!',
        description: `Lançamento de R$ ${parseFloat(formData.valor).toFixed(2)} registrado com sucesso.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    }
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
            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-success text-success-foreground">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Lançamento de Entradas</h1>
              <p className="text-muted-foreground">Registre receitas e doações</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle>Nova Entrada</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data">Data *</Label>
                    <Input
                      id="data"
                      type="date"
                      value={formData.data}
                      onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hora">Hora (Opcional)</Label>
                    <Input
                      id="hora"
                      type="time"
                      value={formData.hora}
                      onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipoEntrada">Tipo de Entrada *</Label>
                  <Select
                    value={formData.tipoEntrada}
                    onValueChange={(value) => setFormData({ ...formData, tipoEntrada: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de entrada" />
                    </SelectTrigger>
                    <SelectContent>
                      {revenueAccounts.map((account) => (
                        <SelectItem key={account.codigo_conta} value={account.codigo_conta}>
                          {account.nome_conta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Label htmlFor="recebidoEm">Recebido em *</Label>
                  <Select
                    value={formData.recebidoEm}
                    onValueChange={(value) => setFormData({ ...formData, recebidoEm: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione onde foi recebido" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Caixa Geral">Caixa Geral</SelectItem>
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={`${account.bank_name} - Ag: ${account.agency} - Conta: ${account.account_number}`}>
                          {account.bank_name} - Ag: {account.agency} - Conta: {account.account_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.tipoEntrada === '4.1.1.01' && (
                  <div className="space-y-2">
                    <Label htmlFor="membro">Membro (Opcional)</Label>
                    <Input
                      id="membro"
                      placeholder="Buscar membro..."
                      value={formData.membroId}
                      onChange={(e) => setFormData({ ...formData, membroId: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Opcional: vincule o dízimo a um membro
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Breve descrição do lançamento (opcional)"
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full gap-2">
                  <Save className="h-4 w-4" />
                  Registrar Entrada
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Entries List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Últimos Lançamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma entrada registrada ainda</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-lg border bg-success/5 border-success/20"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <Badge variant="secondary" className="mb-1">
                            {entry.tipo}
                          </Badge>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(entry.data)}
                            {entry.hora && ` às ${entry.hora}`}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-success">
                          {formatCurrency(entry.valor)}
                        </p>
                      </div>
                      <p className="text-sm">{entry.descricao}</p>
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

export default FinancialEntries;
