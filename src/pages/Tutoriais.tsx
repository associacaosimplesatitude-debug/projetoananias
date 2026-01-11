import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Search, Video, Lock, CheckCircle2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TutorialPerfil =
  | "VENDEDORES"
  | "GERENTES"
  | "FINANCEIRO"
  | "PROFESSORES"
  | "ALUNOS"
  | "SUPERINTENDENTES"
  | "ADMINISTRADOR_GERAL";

interface Tutorial {
  id: string;
  titulo: string;
  link_video: string;
  video_path: string | null;
  descricao: string | null;
  categorias: string[];
  ordem: number;
  tutoriais_perfis: { perfil: TutorialPerfil }[];
}

interface Visualizacao {
  tutorial_id: string;
  assistido_em: string;
}

function VideoPlayer({ videoPath }: { videoPath: string }) {
  const { data } = supabase.storage.from("tutorial-videos").getPublicUrl(videoPath);
  
  return (
    <video
      className="w-full aspect-video rounded-lg bg-black"
      controls
      preload="metadata"
    >
      <source src={data.publicUrl} type="video/mp4" />
      Seu navegador não suporta vídeos HTML5.
    </video>
  );
}

function LockedVideoPlaceholder() {
  return (
    <div className="w-full aspect-video rounded-lg bg-muted flex flex-col items-center justify-center gap-2">
      <Lock className="h-12 w-12 text-muted-foreground" />
      <p className="text-sm text-muted-foreground text-center px-4">
        Assista o tutorial anterior primeiro
      </p>
    </div>
  );
}

