import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useChurchData } from '@/hooks/useChurchData';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Users, HelpCircle, Trophy, Clock, Loader2, Gamepad2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { CriarDesafioDialog } from '@/components/ebd/desafio/CriarDesafioDialog';
import { MontarEquipesDialog } from '@/components/ebd/desafio/MontarEquipesDialog';
import { CadastrarPerguntasDialog } from '@/components/ebd/desafio/CadastrarPerguntasDialog';

type DesafioStatus = 'CONFIGURANDO' | 'PRONTO' | 'EM_ANDAMENTO' | 'FINALIZADO';

interface Desafio {
  id: string;
  nome: string;
  tipo_publico: 'PROFESSORES' | 'ALUNOS';
  tempo_limite_minutos: number;
  num_perguntas_desbloqueio: number;
  num_blocos_charada: number;
  status: DesafioStatus;
  iniciado_em: string | null;
  finalizado_em: string | null;
  created_at: string;
}

export default function DesafioBiblico() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { church: churchData, loading: loadingChurch } = useChurchData();
  const { user } = useAuth();
  
  const [criarDialogOpen, setCriarDialogOpen] = useState(false);
  const [equipesDialogOpen, setEquipesDialogOpen] = useState(false);
  const [perguntasDialogOpen, setPerguntasDialogOpen] = useState(false);
  const [selectedDesafio, setSelectedDesafio] = useState<Desafio | null>(null);

  // Check if current user is a lider in any desafio
  const { data: meusDesafiosComoLider } = useQuery({
    queryKey: ['meus-desafios-lider', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // First get professor id
      const { data: professor } = await supabase
        .from('ebd_professores')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      
      if (!professor) return [];
      
      // Get equipes where user is lider
      const { data: equipes } = await supabase
        .from('desafio_equipe')
        .select('desafio_id')
        .eq('lider_id', professor.id);
      
      if (!equipes || equipes.length === 0) return [];
      
      return equipes.map(e => e.desafio_id);
    },
    enabled: !!user?.id,
  });

  const { data: desafios, isLoading: loadingDesafios } = useQuery({
    queryKey: ['desafios-biblicos', churchData?.id],
    queryFn: async () => {
      if (!churchData?.id) return [];
      const { data, error } = await supabase
        .from('desafio_biblico')
        .select('*')
        .eq('church_id', churchData.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Desafio[];
    },
    enabled: !!churchData?.id,
  });

  const iniciarDesafioMutation = useMutation({
    mutationFn: async (desafioId: string) => {
      const { error } = await supabase
        .from('desafio_biblico')
        .update({ 
          status: 'EM_ANDAMENTO' as DesafioStatus,
          iniciado_em: new Date().toISOString()
        })
        .eq('id', desafioId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['desafios-biblicos'] });
      toast.success('Desafio iniciado!');
    },
    onError: () => {
      toast.error('Erro ao iniciar desafio');
    },
  });

  const getStatusBadge = (status: DesafioStatus) => {
    const variants: Record<DesafioStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      'CONFIGURANDO': { variant: 'secondary', label: 'Configurando' },
      'PRONTO': { variant: 'default', label: 'Pronto' },
      'EM_ANDAMENTO': { variant: 'destructive', label: 'Em Andamento' },
      'FINALIZADO': { variant: 'outline', label: 'Finalizado' },
    };
    return <Badge variant={variants[status].variant}>{variants[status].label}</Badge>;
  };

  const handleConfigEquipes = (desafio: Desafio) => {
    setSelectedDesafio(desafio);
    setEquipesDialogOpen(true);
  };

  const handleConfigPerguntas = (desafio: Desafio) => {
    setSelectedDesafio(desafio);
    setPerguntasDialogOpen(true);
  };

  if (loadingChurch) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-primary" />
            Desafio Bíblico
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure e gerencie desafios bíblicos para professores e alunos
          </p>
        </div>
        <Button onClick={() => setCriarDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Desafio
        </Button>
      </div>

      {loadingDesafios ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : desafios && desafios.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {desafios.map((desafio) => (
            <Card key={desafio.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{desafio.nome}</CardTitle>
                  {getStatusBadge(desafio.status)}
                </div>
                <CardDescription>
                  {desafio.tipo_publico === 'PROFESSORES' ? 'Para Professores' : 'Para Alunos'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {desafio.tempo_limite_minutos} min
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <HelpCircle className="h-4 w-4" />
                    {desafio.num_perguntas_desbloqueio} desbloqueio
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {desafio.status === 'CONFIGURANDO' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConfigEquipes(desafio)}
                      >
                        <Users className="h-4 w-4 mr-1" />
                        Equipes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConfigPerguntas(desafio)}
                      >
                        <HelpCircle className="h-4 w-4 mr-1" />
                        Perguntas
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => iniciarDesafioMutation.mutate(desafio.id)}
                        disabled={iniciarDesafioMutation.isPending}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Iniciar Desafio
                      </Button>
                    </>
                  )}
                  {desafio.status === 'PRONTO' && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => iniciarDesafioMutation.mutate(desafio.id)}
                      disabled={iniciarDesafioMutation.isPending}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Iniciar Desafio
                    </Button>
                  )}
                  {desafio.status === 'EM_ANDAMENTO' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/ebd/desafio-biblico/${desafio.id}/acompanhar`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Acompanhar
                      </Button>
                      {meusDesafiosComoLider?.includes(desafio.id) && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => navigate(`/ebd/desafio-biblico/${desafio.id}/jogar`)}
                        >
                          <Gamepad2 className="h-4 w-4 mr-1" />
                          Jogar
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum desafio criado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie seu primeiro desafio bíblico para engajar professores e alunos
            </p>
            <Button onClick={() => setCriarDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Desafio
            </Button>
          </CardContent>
        </Card>
      )}

      <CriarDesafioDialog
        open={criarDialogOpen}
        onOpenChange={setCriarDialogOpen}
        churchId={churchData?.id || ''}
      />

      {selectedDesafio && (
        <>
          <MontarEquipesDialog
            open={equipesDialogOpen}
            onOpenChange={setEquipesDialogOpen}
            desafio={selectedDesafio}
            churchId={churchData?.id || ''}
          />
          <CadastrarPerguntasDialog
            open={perguntasDialogOpen}
            onOpenChange={setPerguntasDialogOpen}
            desafio={selectedDesafio}
          />
        </>
      )}
    </div>
  );
}
