import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Check } from "lucide-react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useEbdChurchId } from "@/hooks/useEbdChurchId";
import { toast } from "sonner";
import { RevistaConfig } from "@/pages/ebd/AtivarRevistas";

interface RevistaEscalaConfigProps {
  revistas: RevistaConfig[];
}

interface AulaEscala {
  numero: number;
  data: Date;
  semAula: boolean;
  professorId1: string;
  professorId2: string;
}

interface RevistaEscala {
  revista: RevistaConfig;
  aulas: AulaEscala[];
}

export function RevistaEscalaConfig({ revistas }: RevistaEscalaConfigProps) {
  const { data: churchData } = useEbdChurchId();
  const churchId = churchData?.id;
  const [escalas, setEscalas] = useState<RevistaEscala[]>(() => 
    revistas.map(revista => ({
      revista,
      aulas: Array.from({ length: 13 }, (_, i) => ({
        numero: i + 1,
        data: addDays(revista.dataInicio!, i * 7),
        semAula: false,
        professorId1: '',
        professorId2: '',
      })),
    }))
  );
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  // Buscar professores da igreja
  const { data: professores, isLoading: loadingProfessores } = useQuery({
    queryKey: ['professores-ebd', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ebd_professores')
        .select('id, nome_completo')
        .eq('church_id', churchId)
        .eq('is_active', true)
        .order('nome_completo');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!churchId,
  });

  const handleAulaChange = (
    revistaIndex: number, 
    aulaIndex: number, 
    field: keyof AulaEscala, 
    value: boolean | string
  ) => {
    setEscalas(prev => {
      const newEscalas = [...prev];
      const aulas = [...newEscalas[revistaIndex].aulas];
      aulas[aulaIndex] = { ...aulas[aulaIndex], [field]: value };
      newEscalas[revistaIndex] = { ...newEscalas[revistaIndex], aulas };
      return newEscalas;
    });
  };

  const handleSalvar = async () => {
    setSalvando(true);
    
    try {
      for (const escala of escalas) {
        const revista = escala.revista;
        
        // Criar as escalas para cada aula diretamente na tabela ebd_escalas
        // A tabela ebd_escalas tem os campos: church_id, turma_id, data, tipo, professor_id, professor_id_2, sem_aula, confirmado
        const aulasParaInserir = escala.aulas.map(aula => ({
          church_id: churchId!,
          turma_id: revista.turmaId!,
          data: format(aula.data, 'yyyy-MM-dd'),
          tipo: 'aula', // tipo obrigatório
          professor_id: aula.semAula ? null : (aula.professorId1 || null),
          professor_id_2: aula.semAula ? null : (aula.professorId2 || null),
          sem_aula: aula.semAula,
          confirmado: false,
          observacao: `Aula ${aula.numero} - ${revista.produto.node.title}`,
        }));
        
        if (aulasParaInserir.length > 0) {
          const { error: escalaError } = await supabase
            .from('ebd_escalas')
            .insert(aulasParaInserir);
          
          if (escalaError) throw escalaError;
        }
      }
      
      toast.success('Escalas salvas com sucesso!');
      setSalvo(true);
    } catch (error) {
      console.error('Erro ao salvar escalas:', error);
      toast.error('Erro ao salvar escalas. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (revistas.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma revista configurada para montar escala.
      </div>
    );
  }

  if (salvo) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="bg-green-100 text-green-700 rounded-full p-6">
          <Check className="h-12 w-12" />
        </div>
        <h2 className="text-2xl font-bold">Escalas Salvas!</h2>
        <p className="text-muted-foreground">
          As revistas foram ativadas e as escalas foram criadas com sucesso.
        </p>
        <Button 
          variant="outline" 
          onClick={() => window.location.href = '/ebd/escala'}
        >
          Ver Escalas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Monte a escala de cada revista</h3>
          <p className="text-sm text-muted-foreground">
            Defina os professores para cada aula (você pode colocar 2 professores por aula)
          </p>
        </div>
        <Button 
          onClick={handleSalvar}
          disabled={salvando}
        >
          {salvando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Todas as Escalas
            </>
          )}
        </Button>
      </div>

      {escalas.map((escala, revistaIndex) => (
        <Card key={escala.revista.produto.node.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <div className="w-16 h-20 bg-muted rounded overflow-hidden flex-shrink-0">
                {escala.revista.produto.node.images.edges[0]?.node.url && (
                  <img
                    src={escala.revista.produto.node.images.edges[0].node.url}
                    alt={escala.revista.produto.node.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div>
                <CardTitle className="text-base">
                  {escala.revista.produto.node.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Turma: {escala.revista.turmaNome} | {escala.revista.diaSemana}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {escala.aulas.map((aula, aulaIndex) => (
                <div 
                  key={aula.numero}
                  className={`flex flex-wrap items-center gap-4 p-3 rounded-lg border ${
                    aula.semAula ? 'bg-muted/50' : 'bg-background'
                  }`}
                >
                  <div className="w-24 flex-shrink-0">
                    <span className="font-medium">Aula {aula.numero}</span>
                    <p className="text-sm text-muted-foreground">
                      {format(aula.data, "dd/MM", { locale: ptBR })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`sem-aula-${revistaIndex}-${aulaIndex}`}
                      checked={aula.semAula}
                      onCheckedChange={(checked) => 
                        handleAulaChange(revistaIndex, aulaIndex, 'semAula', !!checked)
                      }
                    />
                    <Label 
                      htmlFor={`sem-aula-${revistaIndex}-${aulaIndex}`}
                      className="text-sm"
                    >
                      Sem aula
                    </Label>
                  </div>

                  {!aula.semAula && (
                    <>
                      <div className="flex-1 min-w-[180px]">
                        <Select
                          value={aula.professorId1}
                          onValueChange={(value) => 
                            handleAulaChange(revistaIndex, aulaIndex, 'professorId1', value)
                          }
                          disabled={loadingProfessores}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Professor 1 *" />
                          </SelectTrigger>
                          <SelectContent>
                            {professores?.map(prof => (
                              <SelectItem key={prof.id} value={prof.id}>
                                {prof.nome_completo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex-1 min-w-[180px]">
                        <Select
                          value={aula.professorId2}
                          onValueChange={(value) => 
                            handleAulaChange(revistaIndex, aulaIndex, 'professorId2', value)
                          }
                          disabled={loadingProfessores}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Professor 2 (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Nenhum</SelectItem>
                            {professores?.map(prof => (
                              <SelectItem key={prof.id} value={prof.id}>
                                {prof.nome_completo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
