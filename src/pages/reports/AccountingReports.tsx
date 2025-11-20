import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FileText, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useChurchData } from '@/hooks/useChurchData';
import { format } from 'date-fns';

interface BalanceLine {
  codigoConta: string;
  nomeConta: string;
  natureza: string;
  saldoAnterior: number;
  debitos: number;
  creditos: number;
  saldoAtual: number;
}

const AccountingReports = () => {
  const { toast } = useToast();
  const { churchId } = useChurchData();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [balanceData, setBalanceData] = useState<BalanceLine[]>([]);
  const [loading, setLoading] = useState(false);

  const generateBalance = async () => {
    if (!churchId || !startDate || !endDate) {
      toast({
        title: 'Dados incompletos',
        description: 'Por favor, selecione o período para gerar o relatório.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Buscar todas as contas do plano de contas
      const { data: contas, error: contasError } = await supabase
        .from('plano_de_contas')
        .select('*')
        .order('codigo_conta');

      if (contasError) throw contasError;

      // Buscar lançamentos do período
      const { data: lancamentos, error: lancamentosError } = await supabase
        .from('lancamentos_contabeis')
        .select('*')
        .eq('church_id', churchId)
        .gte('data', startDate)
        .lte('data', endDate);

      if (lancamentosError) throw lancamentosError;

      // Buscar lançamentos anteriores ao período (para saldo anterior)
      const { data: lancamentosAnteriores, error: anterioresError } = await supabase
        .from('lancamentos_contabeis')
        .select('*')
        .eq('church_id', churchId)
        .lt('data', startDate);

      if (anterioresError) throw anterioresError;

      // Calcular balancete
      const balance: BalanceLine[] = [];

      contas?.forEach((conta) => {
        // Calcular saldo anterior
        let saldoAnterior = 0;
        lancamentosAnteriores?.forEach((lanc) => {
          if (lanc.conta_debito === conta.codigo_conta) {
            saldoAnterior += Number(lanc.valor);
          }
          if (lanc.conta_credito === conta.codigo_conta) {
            saldoAnterior -= Number(lanc.valor);
          }
        });

        // Ajustar saldo anterior pela natureza da conta
        if (conta.natureza === 'Credora') {
          saldoAnterior = -saldoAnterior;
        }

        // Calcular débitos e créditos do período
        let debitos = 0;
        let creditos = 0;

        lancamentos?.forEach((lanc) => {
          if (lanc.conta_debito === conta.codigo_conta) {
            debitos += Number(lanc.valor);
          }
          if (lanc.conta_credito === conta.codigo_conta) {
            creditos += Number(lanc.valor);
          }
        });

        // Calcular saldo atual
        let saldoAtual = saldoAnterior;
        if (conta.natureza === 'Devedora') {
          saldoAtual = saldoAnterior + debitos - creditos;
        } else {
          saldoAtual = saldoAnterior + creditos - debitos;
        }

        // Adicionar apenas contas com movimentação
        if (debitos > 0 || creditos > 0 || saldoAnterior !== 0) {
          balance.push({
            codigoConta: conta.codigo_conta,
            nomeConta: conta.nome_conta,
            natureza: conta.natureza,
            saldoAnterior,
            debitos,
            creditos,
            saldoAtual,
          });
        }
      });

      setBalanceData(balance);

      toast({
        title: 'Balancete gerado!',
        description: `${balance.length} contas com movimentação no período.`,
      });
    } catch (error: any) {
      console.error('Erro ao gerar balancete:', error);
      toast({
        title: 'Erro ao gerar balancete',
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

  const calculateTotals = () => {
    const totalDebitos = balanceData.reduce((sum, line) => sum + line.debitos, 0);
    const totalCreditos = balanceData.reduce((sum, line) => sum + line.creditos, 0);
    const totalSaldoAnterior = balanceData.reduce((sum, line) => sum + line.saldoAnterior, 0);
    const totalSaldoAtual = balanceData.reduce((sum, line) => sum + line.saldoAtual, 0);
    return { totalDebitos, totalCreditos, totalSaldoAnterior, totalSaldoAtual };
  };

  const exportToPDF = async () => {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    const { addPDFHeader, formatCurrency } = await import('@/lib/pdfGenerator');
    
    const doc = new jsPDF();

    // Buscar informações da igreja
    const { data: churchData } = await supabase
      .from('churches')
      .select('church_name, address, city, state, postal_code, cnpj')
      .single();

    const yStart = addPDFHeader(doc, {
      documentTitle: 'Balancete Analítico',
      churchInfo: churchData || { church_name: 'Igreja' },
      period: `${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`,
      pageNumber: 1,
    });

    const tableData = balanceData.map(item => [
      item.codigoConta,
      item.nomeConta,
      item.natureza,
      formatCurrency(item.saldoAnterior),
      formatCurrency(item.debitos),
      formatCurrency(item.creditos),
      formatCurrency(item.saldoAtual),
    ]);

    const totals = calculateTotals();
    tableData.push([
      '',
      'TOTAIS',
      '',
      formatCurrency(totals.totalSaldoAnterior),
      formatCurrency(totals.totalDebitos),
      formatCurrency(totals.totalCreditos),
      formatCurrency(totals.totalSaldoAtual),
    ]);

    autoTable(doc, {
      startY: yStart,
      head: [['Código', 'Conta', 'Natureza', 'Saldo Anterior', 'Débitos', 'Créditos', 'Saldo Atual']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] },
    });

    doc.save(`balancete_${startDate}_${endDate}.pdf`);
  };

  const totals = balanceData.length > 0 ? calculateTotals() : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary text-primary-foreground">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Relatórios Contábeis</h1>
              <p className="text-muted-foreground">Gere relatórios e demonstrações contábeis</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Balancete de Verificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filtros de período */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              <div className="flex items-end">
                <Button 
                  onClick={generateBalance} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Gerando...' : 'Gerar Relatório'}
                </Button>
              </div>
            </div>

            {/* Tabela de resultados */}
            {balanceData.length > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Período: {format(new Date(startDate), 'dd/MM/yyyy')} até {format(new Date(endDate), 'dd/MM/yyyy')}
                  </p>
                  <Button onClick={exportToPDF} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar PDF
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 font-semibold">Código</th>
                          <th className="text-left p-3 font-semibold">Nome da Conta</th>
                          <th className="text-left p-3 font-semibold">Natureza</th>
                          <th className="text-right p-3 font-semibold">Saldo Anterior</th>
                          <th className="text-right p-3 font-semibold">Débitos</th>
                          <th className="text-right p-3 font-semibold">Créditos</th>
                          <th className="text-right p-3 font-semibold">Saldo Atual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balanceData.map((line, index) => (
                          <tr 
                            key={line.codigoConta} 
                            className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                          >
                            <td className="p-3 font-mono text-sm">{line.codigoConta}</td>
                            <td className="p-3">{line.nomeConta}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                line.natureza === 'Devedora' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              }`}>
                                {line.natureza}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono text-sm">
                              {formatCurrency(line.saldoAnterior)}
                            </td>
                            <td className="p-3 text-right font-mono text-sm text-blue-600 dark:text-blue-400">
                              {formatCurrency(line.debitos)}
                            </td>
                            <td className="p-3 text-right font-mono text-sm text-green-600 dark:text-green-400">
                              {formatCurrency(line.creditos)}
                            </td>
                            <td className="p-3 text-right font-mono text-sm font-semibold">
                              {formatCurrency(line.saldoAtual)}
                            </td>
                          </tr>
                        ))}
                        
                        {/* Linha de totais */}
                        {totals && (
                          <tr className="bg-primary/10 font-bold border-t-2 border-primary">
                            <td colSpan={4} className="p-3 text-right">TOTAIS:</td>
                            <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                              {formatCurrency(totals.totalDebitos)}
                            </td>
                            <td className="p-3 text-right font-mono text-green-600 dark:text-green-400">
                              {formatCurrency(totals.totalCreditos)}
                            </td>
                            <td className="p-3"></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Verificação de consistência */}
                {totals && (
                  <div className={`p-4 rounded-lg ${
                    Math.abs(totals.totalDebitos - totals.totalCreditos) < 0.01
                      ? 'bg-success/10 border border-success/20'
                      : 'bg-destructive/10 border border-destructive/20'
                  }`}>
                    <p className="font-semibold">
                      {Math.abs(totals.totalDebitos - totals.totalCreditos) < 0.01
                        ? '✓ Balancete consistente: Débitos = Créditos'
                        : '✗ Balancete inconsistente: Débitos ≠ Créditos'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Diferença: {formatCurrency(Math.abs(totals.totalDebitos - totals.totalCreditos))}
                    </p>
                  </div>
                )}
              </>
            )}

            {balanceData.length === 0 && !loading && startDate && endDate && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma movimentação encontrada no período selecionado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccountingReports;
