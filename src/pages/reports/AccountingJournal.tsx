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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

    if (data && !error) {
      setAccounts(data);
    }
  };

  const generateJournal = async () => {
    if (!churchId || !startDate || !endDate) {
      toast({
        title: 'Dados incompletos',
        description: 'Por favor, preencha as datas para gerar o diário.',
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
        .order('data', { ascending: true });

      if (selectedAccount !== 'all') {
        query = query.or(`conta_debito.eq.${selectedAccount},conta_credito.eq.${selectedAccount}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Enriquecer com nomes das contas
      const enrichedData = data.map((entry) => {
        const debitoAccount = accounts.find(acc => acc.codigo_conta === entry.conta_debito);
        const creditoAccount = accounts.find(acc => acc.codigo_conta === entry.conta_credito);
        
        return {
          ...entry,
          conta_debito_nome: debitoAccount?.nome_conta || entry.conta_debito,
          conta_credito_nome: creditoAccount?.nome_conta || entry.conta_credito,
        };
      });

      setJournalData(enrichedData);

      toast({
        title: 'Diário gerado',
        description: `${enrichedData.length} lançamentos encontrados.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar diário',
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
    const doc = new jsPDF();
    let currentPage = 1;

    // Buscar informações da igreja e pastor
    const { data: churchData } = await supabase
      .from('churches')
      .select('church_name, address, city, state, postal_code, cnpj, pastor_name, pastor_cpf')
      .single();

    // Função para adicionar cabeçalho
    const addHeader = (pageNum: number) => {
      const pageWidth = doc.internal.pageSize.width;
      let yPosition = 15;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Livro Diário', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      doc.setFontSize(12);
      doc.text(churchData?.church_name || 'Igreja', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      const fullAddress = [
        churchData?.address,
        churchData?.city,
        churchData?.state,
        churchData?.postal_code
      ].filter(Boolean).join(', ');
      
      if (fullAddress) {
        doc.text(fullAddress, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 5;
      }

      if (churchData?.cnpj) {
        doc.text(`CNPJ: ${churchData.cnpj}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 5;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`Período: ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;

      doc.setFont('helvetica', 'normal');
      const now = new Date();
      doc.text(`Emitido em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;

      doc.text(`Página: ${pageNum}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;

      doc.setLineWidth(0.5);
      doc.line(10, yPosition + 2, pageWidth - 10, yPosition + 2);

      return yPosition + 7;
    };

    // Primeira página - Termo de Abertura
    let yPos = addHeader(currentPage);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TERMO DE ABERTURA', doc.internal.pageSize.width / 2, yPos, { align: 'center' });
    yPos += 15;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const termoAbertura = `Contém este livro ${journalData.length} lançamentos, numerados de 1 (um) a ${journalData.length} (${extenso(journalData.length)}), destinado ao registro dos atos e fatos administrativos da ${churchData?.church_name || 'Igreja'}, inscrita no CNPJ sob o nº ${churchData?.cnpj || '___.___.___/____-__'}.`;
    
    const lines = doc.splitTextToSize(termoAbertura, 170);
    lines.forEach((line: string) => {
      doc.text(line, 20, yPos);
      yPos += 7;
    });

    yPos += 10;
    doc.text(`${churchData?.city || 'Cidade'}, ${new Date().toLocaleDateString('pt-BR')}`, 20, yPos);

    // Páginas intermediárias - Lançamentos
    doc.addPage();
    currentPage++;
    yPos = addHeader(currentPage);

    const tableData = journalData.map((entry, index) => [
      (index + 1).toString(),
      new Date(entry.data).toLocaleDateString('pt-BR'),
      entry.historico,
      `D: ${entry.conta_debito_nome}\nC: ${entry.conta_credito_nome}`,
      formatCurrency(entry.valor),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Nº', 'Data', 'Histórico', 'Contas', 'Valor']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] },
      didDrawPage: (data) => {
        // Adicionar cabeçalho em cada nova página
        if (data.pageNumber > 2) {
          currentPage = data.pageNumber;
          addHeader(currentPage);
        }
      },
    });

    // Última página - Termo de Encerramento
    doc.addPage();
    currentPage++;
    yPos = addHeader(currentPage);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TERMO DE ENCERRAMENTO', doc.internal.pageSize.width / 2, yPos, { align: 'center' });
    yPos += 15;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const termoEncerramento = `Contém este livro ${journalData.length} lançamentos, numerados de 1 (um) a ${journalData.length} (${extenso(journalData.length)}), referente ao período de ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}.`;
    
    const linesEnc = doc.splitTextToSize(termoEncerramento, 170);
    linesEnc.forEach((line: string) => {
      doc.text(line, 20, yPos);
      yPos += 7;
    });

    yPos += 20;
    doc.text(`${churchData?.city || 'Cidade'}, ${new Date().toLocaleDateString('pt-BR')}`, 20, yPos);
    
    // Assinaturas
    yPos += 30;
    doc.setFont('helvetica', 'bold');
    doc.text('_______________________________________________', 20, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`${churchData?.pastor_name || 'Nome do Pastor'}`, 20, yPos);
    yPos += 5;
    doc.text(`Presidente - CPF: ${formatCPF(churchData?.pastor_cpf || '')}`, 20, yPos);

    yPos += 20;
    doc.setFont('helvetica', 'bold');
    doc.text('_______________________________________________', 20, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    doc.text('Assinado eletronicamente por: GILMAR GARCEZ', 20, yPos);
    yPos += 5;
    doc.text('Contador - CRC-SP 135400', 20, yPos);
    yPos += 5;
    doc.text('CPF: 007.650.088-82', 20, yPos);

    doc.save(`livro_diario_${startDate}_${endDate}.pdf`);
  };

  // Função auxiliar para formatar CPF
  const formatCPF = (cpf: string) => {
    if (!cpf) return '___.___.___-__';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  // Função auxiliar para escrever números por extenso (simplificada)
  const extenso = (num: number): string => {
    const unidades = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const dezAVinte = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    if (num < 10) return unidades[num];
    if (num >= 10 && num < 20) return dezAVinte[num - 10];
    if (num >= 20 && num < 100) {
      const dez = Math.floor(num / 10);
      const uni = num % 10;
      return dezenas[dez] + (uni > 0 ? ' e ' + unidades[uni] : '');
    }
    if (num >= 100 && num < 1000) {
      const cen = Math.floor(num / 100);
      const resto = num % 100;
      if (num === 100) return 'cem';
      return centenas[cen] + (resto > 0 ? ' e ' + extenso(resto) : '');
    }
    return num.toString(); // Fallback para números maiores
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Livro Diário</h1>
          <p className="text-muted-foreground">
            Registro cronológico de todos os lançamentos contábeis
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="start-date">Data Inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="end-date">Data Final</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="account">Conta</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger id="account">
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

            <div className="flex items-end">
              <Button onClick={generateJournal} disabled={loading} className="w-full">
                {loading ? 'Gerando...' : 'Gerar Diário'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {journalData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Lançamentos do Período</CardTitle>
            <Button onClick={exportToPDF}>
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {journalData.map((entry, index) => (
                <div key={entry.id} className="border-b pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex gap-4">
                      <span className="font-semibold">#{index + 1}</span>
                      <span className="text-muted-foreground">
                        {new Date(entry.data).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <span className="font-semibold">{formatCurrency(entry.valor)}</span>
                  </div>
                  <div className="ml-12">
                    <p className="text-sm mb-2">{entry.historico}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-semibold">D: </span>
                        {entry.conta_debito_nome}
                      </div>
                      <div>
                        <span className="font-semibold">C: </span>
                        {entry.conta_credito_nome}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="pt-4 border-t-2 border-foreground">
                <div className="flex justify-between items-center font-bold">
                  <span>TOTAL</span>
                  <span>
                    {formatCurrency(journalData.reduce((sum, entry) => sum + entry.valor, 0))}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {journalData.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione o período e clique em "Gerar Diário" para visualizar os lançamentos.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AccountingJournal;
