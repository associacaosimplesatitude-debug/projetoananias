import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";

export default function RevistaLeitor() {
  const { revistaId, numero } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  // Get cliente id
  const { data: cliente } = useQuery({
    queryKey: ["meu-cliente-leitor", user?.id],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja")
        .eq("email_superintendente", user.email)
        .maybeSingle();
      if (!data) {
        const { data: aluno } = await supabase
          .from("ebd_alunos")
          .select("church_id")
          .eq("user_id", user!.id)
          .eq("is_active", true)
          .maybeSingle();
        if (aluno) return { id: aluno.church_id, nome_igreja: "" };
      }
      return data;
    },
    enabled: !!user,
  });

  const { data: licao } = useQuery({
    queryKey: ["licao-leitor", revistaId, numero],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revista_licoes")
        .select("*, revista:revistas_digitais(titulo, total_licoes)")
        .eq("revista_id", revistaId!)
        .eq("numero", Number(numero))
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!revistaId && !!numero,
  });

  const { data: allLicoes } = useQuery({
    queryKey: ["all-licoes-leitor", revistaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("revista_licoes")
        .select("id, numero, titulo")
        .eq("revista_id", revistaId!)
        .order("numero");
      return data || [];
    },
    enabled: !!revistaId,
  });

  const paginas = (licao?.paginas as string[]) || [];
  const totalPages = paginas.length;
  const progressPercent = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0;
  const currentNumero = Number(numero);

  // Load saved progress
  useEffect(() => {
    if (!cliente?.id || !licao?.id) return;
    supabase
      .from("revista_progresso")
      .select("pagina_atual")
      .eq("cliente_id", cliente.id)
      .eq("licao_id", licao.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.pagina_atual > 1) {
          setCurrentPage(Math.min(data.pagina_atual - 1, totalPages - 1));
        }
      });
  }, [cliente?.id, licao?.id, totalPages]);

  // Save progress
  const saveProgress = useCallback(async (page: number, completed: boolean) => {
    if (!cliente?.id || !licao?.id) return;
    await supabase.from("revista_progresso").upsert({
      cliente_id: cliente.id,
      licao_id: licao.id,
      pagina_atual: page + 1,
      concluida: completed,
      updated_at: new Date().toISOString(),
    }, { onConflict: "cliente_id,licao_id" });
  }, [cliente?.id, licao?.id]);

  const goToPage = useCallback((page: number) => {
    if (page < 0 || page >= totalPages) return;
    setCurrentPage(page);
    saveProgress(page, false);

    // Last page → mark as complete
    if (page === totalPages - 1) {
      saveProgress(page, true);
      setShowComplete(true);
    }
  }, [totalPages, saveProgress]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") goToPage(currentPage + 1);
      if (e.key === "ArrowLeft") goToPage(currentPage - 1);
      if (e.key === "Escape") navigate(-1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentPage, goToPage, navigate]);

  // Swipe
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToPage(currentPage + 1);
      else goToPage(currentPage - 1);
    }
  };

  // Watermark text
  const watermarkText = cliente?.nome_igreja || user?.email || "";

  const goToNextLicao = () => {
    const next = allLicoes?.find(l => l.numero === currentNumero + 1);
    if (next) {
      setCurrentPage(0);
      setShowComplete(false);
      navigate(`/ebd/aluno/revista/${revistaId}/licao/${currentNumero + 1}`, { replace: true });
    }
  };

  const goToPrevLicao = () => {
    if (currentNumero > 1) {
      setCurrentPage(0);
      navigate(`/ebd/aluno/revista/${revistaId}/licao/${currentNumero - 1}`, { replace: true });
    }
  };

  if (!licao) {
    return <div className="flex items-center justify-center h-screen bg-background"><div className="animate-pulse">Carregando...</div></div>;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col select-none" onContextMenu={(e) => e.preventDefault()}>
      {/* Progress bar */}
      <Progress value={progressPercent} className="h-1 rounded-none bg-slate-800" indicatorClassName="bg-orange-500" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-white/60 text-sm shrink-0">Lição {numero}</span>
          <span className="text-white font-medium text-sm truncate">{licao.titulo || `Lição ${numero}`}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10 shrink-0">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Reader area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {paginas.length > 0 ? (
          <div className="relative max-h-full max-w-full">
            <img
              src={paginas[currentPage]}
              alt={`Página ${currentPage + 1}`}
              className="max-h-[calc(100vh-120px)] max-w-full object-contain pointer-events-none"
              draggable={false}
            />
            {/* Watermark */}
            {watermarkText && (
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
                <span
                  className="text-white/[0.07] text-4xl font-bold whitespace-nowrap rotate-[-30deg] select-none"
                  style={{ textShadow: "none" }}
                >
                  {watermarkText}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-white/50">Nenhuma página disponível</p>
        )}
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 0}
          className="text-white hover:bg-white/10"
        >
          <ChevronLeft className="h-5 w-5 mr-1" /> Anterior
        </Button>
        <span className="text-white/60 text-sm">
          Página {currentPage + 1} de {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          className="text-white hover:bg-white/10"
        >
          Próxima <ChevronRight className="h-5 w-5 ml-1" />
        </Button>
      </div>

      {/* Completion modal */}
      <Dialog open={showComplete} onOpenChange={setShowComplete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <PartyPopper className="h-6 w-6 text-orange-500" /> Lição Concluída!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-muted-foreground">
              Parabéns! Você concluiu a <strong>Lição {numero}</strong>.
            </p>
            {allLicoes && currentNumero < (allLicoes.length) && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">Próxima lição:</p>
                <p className="font-medium">
                  {allLicoes.find(l => l.numero === currentNumero + 1)?.titulo || `Lição ${currentNumero + 1}`}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowComplete(false); navigate(-1); }} className="flex-1">
                Voltar
              </Button>
              {currentNumero < (allLicoes?.length || 0) && (
                <Button onClick={goToNextLicao} className="flex-1 bg-orange-500 hover:bg-orange-600">
                  Próxima Lição
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
