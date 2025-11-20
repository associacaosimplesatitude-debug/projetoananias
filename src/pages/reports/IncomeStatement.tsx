import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FileBarChart, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useChurchData } from '@/hooks/useChurchData';
import { format } from 'date-fns';

interface DRELine {
  codigo: string;
  nome: string;
  valor: number;
  nivel: number;
}

interface DREData {
  receitas: DRELine[];
  despesas: DRELine[];
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
}

const IncomeStatement = () => {
  const { toast } = useToast();
  const { churchId } = useChurchData();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dreData, setDreData] = useState<DREData | null>(null);
  const [loading, setLoading] = useState(false);

  const generateDRE = async () => {
    if (!churchId || !startDate || !endDate) {
      toast({
        title: 'Dados incompletos',
        description: 'Por favor, selecione o período para gerar a DRE.',
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

      // Calcular valores por conta
      const valoresPorConta = new Map<string, number>();

      lancamentos?.forEach((lanc) => {
        // Débito aumenta o valor da conta
        const valorDebito = valoresPorConta.get(lanc.conta_debito) || 0;
        valoresPorConta.set(lanc.conta_debito, valorDebito + Number(lanc.valor));

        // Crédito diminui o valor da conta
        const valorCredito = valoresPorConta.get(lanc.conta_credito) || 0;
        valoresPorConta.set(lanc.conta_credito, valorCredito - Number(lanc.valor));
      });

      // Processar receitas (4.1.x)
      const receitas: DRELine[] = [];
      let totalReceitas = 0;

      contas?.forEach((conta) => {
        if (conta.codigo_conta.startsWith('4.1.')) {
          const valor = Math.abs(valoresPorConta.get(conta.codigo_conta) || 0);
          if (valor > 0) {
            const nivel = conta.codigo_conta.split('.').length - 1;
            receitas.push({
              codigo: conta.codigo_conta,
              nome: conta.nome_conta,
              valor,
              nivel,
            });
            if (conta.tipo_conta === 'Analítica') {
              totalReceitas += valor;
            }
          }
        }
      });

      // Processar despesas (4.2.x)
      const despesas: DRELine[] = [];
      let totalDespesas = 0;

      contas?.forEach((conta) => {
        if (conta.codigo_conta.startsWith('4.2.')) {
          const valor = Math.abs(valoresPorConta.get(conta.codigo_conta) || 0);
          if (valor > 0) {
            const nivel = conta.codigo_conta.split('.').length - 1;
            despesas.push({
              codigo: conta.codigo_conta,
              nome: conta.nome_conta,
              valor,
              nivel,
            });
            if (conta.tipo_conta === 'Analítica') {
              totalDespesas += valor;
            }
          }
        }
      });

      const resultado = totalReceitas - totalDespesas;

      setDreData({
        receitas,
        despesas,
        totalReceitas,
        totalDespesas,
        resultado,
      });

      toast({
        title: 'DRE gerada!',
        description: `Período: ${format(new Date(startDate), 'dd/MM/yyyy')} até ${format(new Date(endDate), 'dd/MM/yyyy')}`,
      });
    } catch (error: any) {
      console.error('Erro ao gerar DRE:', error);
      toast({
        title: 'Erro ao gerar DRE',
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
      documentTitle: 'Demonstração do Resultado do Exercício (DRE)',
      churchInfo: churchData || { church_name: 'Igreja' },
      period: `${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`,
      pageNumber: 1,
    });

    const tableData: any[] = [];

    // Receitas
    tableData.push(['RECEITAS', '', '']);
    dreData.receitas.forEach(item => {
      const indent = '  '.repeat(item.nivel - 1);
      tableData.push([item.codigo, indent + item.nome, formatCurrency(item.valor)]);
    });
    tableData.push(['', 'Total de Receitas', formatCurrency(dreData.totalReceitas)]);
    tableData.push(['', '', '']);

    // Despesas
    tableData.push(['DESPESAS', '', '']);
    dreData.despesas.forEach(item => {
      const indent = '  '.repeat(item.nivel - 1);
      tableData.push([item.codigo, indent + item.nome, formatCurrency(item.valor)]);
    });
    tableData.push(['', 'Total de Despesas', formatCurrency(dreData.totalDespesas)]);
    tableData.push(['', '', '']);

    // Resultado
    const resultado = dreData.totalReceitas - dreData.totalDespesas;
    const resultadoLabel = resultado >= 0 ? 'SUPERÁVIT DO PERÍODO' : 'DÉFICIT DO PERÍODO';
    tableData.push(['', resultadoLabel, formatCurrency(Math.abs(resultado))]);

    autoTable(doc, {
      startY: yStart,
      head: [['Código', 'Descrição', 'Valor']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 66, 66] },
    });

    doc.save(`dre_${startDate}_${endDate}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary text-primary-foreground">
              <FileBarChart className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">DRE - Demonstração do Resultado do Exercício</h1>
              <p className="text-muted-foreground">Análise de receitas, despesas e resultado do período</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selecionar Período</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
                  onClick={generateDRE} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Gerando...' : 'Gerar DRE'}
                </Button>
              </div>
            </div>

            {dreData && (
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

                <div className="space-y-6">
                  {/* Receitas */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-success/10 p-4 border-b">
                      <h3 className="font-bold text-lg">RECEITAS</h3>
                    </div>
                    <div className="p-4 space-y-2">
                      {dreData.receitas.map((item) => (
                        <div 
                          key={item.codigo}
                          className="flex justify-between items-center py-2 border-b last:border-0"
                          style={{ paddingLeft: `${item.nivel * 16}px` }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">{item.codigo}</span>
                            <span className={item.nivel === 2 ? 'font-semibold' : ''}>{item.nome}</span>
                          </div>
                          <span className="font-mono text-success">
                            {formatCurrency(item.valor)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center py-3 border-t-2 border-success font-bold text-lg mt-2">
                        <span>TOTAL DE RECEITAS</span>
                        <span className="font-mono text-success">
                          {formatCurrency(dreData.totalReceitas)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Despesas */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-destructive/10 p-4 border-b">
                      <h3 className="font-bold text-lg">DESPESAS</h3>
                    </div>
                    <div className="p-4 space-y-2">
                      {dreData.despesas.map((item) => (
                        <div 
                          key={item.codigo}
                          className="flex justify-between items-center py-2 border-b last:border-0"
                          style={{ paddingLeft: `${item.nivel * 16}px` }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">{item.codigo}</span>
                            <span className={item.nivel === 2 ? 'font-semibold' : ''}>{item.nome}</span>
                          </div>
                          <span className="font-mono text-destructive">
                            ({formatCurrency(item.valor)})
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center py-3 border-t-2 border-destructive font-bold text-lg mt-2">
                        <span>TOTAL DE DESPESAS</span>
                        <span className="font-mono text-destructive">
                          ({formatCurrency(dreData.totalDespesas)})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Resultado */}
                  <div className={`border-2 rounded-lg overflow-hidden ${
                    dreData.resultado >= 0 ? 'border-success' : 'border-destructive'
                  }`}>
                    <div className={`p-6 ${
                      dreData.resultado >= 0 ? 'bg-success/10' : 'bg-destructive/10'
                    }`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-2xl">
                            {dreData.resultado >= 0 ? 'LUCRO DO PERÍODO' : 'PREJUÍZO DO PERÍODO'}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Receitas - Despesas
                          </p>
                        </div>
                        <span className={`font-mono text-3xl font-bold ${
                          dreData.resultado >= 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          {formatCurrency(Math.abs(dreData.resultado))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!dreData && !loading && startDate && endDate && (
              <div className="text-center py-12 text-muted-foreground">
                <FileBarChart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Clique em "Gerar DRE" para visualizar o relatório</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IncomeStatement;
