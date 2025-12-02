import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, User } from "lucide-react";
import { format, endOfWeek, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EscalaSemana {
  id: string;
  data: string;
  sem_aula: boolean;
  observacao: string | null;
  professor: {
    nome_completo: string;
    avatar_url: string | null;
  } | null;
  turma: {
    id: string;
    nome: string;
    faixa_etaria: string;
  };
}

interface EscalaSemanaCardProps {
  churchId: string;
}

export function EscalaSemanaCard({ churchId }: EscalaSemanaCardProps) {
  const hoje = new Date();
  const fimPeriodo = endOfWeek(hoje, { weekStartsOn: 0 }); // Fim da semana atual (sábado)

  const { data: escalasSemana, isLoading } = useQuery({
    queryKey: ['ebd-escala-semana', churchId, format(hoje, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_escalas')
        .select(`
          id,
          data,
          sem_aula,
          observacao,
          professor:ebd_professores(nome_completo, avatar_url),
          turma:ebd_turmas(id, nome, faixa_etaria)
        `)
        .eq('church_id', churchId)
        .gte('data', format(hoje, 'yyyy-MM-dd'))
        .lte('data', format(fimPeriodo, 'yyyy-MM-dd'))
        .order('data');

      if (error) throw error;
      return data as unknown as EscalaSemana[];
    },
    enabled: !!churchId,
  });

  // Agrupar por data
  const escalasPorData = escalasSemana?.reduce((acc, escala) => {
    const data = escala.data;
    if (!acc[data]) {
      acc[data] = [];
    }
    acc[data].push(escala);
    return acc;
  }, {} as Record<string, EscalaSemana[]>) || {};

  const datasComEscala = Object.keys(escalasPorData).sort();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Escala da Semana
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (datasComEscala.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Escala da Semana
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {datasComEscala.map((data) => {
          const escalas = escalasPorData[data];
          const dataFormatada = format(parseISO(data), "EEEE, dd 'de' MMMM", { locale: ptBR });
          
          return (
            <div key={data} className="space-y-3">
              <h3 className="font-semibold text-lg capitalize border-b pb-2">
                {dataFormatada}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {escalas.map((escala) => (
                  <div 
                    key={escala.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      escala.sem_aula 
                        ? 'bg-muted/50 border-muted' 
                        : 'bg-card hover:bg-accent/5 transition-colors'
                    }`}
                  >
                    {escala.sem_aula ? (
                      <>
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground text-xs">N/A</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{escala.turma.nome}</p>
                          <p className="text-xs text-muted-foreground">{escala.turma.faixa_etaria}</p>
                          <p className="text-xs text-orange-500 font-medium">Sem aula</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Avatar className="h-12 w-12">
                          <AvatarImage 
                            src={escala.professor?.avatar_url || undefined} 
                            alt={escala.professor?.nome_completo || 'Professor'} 
                          />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {escala.professor?.nome_completo
                              ?.split(' ')
                              .map(n => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase() || <User className="h-5 w-5" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {escala.professor?.nome_completo || 'Não definido'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {escala.turma.nome}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {escala.turma.faixa_etaria}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
