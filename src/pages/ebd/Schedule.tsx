import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Eye, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Planejamento {
  id: string;
  data_inicio: string;
  data_termino: string;
  dia_semana: string;
  revista: {
    id: string;
    titulo: string;
    imagem_url: string | null;
    faixa_etaria_alvo: string;
  };
}

interface Escala {
  id: string;
  data: string;
  sem_aula: boolean;
  professor: {
    nome_completo: string;
  };
}

export default function EBDSchedule() {
  const { user } = useAuth();
  const [selectedPlanejamento, setSelectedPlanejamento] = useState<Planejamento | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Buscar dados da igreja
  const { data: churchData } = useQuery({
    queryKey: ['church-data', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('churches')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Buscar planejamentos
  const { data: planejamentos } = useQuery({
    queryKey: ['ebd-planejamentos', churchData?.id],
    queryFn: async () => {
      if (!churchData?.id) return [];
      const { data, error } = await supabase
        .from('ebd_planejamento')
        .select(`
          id,
          data_inicio,
          data_termino,
          dia_semana,
          revista:ebd_revistas(id, titulo, imagem_url, faixa_etaria_alvo)
        `)
        .eq('church_id', churchData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Planejamento[];
    },
    enabled: !!churchData?.id,
  });

  // Buscar escalas do planejamento selecionado
  const { data: escalas } = useQuery({
    queryKey: ['ebd-escalas-planejamento', selectedPlanejamento?.id, churchData?.id],
    queryFn: async () => {
      if (!churchData?.id || !selectedPlanejamento) return [];
      
      const { data, error } = await supabase
        .from('ebd_escalas')
        .select(`
          id,
          data,
          sem_aula,
          professor:ebd_professores(nome_completo)
        `)
        .eq('church_id', churchData.id)
        .gte('data', selectedPlanejamento.data_inicio)
        .lte('data', selectedPlanejamento.data_termino)
        .order('data');

      if (error) throw error;
      return data as unknown as Escala[];
    },
    enabled: !!churchData?.id && !!selectedPlanejamento,
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Preencher dias vazios no início do mês
  const startDayOfWeek = getDay(monthStart);
  const emptyDays = Array(startDayOfWeek).fill(null);

  const getEscalaForDay = (day: Date) => {
    return escalas?.find(e => isSameDay(parseISO(e.data), day));
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Escalas</h1>
            <p className="text-muted-foreground">Visualize as escalas de professores</p>
          </div>
        </div>

        {planejamentos && planejamentos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {planejamentos.map((planejamento) => (
              <Card key={planejamento.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-[3/2] relative bg-muted">
                  {planejamento.revista?.imagem_url ? (
                    <img
                      src={planejamento.revista.imagem_url}
                      alt={planejamento.revista.titulo}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg line-clamp-2">
                    {planejamento.revista?.titulo || 'Revista'}
                  </CardTitle>
                  <CardDescription>
                    {planejamento.revista?.faixa_etaria_alvo}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-4">
                    <p>Início: {format(parseISO(planejamento.data_inicio), "dd/MM/yyyy")}</p>
                    <p>Término: {format(parseISO(planejamento.data_termino), "dd/MM/yyyy")}</p>
                    <p>Dia: {planejamento.dia_semana}</p>
                  </div>
                  <Button 
                    className="w-full"
                    onClick={() => setSelectedPlanejamento(planejamento)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Escala
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Escalas Cadastradas
              </CardTitle>
              <CardDescription>Programação de professores por turma e data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma escala cadastrada</p>
                <p className="text-sm">Monte uma escala a partir do planejamento escolar</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dialog do Calendário */}
        <Dialog open={!!selectedPlanejamento} onOpenChange={() => setSelectedPlanejamento(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Escala - {selectedPlanejamento?.revista?.titulo}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Navegação do mês */}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={previousMonth}>
                  Anterior
                </Button>
                <h3 className="font-semibold text-lg">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </h3>
                <Button variant="outline" size="sm" onClick={nextMonth}>
                  Próximo
                </Button>
              </div>

              {/* Cabeçalho dos dias da semana */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
                  <div key={dia} className="p-2 font-medium text-sm text-muted-foreground">
                    {dia}
                  </div>
                ))}
              </div>

              {/* Dias do mês */}
              <div className="grid grid-cols-7 gap-1">
                {emptyDays.map((_, index) => (
                  <div key={`empty-${index}`} className="p-2 min-h-[80px]" />
                ))}
                {daysInMonth.map((day) => {
                  const escala = getEscalaForDay(day);
                  const hasClass = escala && !escala.sem_aula;
                  const noClass = escala?.sem_aula;

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "p-2 min-h-[80px] border rounded-lg text-sm",
                        !isSameMonth(day, currentMonth) && "opacity-50",
                        hasClass && "bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700",
                        noClass && "bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700"
                      )}
                    >
                      <div className="font-medium">{format(day, 'd')}</div>
                      {escala && (
                        <div className="mt-1">
                          {noClass ? (
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                              Sem aula
                            </span>
                          ) : (
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium line-clamp-2">
                              {escala.professor?.nome_completo}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legenda */}
              <div className="flex items-center gap-6 justify-center pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300 dark:bg-blue-900/30 dark:border-blue-700" />
                  <span className="text-sm">Aula</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-100 border border-red-300 dark:bg-red-900/30 dark:border-red-700" />
                  <span className="text-sm">Sem aula</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
