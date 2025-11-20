import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Scale, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useChurchData } from '@/hooks/useChurchData';
import { format } from 'date-fns';

interface BalanceItem {
  codigo: string;
  nome: string;
  valor: number;
  nivel: number;
  tipo: string;
}

interface BalanceData {
  ativo: BalanceItem[];
  passivo: BalanceItem[];
  patrimonioLiquido: BalanceItem[];
  totalAtivo: number;
  totalPassivo: number;
  totalPatrimonioLiquido: number;
}

const BalanceSheet = () => {
  const { toast } = useToast();
  const { churchId } = useChurchData();
  const [balanceDate, setBalanceDate] = useState('');
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(false);

  const generateBalance = async () => {
    if (!churchId || !balanceDate) {
      toast({
        title: 'Dados incompletos',
        description: 'Por favor, selecione a data para gerar o balanço.',
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

      // Buscar todos os lançamentos até a data selecionada
      const { data: lancamentos, error: lancamentosError } = await supabase
        .from('lancamentos_contabeis')
        .select('*')
        .eq('church_id', churchId)
        .lte('data', balanceDate);

      if (lancamentosError) throw lancamentosError;

      // Calcular saldo de cada conta
      const saldoPorConta = new Map<string, number>();

      lancamentos?.forEach((lanc) => {
        // Débito
        const saldoDebito = saldoPorConta.get(lanc.conta_debito) || 0;
        saldoPorConta.set(lanc.conta_debito, saldoDebito + Number(lanc.valor));

        // Crédito
        const saldoCredito = saldoPorConta.get(lanc.conta_credito) || 0;
        saldoPorConta.set(lanc.conta_credito, saldoCredito - Number(lanc.valor));
      });

      // Processar ATIVO (1.x)
      const ativo: BalanceItem[] = [];
      let totalAtivo = 0;

      contas?.forEach((conta) => {
        if (conta.codigo_conta.startsWith('1.')) {
          let saldo = saldoPorConta.get(conta.codigo_conta) || 0;
          
          // Ajustar pela natureza da conta
          if (conta.natureza === 'Credora') {
            saldo = -saldo;
          }

          if (saldo !== 0 || conta.tipo_conta === 'Sintética') {
            const nivel = conta.codigo_conta.split('.').length - 1;
            ativo.push({
              codigo: conta.codigo_conta,
              nome: conta.nome_conta,
              valor: saldo,
              nivel,
              tipo: conta.tipo_conta,
            });
            
            if (conta.tipo_conta === 'Analítica' && saldo > 0) {
              totalAtivo += saldo;
            }
          }
        }
      });

      // Processar PASSIVO (2.x)
      const passivo: BalanceItem[] = [];
      let totalPassivo = 0;

      contas?.forEach((conta) => {
        if (conta.codigo_conta.startsWith('2.')) {
          let saldo = saldoPorConta.get(conta.codigo_conta) || 0;
          
          // Ajustar pela natureza da conta (Passivo é credor)
          if (conta.natureza === 'Devedora') {
            saldo = -saldo;
          } else {
            saldo = Math.abs(saldo);
          }

          if (saldo !== 0 || conta.tipo_conta === 'Sintética') {
            const nivel = conta.codigo_conta.split('.').length - 1;
            passivo.push({
              codigo: conta.codigo_conta,
              nome: conta.nome_conta,
              valor: saldo,
              nivel,
              tipo: conta.tipo_conta,
            });
            
            if (conta.tipo_conta === 'Analítica' && saldo > 0) {
              totalPassivo += saldo;
            }
          }
        }
      });

      // Processar PATRIMÔNIO LÍQUIDO (3.x)
      const patrimonioLiquido: BalanceItem[] = [];
      let totalPatrimonioLiquido = 0;

      contas?.forEach((conta) => {
        if (conta.codigo_conta.startsWith('3.')) {
          let saldo = saldoPorConta.get(conta.codigo_conta) || 0;
          
          // Ajustar pela natureza da conta (PL é credor)
          if (conta.natureza === 'Devedora') {
            saldo = -saldo;
          } else {
            saldo = Math.abs(saldo);
          }

          if (saldo !== 0 || conta.tipo_conta === 'Sintética') {
            const nivel = conta.codigo_conta.split('.').length - 1;
            patrimonioLiquido.push({
              codigo: conta.codigo_conta,
              nome: conta.nome_conta,
              valor: saldo,
              nivel,
              tipo: conta.tipo_conta,
            });
            
            if (conta.tipo_conta === 'Analítica' && saldo > 0) {
              totalPatrimonioLiquido += saldo;
            }
          }
        }
      });

      setBalanceData({
        ativo,
        passivo,
        patrimonioLiquido,
        totalAtivo,
        totalPassivo,
        totalPatrimonioLiquido,
      });

      toast({
        title: 'Balanço Patrimonial gerado!',
        description: `Data: ${format(new Date(balanceDate), 'dd/MM/yyyy')}`,
      });
    } catch (error: any) {
      console.error('Erro ao gerar balanço:', error);
      toast({
        title: 'Erro ao gerar balanço',
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
    if (!balanceData) return;

    const rows: string[][] = [
      ['BALANÇO PATRIMONIAL'],
      [`Data: ${format(new Date(balanceDate), 'dd/MM/yyyy')}`],
      [''],
      ['ATIVO'],
    ];

    balanceData.ativo.forEach(item => {
      if (item.valor !== 0 || item.tipo === 'Sintética') {
        rows.push([item.codigo, item.nome, item.valor.toFixed(2)]);
      }
    });

    rows.push(['', 'TOTAL DO ATIVO', balanceData.totalAtivo.toFixed(2)]);
    rows.push(['']);
    rows.push(['PASSIVO']);

    balanceData.passivo.forEach(item => {
      if (item.valor !== 0 || item.tipo === 'Sintética') {
        rows.push([item.codigo, item.nome, item.valor.toFixed(2)]);
      }
    });

    rows.push(['', 'TOTAL DO PASSIVO', balanceData.totalPassivo.toFixed(2)]);
    rows.push(['']);
    rows.push(['PATRIMÔNIO LÍQUIDO']);

    balanceData.patrimonioLiquido.forEach(item => {
      if (item.valor !== 0 || item.tipo === 'Sintética') {
        rows.push([item.codigo, item.nome, item.valor.toFixed(2)]);
      }
    });

    rows.push(['', 'TOTAL DO PATRIMÔNIO LÍQUIDO', balanceData.totalPatrimonioLiquido.toFixed(2)]);
    rows.push(['']);
    rows.push(['', 'TOTAL DO PASSIVO + PL', (balanceData.totalPassivo + balanceData.totalPatrimonioLiquido).toFixed(2)]);

    const csv = rows.map(row => row.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `balanco_patrimonial_${balanceDate}.csv`;
    link.click();
  };

  const totalPassivoEPL = balanceData 
    ? balanceData.totalPassivo + balanceData.totalPatrimonioLiquido 
    : 0;

  const isBalanced = balanceData 
    ? Math.abs(balanceData.totalAtivo - totalPassivoEPL) < 0.01 
    : false;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary text-primary-foreground">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Balanço Patrimonial</h1>
              <p className="text-muted-foreground">Posição patrimonial e financeira da igreja</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selecionar Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="balance-date">Data do Balanço *</Label>
                <Input
                  id="balance-date"
                  type="date"
                  value={balanceDate}
                  onChange={(e) => setBalanceDate(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={generateBalance} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Gerando...' : 'Gerar Balanço'}
                </Button>
              </div>
            </div>

            {balanceData && (
              <>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Data: {format(new Date(balanceDate), 'dd/MM/yyyy')}
                  </p>
                  <Button onClick={exportToCSV} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* ATIVO */}
                  <div className="space-y-4">
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-primary/10 p-4 border-b">
                        <h3 className="font-bold text-lg">ATIVO</h3>
                      </div>
                      <div className="p-4 space-y-2">
                        {balanceData.ativo.map((item) => (
                          item.valor !== 0 || item.tipo === 'Sintética' ? (
                            <div 
                              key={item.codigo}
                              className="flex justify-between items-center py-2 border-b last:border-0"
                              style={{ paddingLeft: `${item.nivel * 16}px` }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-muted-foreground">{item.codigo}</span>
                                <span className={item.tipo === 'Sintética' ? 'font-semibold' : ''}>
                                  {item.nome}
                                </span>
                              </div>
                              {item.tipo === 'Analítica' && (
                                <span className="font-mono">
                                  {formatCurrency(item.valor)}
                                </span>
                              )}
                            </div>
                          ) : null
                        ))}
                        <div className="flex justify-between items-center py-3 border-t-2 border-primary font-bold text-lg mt-2">
                          <span>TOTAL DO ATIVO</span>
                          <span className="font-mono">
                            {formatCurrency(balanceData.totalAtivo)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PASSIVO E PATRIMÔNIO LÍQUIDO */}
                  <div className="space-y-4">
                    {/* PASSIVO */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-destructive/10 p-4 border-b">
                        <h3 className="font-bold text-lg">PASSIVO</h3>
                      </div>
                      <div className="p-4 space-y-2">
                        {balanceData.passivo.map((item) => (
                          item.valor !== 0 || item.tipo === 'Sintética' ? (
                            <div 
                              key={item.codigo}
                              className="flex justify-between items-center py-2 border-b last:border-0"
                              style={{ paddingLeft: `${item.nivel * 16}px` }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-muted-foreground">{item.codigo}</span>
                                <span className={item.tipo === 'Sintética' ? 'font-semibold' : ''}>
                                  {item.nome}
                                </span>
                              </div>
                              {item.tipo === 'Analítica' && (
                                <span className="font-mono">
                                  {formatCurrency(item.valor)}
                                </span>
                              )}
                            </div>
                          ) : null
                        ))}
                        <div className="flex justify-between items-center py-3 border-t-2 border-destructive font-bold text-lg mt-2">
                          <span>TOTAL DO PASSIVO</span>
                          <span className="font-mono">
                            {formatCurrency(balanceData.totalPassivo)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* PATRIMÔNIO LÍQUIDO */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-success/10 p-4 border-b">
                        <h3 className="font-bold text-lg">PATRIMÔNIO LÍQUIDO</h3>
                      </div>
                      <div className="p-4 space-y-2">
                        {balanceData.patrimonioLiquido.map((item) => (
                          item.valor !== 0 || item.tipo === 'Sintética' ? (
                            <div 
                              key={item.codigo}
                              className="flex justify-between items-center py-2 border-b last:border-0"
                              style={{ paddingLeft: `${item.nivel * 16}px` }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-muted-foreground">{item.codigo}</span>
                                <span className={item.tipo === 'Sintética' ? 'font-semibold' : ''}>
                                  {item.nome}
                                </span>
                              </div>
                              {item.tipo === 'Analítica' && (
                                <span className="font-mono">
                                  {formatCurrency(item.valor)}
                                </span>
                              )}
                            </div>
                          ) : null
                        ))}
                        <div className="flex justify-between items-center py-3 border-t-2 border-success font-bold text-lg mt-2">
                          <span>TOTAL DO PATRIMÔNIO LÍQUIDO</span>
                          <span className="font-mono">
                            {formatCurrency(balanceData.totalPatrimonioLiquido)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* TOTAL PASSIVO + PL */}
                    <div className="border-2 border-primary rounded-lg p-4 bg-primary/5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">TOTAL DO PASSIVO + PL</span>
                        <span className="font-mono font-bold text-lg">
                          {formatCurrency(totalPassivoEPL)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verificação de consistência */}
                <div className={`p-4 rounded-lg ${
                  isBalanced
                    ? 'bg-success/10 border border-success/20'
                    : 'bg-destructive/10 border border-destructive/20'
                }`}>
                  <p className="font-semibold">
                    {isBalanced
                      ? '✓ Balanço equilibrado: Ativo = Passivo + Patrimônio Líquido'
                      : '✗ Balanço desequilibrado: Ativo ≠ Passivo + Patrimônio Líquido'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Diferença: {formatCurrency(Math.abs(balanceData.totalAtivo - totalPassivoEPL))}
                  </p>
                </div>
              </>
            )}

            {!balanceData && !loading && balanceDate && (
              <div className="text-center py-12 text-muted-foreground">
                <Scale className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Clique em "Gerar Balanço" para visualizar o relatório</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BalanceSheet;