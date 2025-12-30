import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { BookOpen, Check, Calendar, Loader2, BookMarked } from "lucide-react";
import { format, subDays, isToday, isBefore, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DesafioBiblicoCardProps {
  churchId: string;
  userId: string;
  userType: "aluno" | "professor";
  turmaId?: string | null;
}

interface ConteudoBiblico {
  id: string;
  revista_id: string;
  licao_numero: number;
  texto_aureo: string | null;
  dia1_livro: string;
  dia1_versiculo: string;
  dia2_livro: string;
  dia2_versiculo: string;
  dia3_livro: string;
  dia3_versiculo: string;
  dia4_livro: string;
  dia4_versiculo: string;
  dia5_livro: string;
  dia5_versiculo: string;
  dia6_livro: string;
  dia6_versiculo: string;
}

interface DiaLeitura {
  diaNumero: number;
  livro: string;
  versiculo: string;
  dataAgendada: Date;
  lido: boolean;
}

export function DesafioBiblicoCard({ churchId, userId, userType, turmaId }: DesafioBiblicoCardProps) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDia, setSelectedDia] = useState<DiaLeitura | null>(null);
  const [versiculoTexto, setVersiculoTexto] = useState<string>("");
  const [loadingVersiculo, setLoadingVersiculo] = useState(false);
  const [conteudoAtual, setConteudoAtual] = useState<ConteudoBiblico | null>(null);

  // Buscar a próxima aula da turma e o planejamento para encontrar a revista
  const { data: planejamento } = useQuery({
    queryKey: ["planejamento-desafio", churchId],
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("ebd_planejamento")
        .select("revista_id, data_inicio, data_termino")
        .eq("church_id", churchId)
        .lte("data_inicio", hoje)
        .gte("data_termino", hoje)
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Buscar a próxima escala para saber a data da aula
  const { data: proximaAula } = useQuery({
    queryKey: ["proxima-aula-desafio", turmaId],
    queryFn: async () => {
      if (!turmaId) return null;
      
      const hoje = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("ebd_escalas")
        .select("data")
        .eq("turma_id", turmaId)
        .eq("sem_aula", false)
        .gte("data", hoje)
        .order("data", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!turmaId,
  });

  // Buscar conteúdo bíblico da revista atual
  const { data: conteudo } = useQuery({
    queryKey: ["conteudo-biblico-semana", planejamento?.revista_id],
    queryFn: async () => {
      if (!planejamento?.revista_id) return null;

      // Por simplicidade, buscar a lição 1 ou a próxima disponível
      const { data, error } = await supabase
        .from("ebd_desafio_biblico_conteudo")
        .select("*")
        .eq("revista_id", planejamento.revista_id)
        .order("licao_numero", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ConteudoBiblico | null;
    },
    enabled: !!planejamento?.revista_id,
  });

  // Buscar leituras já feitas
  const { data: leiturasFeitas = [] } = useQuery({
    queryKey: ["leituras-feitas", conteudo?.id, userId],
    queryFn: async () => {
      if (!conteudo?.id) return [];

      const { data, error } = await supabase
        .from("ebd_desafio_leitura_registro")
        .select("dia_numero")
        .eq("conteudo_id", conteudo.id)
        .eq("user_id", userId);

      if (error) throw error;
      return data?.map(l => l.dia_numero) || [];
    },
    enabled: !!conteudo?.id,
  });

  // Calcular os 6 dias de leitura
  const diasLeitura: DiaLeitura[] = (() => {
    if (!conteudo || !proximaAula?.data) return [];

    const dataAula = parseISO(proximaAula.data);
    const dias: DiaLeitura[] = [];

    for (let i = 1; i <= 6; i++) {
      const livroKey = `dia${i}_livro` as keyof ConteudoBiblico;
      const versiculoKey = `dia${i}_versiculo` as keyof ConteudoBiblico;
      
      dias.push({
        diaNumero: i,
        livro: conteudo[livroKey] as string,
        versiculo: conteudo[versiculoKey] as string,
        dataAgendada: subDays(dataAula, 7 - i), // 6 dias antes = dia 1
        lido: leiturasFeitas.includes(i),
      });
    }

    return dias;
  })();

  // Mutation para registrar leitura
  const registrarLeituraMutation = useMutation({
    mutationFn: async (dia: DiaLeitura) => {
      const hoje = startOfDay(new Date());
      const dataAgendada = startOfDay(dia.dataAgendada);
      
      // Calcular pontos: 5 se no dia, 2 se atrasado
      const pontos = isToday(dataAgendada) ? 5 : (isBefore(dataAgendada, hoje) ? 2 : 5);

      const { error } = await supabase
        .from("ebd_desafio_leitura_registro")
        .insert({
          church_id: churchId,
          user_id: userId,
          user_type: userType,
          conteudo_id: conteudo!.id,
          dia_numero: dia.diaNumero,
          data_agendada: format(dia.dataAgendada, "yyyy-MM-dd"),
          pontos_ganhos: pontos,
        });

      if (error) throw error;
      return pontos;
    },
    onSuccess: (pontos) => {
      queryClient.invalidateQueries({ queryKey: ["leituras-feitas"] });
      toast.success(`Leitura confirmada! +${pontos} pontos`);
      setModalOpen(false);
      setSelectedDia(null);
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("Você já confirmou esta leitura");
      } else {
        toast.error("Erro ao registrar leitura");
      }
    },
  });

  // Buscar texto do versículo via API
  const buscarVersiculo = async (livro: string, versiculo: string) => {
    setLoadingVersiculo(true);
    setVersiculoTexto("");

    try {
      const { data, error } = await supabase.functions.invoke("fetch-bible-verse", {
        body: { book: livro, verse: versiculo },
      });

      if (error) throw error;
      setVersiculoTexto(data?.text || "Texto não disponível");
    } catch (err) {
      console.error("Erro ao buscar versículo:", err);
      setVersiculoTexto("Não foi possível carregar o texto. Consulte sua Bíblia.");
    } finally {
      setLoadingVersiculo(false);
    }
  };

  const abrirModal = (dia: DiaLeitura) => {
    setSelectedDia(dia);
    setConteudoAtual(conteudo);
    setModalOpen(true);
    buscarVersiculo(dia.livro, dia.versiculo);
  };

  if (!conteudo || diasLeitura.length === 0) {
    return null;
  }

  const leiturasCompletas = leiturasFeitas.length;
  const hoje = startOfDay(new Date());

  return (
    <>
      <Card className="border-2 border-amber-500/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <BookMarked className="h-5 w-5" />
            Desafio Bíblico da Semana
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Progresso</span>
            <Badge variant={leiturasCompletas === 6 ? "default" : "secondary"}>
              {leiturasCompletas}/6 leituras
            </Badge>
          </div>

          <div className="grid grid-cols-6 gap-2">
            {diasLeitura.map((dia) => {
              const isHoje = isToday(dia.dataAgendada);
              const passado = isBefore(startOfDay(dia.dataAgendada), hoje);
              const podeMarcar = (isHoje || passado) && !dia.lido;

              return (
                <Button
                  key={dia.diaNumero}
                  variant={dia.lido ? "default" : podeMarcar ? "outline" : "ghost"}
                  size="sm"
                  className={`flex-col h-auto py-2 ${
                    dia.lido 
                      ? "bg-green-600 hover:bg-green-700" 
                      : isHoje 
                        ? "border-amber-500 border-2" 
                        : ""
                  }`}
                  onClick={() => !dia.lido && podeMarcar && abrirModal(dia)}
                  disabled={dia.lido || (!podeMarcar && !passado)}
                >
                  {dia.lido ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Calendar className="h-4 w-4" />
                  )}
                  <span className="text-xs mt-1">
                    {format(dia.dataAgendada, "dd/MM")}
                  </span>
                </Button>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Clique no dia para ler e ganhar pontos
          </p>
        </CardContent>
      </Card>

      {/* Modal de Leitura */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Leitura do Dia {selectedDia?.diaNumero}
            </DialogTitle>
          </DialogHeader>

          {selectedDia && (
            <div className="space-y-4">
              <div className="text-center">
                <Badge variant="outline" className="text-lg px-4 py-1">
                  {selectedDia.livro} {selectedDia.versiculo}
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  {format(selectedDia.dataAgendada, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
              </div>

              <ScrollArea className="h-[200px] border rounded-lg p-4 bg-muted/30">
                {loadingVersiculo ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <p className="text-base leading-relaxed whitespace-pre-wrap">
                    {versiculoTexto}
                  </p>
                )}
              </ScrollArea>

              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {isToday(selectedDia.dataAgendada) 
                    ? "Leitura no dia certo: +5 pontos!" 
                    : "Leitura atrasada: +2 pontos"}
                </p>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => registrarLeituraMutation.mutate(selectedDia)}
                disabled={registrarLeituraMutation.isPending}
              >
                {registrarLeituraMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Confirmar Leitura
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
