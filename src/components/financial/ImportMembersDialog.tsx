import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Member } from '@/types/financial';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface ImportMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  onImportComplete: () => void;
  memberTerm: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

interface ColumnMapping {
  [excelColumn: string]: string; // excelColumn -> systemField
}

type ImportStep = 'upload' | 'mapping' | 'result';

export const ImportMembersDialog = ({
  open,
  onOpenChange,
  churchId,
  onImportComplete,
  memberTerm,
}: ImportMembersDialogProps) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<ImportStep>('upload');
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [sheetColumns, setSheetColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});

  // Available system fields
  const systemFields = [
    { value: 'ignore', label: 'Ignorar esta coluna' },
    { value: 'avatar_url', label: 'Foto de Perfil (URL)' },
    { value: 'nome_completo', label: 'Nome Completo' },
    { value: 'cep', label: 'CEP' },
    { value: 'rua', label: 'Rua' },
    { value: 'numero', label: 'Número' },
    { value: 'complemento', label: 'Complemento' },
    { value: 'bairro', label: 'Bairro' },
    { value: 'cidade', label: 'Cidade' },
    { value: 'estado', label: 'Estado' },
    { value: 'data_aniversario', label: 'Data de Aniversário' },
    { value: 'sexo', label: 'Sexo' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'email', label: 'E-mail' },
    { value: 'estado_civil', label: 'Estado Civil' },
    { value: 'cargo', label: 'Cargo' },
    { value: 'endereco', label: 'Endereço Completo' },
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      if (validTypes.includes(selectedFile.type) || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setResult(null);
        
        // Parse the file to get columns
        try {
          const data = await selectedFile.arrayBuffer();
          const workbook = XLSX.read(data);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          if (jsonData.length > 0) {
            const columns = Object.keys(jsonData[0]);
            setSheetColumns(columns);
            setSheetData(jsonData);
            
            // Smart initial mapping based on common names
            const initialMapping: ColumnMapping = {};
            columns.forEach(col => {
              const colLower = col.toLowerCase();
              if (colLower.includes('membro') || colLower.includes('nome')) {
                initialMapping[col] = 'nome_completo';
              } else if (colLower.includes('cargo')) {
                initialMapping[col] = 'cargo';
              } else if (colLower.includes('sexo')) {
                initialMapping[col] = 'sexo';
              } else if (colLower.includes('estado civil') || colLower.includes('civil')) {
                initialMapping[col] = 'estado_civil';
              } else if (colLower.includes('nascimento') || colLower.includes('aniversário') || colLower.includes('data')) {
                initialMapping[col] = 'data_aniversario';
              } else if (colLower.includes('foto') || colLower.includes('avatar') || colLower.includes('imagem')) {
                initialMapping[col] = 'avatar_url';
              } else if (colLower.includes('whatsapp') || colLower.includes('telefone') || colLower.includes('celular')) {
                initialMapping[col] = 'whatsapp';
              } else if (colLower.includes('email') || colLower.includes('e-mail')) {
                initialMapping[col] = 'email';
              } else if (colLower.includes('endereço') || colLower.includes('endereco')) {
                initialMapping[col] = 'endereco';
              } else if (colLower.includes('rua')) {
                initialMapping[col] = 'rua';
              } else if (colLower.includes('número') || colLower.includes('numero')) {
                initialMapping[col] = 'numero';
              } else if (colLower.includes('bairro')) {
                initialMapping[col] = 'bairro';
              } else if (colLower.includes('cidade')) {
                initialMapping[col] = 'cidade';
              } else if (colLower.includes('estado') && !colLower.includes('civil')) {
                initialMapping[col] = 'estado';
              } else if (colLower.includes('cep')) {
                initialMapping[col] = 'cep';
              } else if (colLower.includes('complemento')) {
                initialMapping[col] = 'complemento';
              } else {
                initialMapping[col] = 'ignore';
              }
            });
            setColumnMapping(initialMapping);
          }
        } catch (error) {
          console.error('Error parsing file:', error);
          toast({
            title: 'Erro ao ler arquivo',
            description: 'Não foi possível processar o arquivo selecionado',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Formato inválido',
          description: 'Por favor, envie um arquivo CSV ou Excel (.xlsx, .xls)',
          variant: 'destructive',
        });
      }
    }
  };

  const handleProceedToMapping = () => {
    if (!file || sheetColumns.length === 0) {
      toast({
        title: 'Erro',
        description: 'Nenhum dado encontrado no arquivo',
        variant: 'destructive',
      });
      return;
    }
    setStep('mapping');
  };

  const downloadImageFromUrl = async (url: string, memberId: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      const fileExt = url.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `${memberId}-${Date.now()}.${fileExt}`;
      const filePath = `${churchId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error downloading image:', error);
      return null;
    }
  };

  const parseDate = (dateStr: string): string => {
    if (!dateStr) return '';
    
    try {
      // Try various date formats
      const str = String(dateStr).trim();
      
      // Check if it's already in ISO format (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
      }
      
      // Try DD/MM/YYYY
      const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // Try MM/DD/YYYY
      const mmddyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (mmddyyyyMatch) {
        const [, month, day, year] = mmddyyyyMatch;
        // Check if day > 12, then it's DD/MM/YYYY
        if (parseInt(day) > 12) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // Try Excel serial date (number)
      if (!isNaN(Number(str))) {
        const excelDate = new Date((Number(str) - 25569) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) {
          return excelDate.toISOString().split('T')[0];
        }
      }
      
      // Try standard Date parsing
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
      
      return '';
    } catch (error) {
      console.error('Error parsing date:', dateStr, error);
      return '';
    }
  };

  const parseAddress = (address: string) => {
    if (!address) return {
      rua: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      complemento: '',
    };
    
    const result = {
      rua: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      complemento: '',
    };
    
    try {
      // Extract CEP (formato XXXXX-XXX)
      const cepMatch = address.match(/\d{5}-?\d{3}/);
      if (cepMatch) {
        result.cep = cepMatch[0].replace(/(\d{5})(\d{3})/, '$1-$2');
      }
      
      // Extract Estado (sigla de 2 letras maiúsculas)
      const estadoMatch = address.match(/\b([A-Z]{2})\b/);
      if (estadoMatch) {
        result.estado = estadoMatch[1];
      }
      
      // Extract Número (após vírgula, antes de hífen ou próxima vírgula)
      const numeroMatch = address.match(/,\s*(\d+)/);
      if (numeroMatch) {
        result.numero = numeroMatch[1];
      }
      
      // Extract Rua (tudo antes da primeira vírgula)
      const ruaMatch = address.match(/^([^,]+)/);
      if (ruaMatch) {
        result.rua = ruaMatch[1].trim();
      }
      
      // Extract Bairro (depois de hífen e antes da próxima vírgula)
      const bairroMatch = address.match(/-\s*([^,]+),/);
      if (bairroMatch) {
        result.bairro = bairroMatch[1].trim();
      }
      
      // Extract Cidade (depois do bairro e antes do estado ou hífen)
      const cidadeMatch = address.match(/,\s*([^,-]+)\s*[-,]\s*[A-Z]{2}/);
      if (cidadeMatch) {
        result.cidade = cidadeMatch[1].trim();
      }
    } catch (error) {
      console.error('Error parsing address:', error);
    }
    
    return result;
  };

  const mapRowDataToMember = async (row: any) => {
    const memberData: any = {
      church_id: churchId,
      cargo: 'Membro',
      sexo: 'Masculino',
      data_aniversario: '',
      whatsapp: '',
      nome_completo: '',
      rua: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
    };

    // Apply user's column mapping
    for (const [excelCol, systemField] of Object.entries(columnMapping)) {
      if (systemField === 'ignore' || !row[excelCol]) continue;

      const value = row[excelCol];

      if (systemField === 'data_aniversario') {
        memberData[systemField] = parseDate(value);
      } else if (systemField === 'avatar_url') {
        // Download image from URL
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const downloadedUrl = await downloadImageFromUrl(value, tempId);
        if (downloadedUrl) {
          memberData[systemField] = downloadedUrl;
        }
      } else if (systemField === 'endereco') {
        // Parse full address
        const addressData = parseAddress(value);
        Object.assign(memberData, addressData);
      } else {
        memberData[systemField] = value;
      }
    }

    return memberData;
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('result');
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;

    try {
      for (let i = 0; i < sheetData.length; i++) {
        try {
          const row = sheetData[i];
          const memberData = await mapRowDataToMember(row);

          // Validate required fields
          if (!memberData.nome_completo) {
            throw new Error('Nome completo é obrigatório');
          }
          if (!memberData.data_aniversario) {
            throw new Error('Data de nascimento é obrigatória');
          }
          if (!memberData.whatsapp) {
            throw new Error('WhatsApp é obrigatório');
          }

          const { error } = await supabase
            .from('church_members')
            .insert(memberData);

          if (error) {
            throw error;
          }

          successCount++;
        } catch (error: any) {
          failedCount++;
          errors.push(`Linha ${i + 2}: ${error.message}`);
        }
      }

      setResult({ success: successCount, failed: failedCount, errors });

      if (successCount > 0) {
        toast({
          title: 'Importação concluída!',
          description: `${successCount} ${memberTerm.toLowerCase()}(s) importado(s) com sucesso${
            failedCount > 0 ? `, ${failedCount} falha(s)` : ''
          }`,
        });
        onImportComplete();
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: 'Erro na importação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setStep('upload');
    setSheetData([]);
    setSheetColumns([]);
    setColumnMapping({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Importar {memberTerm}s da Planilha
            {step === 'mapping' && ' - Etapa 2: Mapeamento de Colunas'}
            {step === 'result' && ' - Etapa 3: Resultado'}
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  {file ? (
                    <>
                      <FileSpreadsheet className="h-12 w-12 text-primary" />
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sheetData.length} linha(s) encontrada(s)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Clique para selecionar outro arquivo
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        Clique para selecionar um arquivo
                      </p>
                      <p className="text-xs text-muted-foreground">
                        CSV ou Excel (.xlsx, .xls)
                      </p>
                    </>
                  )}
                </label>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="text-sm font-semibold mb-2">Sobre a importação:</h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Envie uma planilha CSV ou Excel com os dados dos {memberTerm.toLowerCase()}s</li>
                  <li>• Na próxima etapa, você poderá mapear as colunas da sua planilha</li>
                  <li>• O sistema aceita diversos formatos de data</li>
                  <li>• Fotos de perfil serão baixadas automaticamente se você fornecer URLs</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleProceedToMapping} disabled={!file || sheetColumns.length === 0}>
                Próximo: Mapear Colunas
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Mapping */}
        {step === 'mapping' && (
          <div className="space-y-6">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="text-sm font-semibold mb-2">Mapeie as colunas da sua planilha:</h4>
              <p className="text-xs text-muted-foreground">
                Para cada coluna encontrada na planilha, selecione o campo correspondente do sistema.
                O mapeamento inicial é feito automaticamente, mas você pode ajustá-lo.
              </p>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {sheetColumns.map((column) => (
                <div key={column} className="flex items-center gap-4 p-3 bg-background border rounded-lg">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">{column}</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Exemplo: {String(sheetData[0]?.[column] || '').substring(0, 50)}
                      {String(sheetData[0]?.[column] || '').length > 50 ? '...' : ''}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="w-64 flex-shrink-0">
                    <Select
                      value={columnMapping[column] || 'ignore'}
                      onValueChange={(value) => {
                        setColumnMapping((prev) => ({
                          ...prev,
                          [column]: value,
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {systemFields.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    Importar {sheetData.length} linha(s)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Result */}
        {step === 'result' && result && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium">{result.success} importados com sucesso</span>
              </div>
              {result.failed > 0 && (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="font-medium">{result.failed} falhas</span>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="max-h-64 overflow-y-auto bg-destructive/10 p-3 rounded text-xs space-y-1">
                      {result.errors.map((error, idx) => (
                        <div key={idx} className="text-destructive">
                          {error}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
