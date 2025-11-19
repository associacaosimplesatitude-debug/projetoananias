import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ViewDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  stageId: number;
  subTaskId: string;
  subTaskName: string;
}

export const ViewDataDialog = ({
  open,
  onOpenChange,
  churchId,
  stageId,
  subTaskId,
  subTaskName,
}: ViewDataDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && churchId) {
      fetchData();
    }
  }, [open, churchId, stageId, subTaskId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // For president data (1-1) or board data (4-1), fetch from board_members
      if (subTaskId === '1-1' || subTaskId === '4-1') {
        const { data: boardData, error } = await supabase
          .from('board_members')
          .select('*')
          .eq('church_id', churchId);

        if (error) throw error;
        setData(boardData);
      } 
      // For uploaded documents
      else {
        const { data: documents, error } = await supabase
          .from('church_documents')
          .select('*')
          .eq('church_id', churchId)
          .eq('stage_id', stageId)
          .eq('sub_task_id', subTaskId);

        if (error) throw error;
        setData(documents);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum dado encontrado
        </div>
      );
    }

    // Render board members
    if (subTaskId === '1-1' || subTaskId === '4-1') {
      return (
        <div className="space-y-4">
          {data.map((member: any, index: number) => (
            <div key={member.id} className="border rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-lg">{member.cargo}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">Nome:</span> {member.nome_completo}
                </div>
                <div>
                  <span className="font-medium">CPF:</span> {member.cpf}
                </div>
                <div>
                  <span className="font-medium">RG:</span> {member.rg}
                </div>
                <div>
                  <span className="font-medium">Órgão Emissor:</span> {member.orgao_emissor}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Endereço:</span> {member.endereco}
                </div>
                <div>
                  <span className="font-medium">CEP:</span> {member.cep}
                </div>
                <div>
                  <span className="font-medium">Estado Civil:</span> {member.estado_civil}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Profissão:</span> {member.profissao}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Render documents
    return (
      <div className="space-y-3">
        {data.map((doc: any) => (
          <div key={doc.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{doc.file_name}</span>
              <span className="text-sm text-muted-foreground">
                {(doc.file_size / 1024).toFixed(2)} KB
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Enviado em: {new Date(doc.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dados Enviados - {subTaskName}</DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};
