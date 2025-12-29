import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Gift, 
  CheckCircle2, 
  Circle, 
  BookOpen, 
  Users, 
  GraduationCap, 
  CalendarDays, 
  ClipboardList,
  PartyPopper,
  Sparkles,
  ChevronRight
} from "lucide-react";
import { useOnboardingProgress, calcularDesconto } from "@/hooks/useOnboardingProgress";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface OnboardingProgressCardProps {
  churchId: string | null;
}

const ETAPA_ICONS = [BookOpen, Users, GraduationCap, CalendarDays, ClipboardList];
const ETAPA_ROUTES = [
  "/ebd/catalogo",
  "/ebd/classrooms",
  "/ebd/teachers",
  "/ebd/planejamento",
  "/ebd/schedule",
];

export function OnboardingProgressCard({ churchId }: OnboardingProgressCardProps) {
  const navigate = useNavigate();
  const { progress, revistaIdentificada, isLoading, marcarEtapa } = useOnboardingProgress(churchId);

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 animate-pulse">
        <CardContent className="p-6">
          <div className="h-32 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Se não há progresso ainda ou o onboarding já foi concluído
  if (!progress) return null;

  // Se o onboarding foi concluído, mostrar card de parabéns
  if (progress.concluido) {
    return (
      <Card className="bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-background border-green-500/30 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <CardContent className="p-6 relative">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <PartyPopper className="h-8 w-8 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Parabéns! Onboarding Completo!
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Você ganhou <span className="font-bold text-green-600">{progress.descontoObtido}% de desconto</span> na sua próxima compra + Brinde de Aniversário!
              </p>
            </div>
            <Button 
              onClick={() => navigate("/ebd/catalogo")}
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
              <Gift className="h-4 w-4" />
              Ver Catálogo
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Encontrar a próxima etapa não completada
  const proximaEtapa = progress.etapas.find((e) => !e.completada);
  const etapaAtualIndex = proximaEtapa ? proximaEtapa.id - 1 : 4;

  const handleEtapaClick = (etapaId: number) => {
    if (etapaId === 1 && revistaIdentificada) {
      // Para etapa 1, ir para o catálogo
      navigate("/ebd/catalogo");
    } else {
      navigate(ETAPA_ROUTES[etapaId - 1]);
    }
  };

  // Calcular desconto potencial
  const descontoInfo = calcularDesconto(300); // Base de 300 para mostrar

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 overflow-hidden relative">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <CardHeader className="pb-2 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Gift className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Complete seu Setup e Ganhe Desconto!</CardTitle>
              <p className="text-sm text-muted-foreground">
                Até <span className="font-bold text-primary">30% de desconto</span> na próxima compra + Brinde de Aniversário
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-primary border-primary/50 px-3 py-1">
            {progress.progressoPercentual}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={progress.progressoPercentual} className="h-3" />
          <p className="text-xs text-muted-foreground text-center">
            {progress.etapas.filter((e) => e.completada).length} de 5 etapas concluídas
          </p>
        </div>

        {/* Etapas */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {progress.etapas.map((etapa, index) => {
            const Icon = ETAPA_ICONS[index];
            const isCompleta = etapa.completada;
            const isAtual = proximaEtapa?.id === etapa.id;
            
            return (
              <button
                key={etapa.id}
                onClick={() => handleEtapaClick(etapa.id)}
                disabled={isCompleta}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg transition-all text-center",
                  isCompleta 
                    ? "bg-green-500/10 border border-green-500/30 cursor-default" 
                    : isAtual 
                    ? "bg-primary/10 border border-primary/30 hover:bg-primary/20 cursor-pointer ring-2 ring-primary/50" 
                    : "bg-muted/50 border border-muted hover:bg-muted cursor-pointer opacity-60"
                )}
              >
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  isCompleta 
                    ? "bg-green-500/20" 
                    : isAtual 
                    ? "bg-primary/20" 
                    : "bg-muted"
                )}>
                  {isCompleta ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Icon className={cn(
                      "h-5 w-5",
                      isAtual ? "text-primary" : "text-muted-foreground"
                    )} />
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className={cn(
                    "text-xs font-medium",
                    isCompleta 
                      ? "text-green-700 dark:text-green-400" 
                      : isAtual 
                      ? "text-primary" 
                      : "text-muted-foreground"
                  )}>
                    {etapa.titulo}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Próxima ação */}
        {proximaEtapa && (
          <div className="flex items-center justify-between bg-primary/5 rounded-lg p-3 border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                {(() => {
                  const Icon = ETAPA_ICONS[proximaEtapa.id - 1];
                  return <Icon className="h-4 w-4 text-primary" />;
                })()}
              </div>
              <div>
                <p className="text-sm font-medium">Próximo passo: {proximaEtapa.titulo}</p>
                <p className="text-xs text-muted-foreground">{proximaEtapa.descricao}</p>
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={() => handleEtapaClick(proximaEtapa.id)}
              className="gap-1"
            >
              Iniciar
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Info sobre descontos */}
        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2 border-t">
          <span className="flex items-center gap-1">
            <Gift className="h-3 w-3" />
            R$0-300: <strong className="text-foreground">20% off</strong>
          </span>
          <span className="flex items-center gap-1">
            R$301-500: <strong className="text-foreground">25% off</strong>
          </span>
          <span className="flex items-center gap-1">
            R$501+: <strong className="text-foreground">30% off</strong>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
