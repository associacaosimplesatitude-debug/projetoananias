import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: string;
  stageId: number;
  subTaskId: string;
  churchId: string;
  onUploadSuccess: () => void;
  allowMultiple?: boolean;
}

export const FileUploadDialog = ({
  open,
  onOpenChange,
  documentType,
  stageId,
  subTaskId,
  churchId,
  onUploadSuccess,
  allowMultiple = false,
}: FileUploadDialogProps) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const invalidFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      toast({
        title: 'Erro',
        description: 'Cada arquivo deve ter no máximo 5MB',
        variant: 'destructive',
      });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    const invalidTypes = files.filter(file => !allowedTypes.includes(file.type));
    if (invalidTypes.length > 0) {
      toast({
        title: 'Erro',
        description: 'Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou PDF',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFiles(allowMultiple ? files : [files[0]]);

    const newPreviews: string[] = [];
    files.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews[index] = reader.result as string;
          if (newPreviews.filter(p => p).length === files.filter(f => f.type.startsWith('image/')).length) {
            setPreviews(newPreviews);
          }
        };
        reader.readAsDataURL(file);
      }
    });
    
    if (files.every(f => !f.type.startsWith('image/'))) {
      setPreviews([]);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !churchId) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      for (const file of selectedFiles) {
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `${churchId}/${stageId}/${subTaskId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('church-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('church_documents')
          .insert({
            church_id: churchId,
            stage_id: stageId,
            sub_task_id: subTaskId,
            document_type: documentType,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: user.id,
          });

        if (dbError) throw dbError;
      }

      toast({
        title: 'Sucesso!',
        description: `${selectedFiles.length} documento(s) enviado(s) com sucesso`,
      });

      onUploadSuccess();
      handleClose();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao enviar documento(s). Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setPreviews([]);
    onOpenChange(false);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar {documentType}</DialogTitle>
          <DialogDescription>
            {allowMultiple 
              ? 'Selecione um ou mais arquivos (JPG, PNG, WEBP ou PDF) de até 5MB cada'
              : 'Selecione um arquivo (JPG, PNG, WEBP ou PDF) de até 5MB'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {selectedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4">
              <label
                htmlFor="file-upload"
                className={cn(
                  'flex flex-col items-center justify-center w-full h-48',
                  'border-2 border-dashed rounded-lg cursor-pointer',
                  'border-border hover:border-primary transition-colors',
                  'bg-background hover:bg-accent/50'
                )}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="h-10 w-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Clique para selecionar</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, WEBP ou PDF (máx. 5MB{allowMultiple ? ' cada' : ''})
                  </p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/jpg,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  multiple={allowMultiple}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index}>
                    {file.type.startsWith('image/') && previews[index] ? (
                      <div className="relative">
                        <img
                          src={previews[index]}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-48 object-contain rounded-lg border border-border"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-4 border rounded-lg">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleClose}
                  disabled={uploading}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? 'Enviando...' : `Enviar ${selectedFiles.length > 1 ? `${selectedFiles.length} arquivos` : 'arquivo'}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
