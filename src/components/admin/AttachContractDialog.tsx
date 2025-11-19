import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AttachContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  stageId: number;
  subTaskId: string;
  subTaskName: string;
}

export const AttachContractDialog = ({
  open,
  onOpenChange,
  churchId,
  stageId,
  subTaskId,
  subTaskName,
}: AttachContractDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Apenas arquivos PDF são permitidos');
        return;
      }
      if (selectedFile.size > 20 * 1024 * 1024) { // 20MB
        toast.error('O arquivo deve ter no máximo 20MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Selecione um arquivo PDF');
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Create unique file path
      const fileExt = 'pdf';
      const fileName = `${churchId}/${stageId}/${subTaskId}/${Date.now()}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('church-documents')
        .upload(fileName, file, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Save document metadata to database
      const { error: dbError } = await supabase
        .from('church_documents')
        .insert({
          church_id: churchId,
          stage_id: stageId,
          sub_task_id: subTaskId,
          document_type: 'contract',
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          mime_type: 'application/pdf',
          uploaded_by: user.id,
        });

      if (dbError) {
        throw dbError;
      }

      toast.success('Contrato anexado com sucesso!');
      setFile(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Error uploading contract:', error);
      toast.error('Erro ao anexar contrato');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anexar Contrato</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contract-file">Arquivo do Contrato (PDF)</Label>
            <Input
              id="contract-file"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={uploading}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Arquivo selecionado: {file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Anexar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
