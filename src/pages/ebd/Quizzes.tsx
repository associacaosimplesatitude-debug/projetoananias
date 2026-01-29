import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEbdChurchId } from "@/hooks/useEbdChurchId";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Plus, Trophy, Users, Medal, MoreVertical, Trash2 } from "lucide-react";
import { CriarQuizAulaDialog } from "@/components/ebd/CriarQuizAulaDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Quiz = {
  id: string;
  titulo: string;
  descricao: string | null;
  pontos_max: number | null;
  is_active: boolean;
  data_limite: string | null;
  turma: { id: string; nome: string } | null;
};

export default function EBDQuizzes() {
  const { data: churchData } = useEbdChurchId();
  const churchId = churchData?.id;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [criarDialogOpen, setCriarDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);

  const { data: quizzes, isLoading } = useQuery({
    queryKey: ["quizzes-superintendente", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data: turmas } = await supabase.from("ebd_turmas").select("id").eq("church_id", churchId);
      const turmaIds = turmas?.map(t => t.id) || [];
      if (!turmaIds.length) return [];

      const { data, error } = await supabase
        .from("ebd_quizzes")
        .select(`id, titulo, descricao, pontos_max, is_active, data_limite, turma:ebd_turmas!turma_id(id, nome)`)
        .in("turma_id", turmaIds)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Quiz[];
    },
    enabled: !!churchId,
  });

  const { data: respostasMap } = useQuery({
    queryKey: ["quizzes-respostas", quizzes?.map(q => q.id)],
    queryFn: async () => {
      if (!quizzes?.length) return {};
      const { data } = await supabase
        .from("ebd_quiz_respostas")
        .select(`id, quiz_id, pontos_obtidos, aluno:ebd_alunos!aluno_id(id, nome_completo, avatar_url)`)
        .in("quiz_id", quizzes.map(q => q.id))
        .eq("completado", true)
        .order("pontos_obtidos", { ascending: false });
      const map: Record<string, typeof data> = {};
      data?.forEach(r => { if (!map[r.quiz_id]) map[r.quiz_id] = []; map[r.quiz_id].push(r); });
      return map;
    },
    enabled: quizzes && quizzes.length > 0,
  });

  const deleteQuizMutation = useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase
        .from("ebd_quizzes")
        .delete()
        .eq("id", quizId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes-superintendente"] });
      toast.success("Quiz excluído com sucesso!");
      setDeleteDialogOpen(false);
      setQuizToDelete(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir quiz: " + error.message);
    },
  });

  const handleDeleteClick = (quiz: Quiz) => {
    setQuizToDelete(quiz);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (quizToDelete) {
      deleteQuizMutation.mutate(quizToDelete.id);
    }
  };

  const filteredQuizzes = quizzes?.filter(q => q.titulo.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="h-6 w-6" />Quizzes</h1>
          <p className="text-muted-foreground">Crie e gerencie quizzes para as aulas</p>
        </div>
        <Button onClick={() => setCriarDialogOpen(true)} className="gap-2"><Plus className="h-4 w-4" />Novo Quiz</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar quiz..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{[1, 2].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-48" /></Card>)}</div>
      ) : filteredQuizzes && filteredQuizzes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredQuizzes.map(quiz => {
            const respostas = respostasMap?.[quiz.id] || [];
            return (
              <Card key={quiz.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{quiz.titulo}</CardTitle>
                      <CardDescription>{quiz.turma?.nome} • {quiz.data_limite ? format(parseISO(quiz.data_limite), "dd/MM") : ""}</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(quiz)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" />{respostas.length} responderam</div>
                  {respostas.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Ranking</p>
                      {respostas.slice(0, 3).map((r, i) => (
                        <div key={r.id} className="flex items-center gap-2">
                          <Medal className={`h-4 w-4 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-600"}`} />
                          <span className="text-sm flex-1 truncate">{r.aluno?.nome_completo}</span>
                          <Badge variant="outline">{r.pontos_obtidos} pts</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><CardContent className="py-12 text-center">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum quiz cadastrado ainda.</p>
          <Button onClick={() => setCriarDialogOpen(true)} variant="outline" className="gap-2"><Plus className="h-4 w-4" />Criar Primeiro Quiz</Button>
        </CardContent></Card>
      )}

      <CriarQuizAulaDialog open={criarDialogOpen} onOpenChange={setCriarDialogOpen} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Quiz</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o quiz "{quizToDelete?.titulo}"?
              <br /><br />
              Esta ação também removerá todas as respostas dos alunos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteQuizMutation.isPending}
            >
              {deleteQuizMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
