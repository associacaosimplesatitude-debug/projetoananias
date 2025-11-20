import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Download, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useChurchData } from '@/hooks/useChurchData';
import { format } from 'date-fns';

interface JournalEntry {
  id: string;
  data: string;
  documento: string | null;
  historico: string;
  conta_debito: string;
  conta_credito: string;
  valor: number;
  conta_debito_nome?: string;
  conta_credito_nome?: string;
}

interface Account {
  codigo_conta: string;
  nome_conta: string;
}

const AccountingJournal = () => {
  const { toast } = useToast();
  const { churchId } = useChurchData();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [journalData, setJournalData] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const { data, error } = await supabase
      .from('plano_de_contas')
      .select('codigo_conta, nome_conta')
      .order('codigo_conta');

    if (error) {
      console.error('Erro ao carregar contas:', error);
      return;
    }

    setAccounts(data || []);
  };

  const generateJournal = async () => {
    if (!churchId || !startDate || !endDate) {
      toast({
        title: 'Dados incompletos',
        description: 'Por favor, selecione o período para gerar o livro diário.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      let query = supabase
        .from('lancamentos_contabeis')
        .select('*')
        .eq('church_id', churchId)
        .gte('data', startDate)
        .lte('data', endDate)
        .order('data', { ascending: true })
        .order('created_at', { ascending: true });

      const { data: lancamentos, error } = await query;

      if (error) throw error;

      // Buscar nomes das contas
      const { data: contas, error: contasError } = await supabase
        .from('plano_de_contas')
        .select('codigo_conta, nome_conta');

      if (contasError) throw contasError;

      const contasMap = new Map(contas?.map(c => [c.codigo_conta, c.nome_conta]) || []);

      // Enriquecer os lançamentos com nomes das contas
      let enrichedData = lancamentos?.map(lanc => ({
        ...lanc,
        conta_debito_nome: contasMap.get(lanc.conta_debito),
        conta_credito_nome: contasMap.get(lanc.conta_credito),
      })) || [];

      // Aplicar filtros
      if (selectedAccount !== 'all') {
        enrichedData = enrichedData.filter(
          lanc => lanc.conta_debito === selectedAccount || lanc.conta_credito === selectedAccount
        );
      }

      if (selectedType !== 'all') {
        if (selectedType === 'entrada') {
          enrichedData = enrichedData.filter(lanc => lanc.entry_id !== null);
        } else if (selectedType === 'despesa') {
          enrichedData = enrichedData.filter(lanc => lanc.expense_id !== null);
        }
      }

      setJournalData(enrichedData);

      toast({
        title: 'Livro Diário gerado!',
        description: `${enrichedData.length} lançamentos encontrados no período.`,
      });
    } catch (error: any) {
      console.error('Erro ao gerar livro diário:', error);
      toast({
        title: 'Erro ao gerar livro diário',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const exportToCSV = () => {
    if (journalData.length === 0) return;

    const headers = ['Data', 'Documento', 'Histórico', 'Conta Débito', 'Conta Crédito', 'Valor'];
    const rows = journalData.map(entry => [
      format(new Date(entry.data), 'dd/MM/yyyy'),
      entry.documento || '-',
      entry.historico,
      `${entry.conta_debito} - ${entry.conta_debito_nome}`,
      `${entry.conta_credito} - ${entry.conta_credito_nome}`,
      entry.valor.toFixed(2),
    ]);

    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `livro_diario_${startDate}_${endDate}.csv`;
    link.click();
  };

  const totalDebits = journalData.reduce((sum, entry) => sum + Number(entry.valor), 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Livro Diário</h1>
              <p className="text-muted-foreground">Registro cronológico de todos os lançamentos contábeis</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filtros de período */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Data de Início *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">Data de Fim *</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-filter">Conta</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger id="account-filter">
                    <SelectValue placeholder="Todas as contas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as contas</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.codigo_conta} value={account.codigo_conta}>
                        {account.codigo_conta} - {account.nome_conta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type-filter">Tipo</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger id="type-filter">
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="entrada">Entradas</SelectItem>
                    <SelectItem value="despesa">Despesas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={generateJournal} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Gerando...' : 'Gerar Livro'}
                </Button>
              </div>
            </div>

            {/* Tabela de resultados */}
            {journalData.length > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Período: {format(new Date(startDate), 'dd/MM/yyyy')} até {format(new Date(endDate), 'dd/MM/yyyy')}
                    {selectedAccount !== 'all' && ` • Conta: ${selectedAccount}`}
                    {selectedType !== 'all' && ` • Tipo: ${selectedType === 'entrada' ? 'Entradas' : 'Despesas'}`}
                  </p>
                  <Button onClick={exportToCSV} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 font-semibold">Data</th>
                          <th className="text-left p-3 font-semibold">Documento</th>
                          <th className="text-left p-3 font-semibold">Histórico</th>
                          <th className="text-left p-3 font-semibold">Conta Débito</th>
                          <th className="text-left p-3 font-semibold">Conta Crédito</th>
                          <th className="text-right p-3 font-semibold">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {journalData.map((entry, index) => (
                          <tr 
                            key={entry.id} 
                            className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                          >
                            <td className="p-3 font-mono text-sm">
                              {format(new Date(entry.data), 'dd/MM/yyyy')}
                            </td>
                            <td className="p-3 text-sm">
                              {entry.documento || '-'}
                            </td>
                            <td className="p-3 text-sm">
                              {entry.historico}
                            </td>
                            <td className="p-3 text-sm">
                              <div className="flex flex-col">
                                <span className="font-mono text-xs text-muted-foreground">{entry.conta_debito}</span>
                                <span>{entry.conta_debito_nome}</span>
                              </div>
                            </td>
                            <td className="p-3 text-sm">
                              <div className="flex flex-col">
                                <span className="font-mono text-xs text-muted-foreground">{entry.conta_credito}</span>
                                <span>{entry.conta_credito_nome}</span>
                              </div>
                            </td>
                            <td className="p-3 text-right font-mono text-sm font-semibold">
                              {formatCurrency(entry.valor)}
                            </td>
                          </tr>
                        ))}
                        
                        {/* Linha de total */}
                        <tr className="bg-primary/10 font-bold border-t-2 border-primary">
                          <td colSpan={5} className="p-3 text-right">TOTAL:</td>
                          <td className="p-3 text-right font-mono">
                            {formatCurrency(totalDebits)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  Total de lançamentos: {journalData.length}
                </div>
              </>
            )}

            {journalData.length === 0 && !loading && startDate && endDate && (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum lançamento encontrado no período selecionado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccountingJournal;
