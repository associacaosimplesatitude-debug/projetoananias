import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface DocumentsListProps {
  churchId: string;
  stageId: number;
  subTaskId: string;
}

export const DocumentsList = ({ churchId, stageId, subTaskId }: DocumentsListProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, [churchId, stageId, subTaskId]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('church_documents')
        .select('*')
        .eq('church_id', churchId)
        .eq('stage_id', stageId)
        .eq('sub_task_id', subTaskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('church-documents')
        .download(doc.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = doc.file_name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Sucesso',
        description: 'Download iniciado',
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao baixar documento',
        variant: 'destructive',
      });
    }
  };

  const handleView = async (doc: Document) => {
    try {
      const { data } = await supabase.storage
        .from('church-documents')
        .createSignedUrl(doc.file_path, 60);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('View error:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao visualizar documento',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Carregando documentos...
      </div>
    );
  }

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mt-3">
      <p className="text-xs font-medium text-muted-foreground">Documentos enviados:</p>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between gap-2 p-2 rounded border border-border/50 bg-background/50"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{doc.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(doc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => handleView(doc)}
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => handleDownload(doc)}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
