import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Member } from '@/types/financial';

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      } else {
        toast({
          title: 'Formato inválido',
          description: 'Por favor, envie um arquivo CSV ou Excel (.xlsx, .xls)',
          variant: 'destructive',
        });
      }
    }
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

  const parseAddress = (address: string) => {
    // Simple address parsing - can be improved based on actual format
    const parts = address.split(',').map(p => p.trim());
    return {
      rua: parts[0] || '',
      numero: parts[1] || '',
      bairro: parts[2] || '',
      cidade: parts[3] || '',
      estado: parts[4] || '',
      cep: '',
      complemento: '',
    };
  };

  const mapMondayDataToMember = async (row: any) => {
    const addressData = row['Endereço'] ? parseAddress(row['Endereço']) : {
      rua: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      complemento: '',
    };

    let avatarUrl: string | undefined = undefined;
    if (row['Foto']) {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      avatarUrl = await downloadImageFromUrl(row['Foto'], tempId) || undefined;
    }

    // Parse date in various formats
    let dataAniversario = '';
    if (row['Nascimento']) {
      const dateStr = row['Nascimento'];
      // Try to parse date (handles DD/MM/YYYY, YYYY-MM-DD, etc.)
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        dataAniversario = date.toISOString().split('T')[0];
      }
    }

    return {
      nome_completo: row['Membros'] || '',
      cargo: row['Cargo'] || 'Membro',
      sexo: row['Sexo'] || 'Masculino',
      estado_civil: row['Estado Civil'] || null,
      data_aniversario: dataAniversario,
      whatsapp: row['Whatsapp'] || '',
      email: row['E-mail'] || null,
      avatar_url: avatarUrl || null,
      ...addressData,
      church_id: churchId,
    };
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: 'Nenhum arquivo selecionado',
        description: 'Por favor, selecione um arquivo para importar',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      for (let i = 0; i < jsonData.length; i++) {
        try {
          const row = jsonData[i];
          const memberData = await mapMondayDataToMember(row);

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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar {memberTerm}s da Planilha</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={importing}
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
              <h4 className="text-sm font-semibold mb-2">Formato esperado (Monday.com):</h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Coluna "Membros" → Nome Completo</li>
                <li>• Coluna "Cargo" → Cargo</li>
                <li>• Coluna "Sexo" → Sexo</li>
                <li>• Coluna "Estado Civil" → Estado Civil</li>
                <li>• Coluna "Nascimento" → Data de Nascimento</li>
                <li>• Coluna "Foto" → URL da Foto de Perfil</li>
                <li>• Coluna "Whatsapp" → Telefone</li>
                <li>• Coluna "E-mail" → Email</li>
                <li>• Coluna "Endereço" → Endereço Completo</li>
              </ul>
            </div>
          </div>

          {result && (
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
                    <div className="max-h-32 overflow-y-auto bg-destructive/10 p-3 rounded text-xs space-y-1">
                      {result.errors.slice(0, 10).map((error, idx) => (
                        <div key={idx} className="text-destructive">
                          {error}
                        </div>
                      ))}
                      {result.errors.length > 10 && (
                        <div className="text-muted-foreground italic">
                          ... e mais {result.errors.length - 10} erro(s)
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={importing}>
              {result ? 'Fechar' : 'Cancelar'}
            </Button>
            {!result && (
              <Button onClick={handleImport} disabled={!file || importing}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