export default function Tutoriais() {
  const { user, role } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  // Determine user's profile for filtering
  const userPerfis = useMemo(() => {
    const perfis: TutorialPerfil[] = [];

    if (role === "admin") {
      perfis.push("ADMINISTRADOR_GERAL");
    }
    if (role === "gerente_ebd") {
      perfis.push("GERENTES");
    }
    if (role === "financeiro") {
      perfis.push("FINANCEIRO");
    }

    return perfis;
  }, [role]);

  // Check if user is vendedor and get vendedor_id
  const { data: vendedorData } = useQuery({
    queryKey: ["vendedor-data", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("vendedores")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.email,
  });

  const isVendedor = !!vendedorData;
  const vendedorId = vendedorData?.id;

  // Check if user is professor
  const { data: isProfessor } = useQuery({
    queryKey: ["is-professor", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("ebd_professores")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Check if user is aluno
  const { data: isAluno } = useQuery({
    queryKey: ["is-aluno", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("ebd_alunos")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Check if user is superintendente
  const { data: isSuperintendente } = useQuery({
    queryKey: ["is-superintendente", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("ebd_clientes")
        .select("id")
        .eq("superintendente_user_id", user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Build complete perfis list
  const allUserPerfis = useMemo(() => {
    const perfis = [...userPerfis];
    if (isVendedor) perfis.push("VENDEDORES");
    if (isProfessor) perfis.push("PROFESSORES");
    if (isAluno) perfis.push("ALUNOS");
    if (isSuperintendente) perfis.push("SUPERINTENDENTES");
    return perfis;
  }, [userPerfis, isVendedor, isProfessor, isAluno, isSuperintendente]);

  // Fetch tutorials
  const { data: tutoriais, isLoading } = useQuery({
    queryKey: ["tutoriais", allUserPerfis],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutoriais")
        .select("*, tutoriais_perfis(perfil)")
        .order("ordem", { ascending: true });

      if (error) throw error;

      // Filter tutorials based on user's profiles
      const filtered = (data as Tutorial[]).filter((tutorial) =>
        tutorial.tutoriais_perfis.some((p) => allUserPerfis.includes(p.perfil))
      );

      return filtered;
    },
    enabled: allUserPerfis.length > 0,
  });

  // Fetch user's watched tutorials (only for vendedores)
  const { data: visualizacoes } = useQuery({
    queryKey: ["tutorial-visualizacoes", vendedorId],
    queryFn: async () => {
      if (!vendedorId) return [];
      const { data, error } = await supabase
        .from("tutorial_visualizacoes")
        .select("tutorial_id, assistido_em")
        .eq("vendedor_id", vendedorId);

      if (error) throw error;
      return data as Visualizacao[];
    },
    enabled: !!vendedorId,
  });

  // Mutation to mark tutorial as watched
  const marcarAssistidoMutation = useMutation({
    mutationFn: async (tutorialId: string) => {
      if (!vendedorId) throw new Error("Vendedor não encontrado");

      const { error } = await supabase
        .from("tutorial_visualizacoes")
        .insert({
          tutorial_id: tutorialId,
          vendedor_id: vendedorId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorial-visualizacoes", vendedorId] });
      toast.success("Tutorial marcado como assistido!");
    },
    onError: () => {
      toast.error("Erro ao marcar tutorial como assistido");
    },
  });

  // Helper to check if a tutorial is watched
  const isWatched = (tutorialId: string) => {
    return visualizacoes?.some((v) => v.tutorial_id === tutorialId) ?? false;
  };

  // Helper to get watched date
  const getWatchedDate = (tutorialId: string) => {
    const viz = visualizacoes?.find((v) => v.tutorial_id === tutorialId);
    return viz?.assistido_em;
  };

  // Calculate if tutorial is unlocked (for vendedores)
  // First tutorial is always unlocked, others require previous to be watched
  const isTutorialUnlocked = (tutorial: Tutorial, index: number) => {
    if (!isVendedor) return true; // Non-vendedores have free access
    if (index === 0) return true; // First tutorial always unlocked
    
    // Check if previous tutorial is watched
    const previousTutorial = tutoriais?.[index - 1];
    if (!previousTutorial) return true;
    
    return isWatched(previousTutorial.id);
  };

  // Filter by search term
  const filteredTutoriais = useMemo(() => {
    if (!tutoriais) return [];
    if (!searchTerm) return tutoriais;

    const term = searchTerm.toLowerCase();
    return tutoriais.filter(
      (t) =>
        t.titulo.toLowerCase().includes(term) ||
        t.descricao?.toLowerCase().includes(term)
    );
  }, [tutoriais, searchTerm]);

  // Calculate progress for vendedores
  const progress = useMemo(() => {
    if (!isVendedor || !tutoriais) return null;
    const watched = tutoriais.filter((t) => isWatched(t.id)).length;
    const total = tutoriais.length;
    const percentage = total > 0 ? Math.round((watched / total) * 100) : 0;
    return { watched, total, percentage };
  }, [isVendedor, tutoriais, visualizacoes]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tutoriais</h1>
        <p className="text-muted-foreground">
          Vídeos de treinamento e orientação
        </p>
      </div>

      {/* Progress bar for vendedores */}
      {isVendedor && progress && progress.total > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Seu Progresso</span>
              <span className="text-sm text-muted-foreground">
                {progress.watched} de {progress.total} tutoriais ({progress.percentage}%)
              </span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou descrição..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredTutoriais.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm
                ? "Nenhum tutorial encontrado para sua busca"
                : "Nenhum tutorial disponível para seu perfil"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTutoriais.map((tutorial, index) => {
            const unlocked = isTutorialUnlocked(tutorial, index);
            const watched = isWatched(tutorial.id);
            const watchedDate = getWatchedDate(tutorial.id);

            return (
              <Card 
                key={tutorial.id} 
                className={`overflow-hidden transition-all ${
                  !unlocked ? "opacity-60" : ""
                } ${watched ? "ring-2 ring-green-500/20" : ""}`}
              >
                {/* Video or locked placeholder */}
                {unlocked ? (
                  tutorial.video_path ? (
                    <VideoPlayer videoPath={tutorial.video_path} />
                  ) : (
                    <div className="w-full aspect-video bg-muted flex items-center justify-center">
                      <Video className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )
                ) : (
                  <LockedVideoPlaceholder />
                )}

                <CardHeader className="pb-2">
                  <div className="flex items-start gap-2">
                    {watched && (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    )}
                    {!watched && unlocked && isVendedor && (
                      <PlayCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    )}
                    {!unlocked && (
                      <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    )}
                    <CardTitle className="text-lg line-clamp-2">
                      {tutorial.titulo}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tutorial.descricao && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {tutorial.descricao}
                    </p>
                  )}
                  {tutorial.categorias?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tutorial.categorias.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Confirmation button / status for vendedores */}
                  {isVendedor && (
                    <div className="pt-2 border-t">
                      {watched ? (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>
                            Assistido em{" "}
                            {format(new Date(watchedDate!), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      ) : unlocked ? (
                        <Button
                          onClick={() => marcarAssistidoMutation.mutate(tutorial.id)}
                          disabled={marcarAssistidoMutation.isPending}
                          className="w-full"
                          variant="outline"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Confirmar que Assisti
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Lock className="h-4 w-4" />
                          <span>Assista o tutorial anterior</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
