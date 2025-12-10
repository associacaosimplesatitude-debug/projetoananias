import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, CheckCircle, XCircle } from "lucide-react";
import * as XLSX from "xlsx";

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendedores: { id: string; nome: string; email: string }[];
  onImportComplete: () => void;
}

interface LeadRow {
  nome_igreja?: string;
  cnpj?: string;
  email?: string;
  email_nota?: string;
  telefone?: string;
  nome_responsavel?: string;
  endereco_cep?: string;
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  ultima_compra?: string;
  valor_ultima_compra?: number;
  total_compras_historico?: number;
  observacoes?: string;
  vendedor_email?: string;
}

type ImportStep = 'upload' | 'mapping' | 'importing' | 'result';

interface ColumnMapping {
  [systemField: string]: string;
}

export function ImportLeadsDialog({ open, onOpenChange, vendedores, onImportComplete }: ImportLeadsDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [sheetColumns, setSheetColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; errors: number; messages: string[] }>({ success: 0, errors: 0, messages: [] });

  const systemFields = [
    { key: 'nome_igreja', label: 'Nome da Igreja *', required: true },
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'email', label: 'Email' },
    { key: 'email_nota', label: 'Email Nota Fiscal' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'nome_responsavel', label: 'Nome do Responsável' },
    { key: 'endereco_cep', label: 'CEP' },
    { key: 'endereco_rua', label: 'Rua/Logradouro' },
    { key: 'endereco_numero', label: 'Número' },
    { key: 'endereco_complemento', label: 'Complemento' },
    { key: 'endereco_bairro', label: 'Bairro' },
    { key: 'endereco_cidade', label: 'Cidade' },
    { key: 'endereco_estado', label: 'Estado/UF' },
    { key: 'ultima_compra', label: 'Data Última Compra' },
    { key: 'valor_ultima_compra', label: 'Valor Última Compra' },
    { key: 'total_compras_historico', label: 'Total Histórico de Compras' },
    { key: 'observacoes', label: 'Observações' },
    { key: 'vendedor_email', label: 'Email do Vendedor' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        if (jsonData.length === 0) {
          toast.error('Arquivo vazio ou formato inválido');
          return;
        }

        const columns = Object.keys(jsonData[0] as object);
        setSheetColumns(columns);
        setSheetData(jsonData);

        // Auto-map columns
        const autoMapping: ColumnMapping = {};
        columns.forEach(col => {
          const colLower = col.toLowerCase().trim();
          if (colLower.includes('igreja') || colLower.includes('razao') || colLower.includes('nome')) {
            if (!autoMapping['nome_igreja']) autoMapping['nome_igreja'] = col;
          }
          if (colLower === 'cnpj' || colLower.includes('cnpj')) autoMapping['cnpj'] = col;
          if (colLower === 'email' && !colLower.includes('nota')) autoMapping['email'] = col;
          if (colLower.includes('email') && colLower.includes('nota')) autoMapping['email_nota'] = col;
          if (colLower.includes('telefone') || colLower.includes('celular') || colLower.includes('fone')) {
            if (!autoMapping['telefone']) autoMapping['telefone'] = col;
          }
          if (colLower.includes('responsavel') || colLower.includes('contato')) {
            if (!autoMapping['nome_responsavel']) autoMapping['nome_responsavel'] = col;
          }
          if (colLower === 'cep' || colLower.includes('cep')) autoMapping['endereco_cep'] = col;
          if (colLower.includes('rua') || colLower.includes('endereco') || colLower.includes('logradouro')) {
            if (!autoMapping['endereco_rua']) autoMapping['endereco_rua'] = col;
          }
          if (colLower === 'numero' || colLower === 'nº' || colLower === 'num') autoMapping['endereco_numero'] = col;
          if (colLower.includes('complemento')) autoMapping['endereco_complemento'] = col;
          if (colLower.includes('bairro')) autoMapping['endereco_bairro'] = col;
          if (colLower.includes('cidade') || colLower.includes('municipio')) autoMapping['endereco_cidade'] = col;
          if (colLower === 'uf' || colLower === 'estado' || colLower.includes('estado')) autoMapping['endereco_estado'] = col;
          if (colLower.includes('vendedor')) autoMapping['vendedor_email'] = col;
          if (colLower.includes('ultima') && colLower.includes('compra') && colLower.includes('data')) autoMapping['ultima_compra'] = col;
          if (colLower.includes('valor') && colLower.includes('ultima')) autoMapping['valor_ultima_compra'] = col;
          if (colLower.includes('total') && colLower.includes('historico')) autoMapping['total_compras_historico'] = col;
          if (colLower.includes('obs')) autoMapping['observacoes'] = col;
        });
        setColumnMapping(autoMapping);

        toast.success(`Arquivo carregado: ${jsonData.length} registros encontrados`);
        setStep('mapping');
      } catch (error) {
        toast.error('Erro ao ler arquivo. Verifique o formato.');
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const parseDate = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === 'number') {
      // Excel serial date
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return null;
  };

  const parseNumber = (value: any): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) : value;
    return isNaN(num) ? null : num;
  };

  const handleImport = async () => {
    if (!columnMapping['nome_igreja']) {
      toast.error('O campo "Nome da Igreja" é obrigatório');
      return;
    }

    setStep('importing');
    setImportProgress(0);
    const results = { success: 0, errors: 0, messages: [] as string[] };

    // Create vendedor email map
    const vendedorMap = new Map(vendedores.map(v => [v.email.toLowerCase(), v.id]));

    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i];
      setImportProgress(Math.round(((i + 1) / sheetData.length) * 100));

      try {
        const nomeIgreja = row[columnMapping['nome_igreja']]?.toString().trim();
        if (!nomeIgreja) {
          results.errors++;
          results.messages.push(`Linha ${i + 2}: Nome da igreja vazio`);
          continue;
        }

        // Find vendedor by email
        let vendedorId: string | null = null;
        const vendedorEmail = row[columnMapping['vendedor_email']]?.toString().trim().toLowerCase();
        if (vendedorEmail && vendedorMap.has(vendedorEmail)) {
          vendedorId = vendedorMap.get(vendedorEmail) || null;
        }

        const leadData = {
          nome_igreja: nomeIgreja,
          cnpj: row[columnMapping['cnpj']]?.toString().trim() || null,
          email: row[columnMapping['email']]?.toString().trim() || null,
          email_nota: row[columnMapping['email_nota']]?.toString().trim() || null,
          telefone: row[columnMapping['telefone']]?.toString().trim() || null,
          nome_responsavel: row[columnMapping['nome_responsavel']]?.toString().trim() || null,
          endereco_cep: row[columnMapping['endereco_cep']]?.toString().trim() || null,
          endereco_rua: row[columnMapping['endereco_rua']]?.toString().trim() || null,
          endereco_numero: row[columnMapping['endereco_numero']]?.toString().trim() || null,
          endereco_complemento: row[columnMapping['endereco_complemento']]?.toString().trim() || null,
          endereco_bairro: row[columnMapping['endereco_bairro']]?.toString().trim() || null,
          endereco_cidade: row[columnMapping['endereco_cidade']]?.toString().trim() || null,
          endereco_estado: row[columnMapping['endereco_estado']]?.toString().trim() || null,
          ultima_compra: parseDate(row[columnMapping['ultima_compra']]),
          valor_ultima_compra: parseNumber(row[columnMapping['valor_ultima_compra']]),
          total_compras_historico: parseNumber(row[columnMapping['total_compras_historico']]),
          observacoes: row[columnMapping['observacoes']]?.toString().trim() || null,
          vendedor_id: vendedorId,
          status_lead: 'Não Contatado',
          lead_score: 'Frio',
        };

        const { error } = await supabase.from('ebd_leads_reativacao').insert(leadData);
        if (error) {
          results.errors++;
          results.messages.push(`Linha ${i + 2}: ${error.message}`);
        } else {
          results.success++;
        }
      } catch (err: any) {
        results.errors++;
        results.messages.push(`Linha ${i + 2}: ${err.message || 'Erro desconhecido'}`);
      }
    }

    setImportResult(results);
    setStep('result');
    onImportComplete();
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setSheetData([]);
    setSheetColumns([]);
    setColumnMapping({});
    setImportProgress(0);
    setImportResult({ success: 0, errors: 0, messages: [] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Leads de Reativação
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Arraste um arquivo CSV ou Excel, ou clique para selecionar
              </p>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="max-w-xs mx-auto"
              />
            </div>
            <div className="bg-muted p-4 rounded-lg text-sm">
              <p className="font-medium mb-2">Formato esperado:</p>
              <p className="text-muted-foreground">
                O arquivo deve conter pelo menos a coluna "Nome da Igreja". Outras colunas serão mapeadas automaticamente.
              </p>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Mapeie as colunas do seu arquivo para os campos do sistema. 
              <span className="font-medium"> Encontrados: {sheetData.length} registros.</span>
            </p>

            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
              {systemFields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <Label className="w-48 text-sm shrink-0">
                    {field.label}
                  </Label>
                  <Select
                    value={columnMapping[field.key] || 'none'}
                    onValueChange={(value) => {
                      setColumnMapping(prev => ({
                        ...prev,
                        [field.key]: value === 'none' ? '' : value
                      }));
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Não mapear --</SelectItem>
                      {sheetColumns.map((col) => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
              <Button onClick={handleImport}>Iniciar Importação</Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <p className="text-lg font-medium mb-4">Importando leads...</p>
              <Progress value={importProgress} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">{importProgress}% concluído</p>
            </div>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-center">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-700">{importResult.success}</p>
                <p className="text-sm text-green-600">Importados com sucesso</p>
              </div>
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-center">
                <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-700">{importResult.errors}</p>
                <p className="text-sm text-red-600">Erros</p>
              </div>
            </div>

            {importResult.messages.length > 0 && (
              <div className="bg-muted p-4 rounded-lg max-h-[200px] overflow-y-auto">
                <p className="font-medium mb-2">Detalhes dos erros:</p>
                <ul className="text-sm space-y-1">
                  {importResult.messages.slice(0, 50).map((msg, i) => (
                    <li key={i} className="text-destructive">{msg}</li>
                  ))}
                  {importResult.messages.length > 50 && (
                    <li className="text-muted-foreground">... e mais {importResult.messages.length - 50} erros</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
