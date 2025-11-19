import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Video } from 'lucide-react';
import { useStageInfo } from '@/hooks/useStageInfo';
import { Skeleton } from '@/components/ui/skeleton';

const stages = [
  { id: 1, name: 'CONTRATAÇÃO' },
  { id: 2, name: 'CERTIFICADO DIGITAL' },
  { id: 3, name: 'VIABILIDADE' },
  { id: 4, name: 'ELABORAÇÃO DOCUMENTOS' },
  { id: 5, name: 'REGISTRO DOCUMENTOS' },
  { id: 6, name: 'PEDIDO CNPJ' },
];

const StageManagement = () => {
  const { stageInfos, loading, getStageInfo, updateStageInfo } = useStageInfo();
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [formData, setFormData] = useState({ infoText: '', videoUrl: '' });
  const [saving, setSaving] = useState(false);

  const handleEdit = (stageId: number) => {
    const info = getStageInfo(stageId);
    setEditingStage(stageId);
    setFormData({
      infoText: info?.info_text || '',
      videoUrl: info?.video_url || '',
    });
  };

  const handleSave = async (stageId: number) => {
    setSaving(true);
    const success = await updateStageInfo(stageId, formData.infoText, formData.videoUrl);
    if (success) {
      setEditingStage(null);
      setFormData({ infoText: '', videoUrl: '' });
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setEditingStage(null);
    setFormData({ infoText: '', videoUrl: '' });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Etapas</h1>
          <p className="text-muted-foreground">
            Configure as descrições e vídeos de cada etapa do processo
          </p>
        </div>
        
        <div className="grid gap-6">
          {stages.map((stage) => (
            <Skeleton key={stage.id} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gerenciar Etapas</h1>
        <p className="text-muted-foreground">
          Configure as descrições e vídeos de cada etapa do processo
        </p>
      </div>

      <div className="grid gap-6">
        {stages.map((stage) => {
          const info = getStageInfo(stage.id);
          const isEditing = editingStage === stage.id;

          return (
            <Card key={stage.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Etapa {stage.id}: {stage.name}</span>
                  {!isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(stage.id)}
                    >
                      Editar
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  Configure as informações exibidas aos clientes
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor={`info-${stage.id}`}>Descrição</Label>
                      <Textarea
                        id={`info-${stage.id}`}
                        placeholder="Digite a descrição desta etapa..."
                        value={formData.infoText}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, infoText: e.target.value }))
                        }
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`video-${stage.id}`} className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        URL do Vídeo (Embed)
                      </Label>
                      <Input
                        id={`video-${stage.id}`}
                        type="url"
                        placeholder="https://www.youtube.com/embed/..."
                        value={formData.videoUrl}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, videoUrl: e.target.value }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Cole a URL de embed do YouTube, Vimeo ou outro serviço
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleSave(stage.id)}
                        disabled={saving || !formData.infoText}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Salvar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancel}
                        disabled={saving}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label className="text-sm font-semibold">Descrição</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {info?.info_text || 'Nenhuma descrição configurada'}
                      </p>
                    </div>

                    {info?.video_url && (
                      <div>
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Video className="h-4 w-4" />
                          Vídeo
                        </Label>
                        <div className="mt-2 aspect-video w-full max-w-md rounded-lg overflow-hidden bg-muted">
                          <iframe
                            src={info.video_url}
                            title={`Preview: ${stage.name}`}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default StageManagement;
