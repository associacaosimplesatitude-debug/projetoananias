import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAssinaturas, useUpdateAssinatura, useCreateAssinaturas, useDeleteAssinatura } from '@/hooks/useAssinaturas';
import { useModulos } from '@/hooks/useModulos';
import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function ClientModules() {
  const { clientId } = useParams();
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [selectedNewModules, setSelectedNewModules] = useState<string[]>([]);
  
  const { data: assinaturas, isLoading: assinaturasLoading } = useAssinaturas(clientId);
  const { data: modulos, isLoading: modulosLoading } = useModulos();
  const updateAssinatura = useUpdateAssinatura();
  const createAssinaturas = useCreateAssinaturas();
  const deleteAssinatura = useDeleteAssinatura();

  const handleToggleStatus = async (assinaturaId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Ativo' ? 'Inativo' : 'Ativo';
    await updateAssinatura.mutateAsync({ id: assinaturaId, status: newStatus });
  };

  const handleAddModules = async () => {
    if (!clientId || selectedNewModules.length === 0) return;
    
    await createAssinaturas.mutateAsync({
      clienteId: clientId,
      moduloIds: selectedNewModules,
    });
    
    setSelectedNewModules([]);
    setAddModuleOpen(false);
  };

  const availableModules = modulos?.filter(
    modulo => !assinaturas?.some(ass => ass.modulo_id === modulo.id)
  );

  if (assinaturasLoading || modulosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Módulos do Cliente</h1>
        {availableModules && availableModules.length > 0 && (
          <Dialog open={addModuleOpen} onOpenChange={setAddModuleOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Módulo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Módulos</DialogTitle>
                <DialogDescription>
                  Selecione os módulos que deseja ativar para este cliente
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                {availableModules.map((modulo) => (
                  <div key={modulo.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={modulo.id}
                      checked={selectedNewModules.includes(modulo.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedNewModules([...selectedNewModules, modulo.id]);
                        } else {
                          setSelectedNewModules(selectedNewModules.filter(id => id !== modulo.id));
                        }
                      }}
                    />
                    <Label htmlFor={modulo.id} className="font-normal cursor-pointer">
                      {modulo.nome_modulo}
                      {modulo.descricao && (
                        <span className="text-sm text-muted-foreground ml-2">
                          - {modulo.descricao}
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddModuleOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddModules} disabled={selectedNewModules.length === 0}>
                  Adicionar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4">
        {assinaturas && assinaturas.length > 0 ? (
          assinaturas.map((assinatura: any) => (
            <Card key={assinatura.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {assinatura.modulos?.nome_modulo || 'Módulo Desconhecido'}
                    </CardTitle>
                    {assinatura.modulos?.descricao && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {assinatura.modulos.descricao}
                      </p>
                    )}
                  </div>
                  <Badge variant={assinatura.status === 'Ativo' ? 'default' : 'secondary'}>
                    {assinatura.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Ativado em: {new Date(assinatura.data_ativacao).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`toggle-${assinatura.id}`}>
                        {assinatura.status === 'Ativo' ? 'Desativar' : 'Ativar'}
                      </Label>
                      <Switch
                        id={`toggle-${assinatura.id}`}
                        checked={assinatura.status === 'Ativo'}
                        onCheckedChange={() => handleToggleStatus(assinatura.id, assinatura.status)}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteAssinatura.mutate(assinatura.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhum módulo ativado para este cliente
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
