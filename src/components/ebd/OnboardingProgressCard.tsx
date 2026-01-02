import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import {
  Gift,
  CheckCircle2,
  BookOpen,
  Users,
  GraduationCap,
  CalendarDays,
  ClipboardList,
  PartyPopper,
  Sparkles,
  ChevronRight,
  Cake,
  Heart,
  RefreshCw,
} from "lucide-react";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DefinirDataInicioDialog } from "./DefinirDataInicioDialog";
import { ConfigurarLancamentoDialog } from "./ConfigurarLancamentoDialog";
import { AplicarRevistaDialog } from "./AplicarRevistaDialog";

interface OnboardingProgressCardProps {
  churchId: string | null;
}

const ETAPA_ICONS: Record<number, any> = {
  1: BookOpen,
  2: Users,
  3: GraduationCap,
  4: CalendarDays,
  5: ClipboardList,
  6: Cake,
  7: ClipboardList, // Configurar Lançamento
};

const ETAPA_ROUTES: Record<number, string | null> = {
  1: null, // Abre dialog de seleção de revistas
  2: "/ebd/turmas/nova",
  3: "/ebd/teachers",
  4: "/ebd/planejamento",
  5: "/ebd/schedule",
  6: null, // Abre dialog de aniversário
  7: null, // Abre dialog de configurar lançamento
};

export function OnboardingProgressCard({ churchId }: OnboardingProgressCardProps) {
  const navigate = useNavigate();
  const {
    progress,
    revistasNaoAplicadas,
    isLoading,
    marcarEtapa,
    marcarEtapaAsync,
    usarCupomAniversario,
    isUsandoCupom,
    verificarEtapas,
  } = useOnboardingProgress(churchId);
  
  // Verificar etapas ao montar o componente
  useEffect(() => {
    if (churchId && progress && !progress.concluido) {
      verificarEtapas();
    }
  }, [churchId, progress?.concluido]);
  const [showAniversarioDialog, setShowAniversarioDialog] = useState(false);
  const [showAplicarRevistaDialog, setShowAplicarRevistaDialog] = useState(false);
  const [showDataInicioDialog, setShowDataInicioDialog] = useState(false);
  const [showConfigLancamentoDialog, setShowConfigLancamentoDialog] = useState(false);
  const [dataAniversario, setDataAniversario] = useState("");

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

  if (!progress) return null;

  const revistaParaDataInicio = progress.revistaIdentificadaId
    ? {
        id: progress.revistaIdentificadaId,
        titulo: progress.revistaIdentificadaTitulo || "",
        faixa_etaria_alvo: progress.revistaIdentificadaFaixaEtaria || "",
        imagem_url: progress.revistaIdentificadaImagem,
        num_licoes: progress.revistaIdentificadaNumLicoes || 13,
      }
    : revistasNaoAplicadas.length === 1
      ? {
          id: revistasNaoAplicadas[0].id,
          titulo: revistasNaoAplicadas[0].titulo,
          faixa_etaria_alvo: "",
          imagem_url: revistasNaoAplicadas[0].imagemUrl,
          num_licoes: 13,
        }
      : null;

  // Card especial de aniversário
  if (progress.cupomAniversarioDisponivel) {
    return (
      <Card className="bg-gradient-to-br from-pink-500/20 via-rose-500/10 to-background border-pink-500/30 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-40 h-40 bg-pink-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <CardContent className="p-6 relative">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center flex-shrink-0 animate-pulse">
              <Cake className="h-10 w-10 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-pink-700 dark:text-pink-400 flex items-center gap-2">
                <PartyPopper className="h-6 w-6" />
                🎂 Feliz Aniversário! 🎂
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Desejamos um dia maravilhoso! Como presente, você ganhou um cupom de{" "}
                <span className="font-bold text-pink-600">R$ 50,00 de desconto</span> para escolher qualquer produto da Editora!
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Heart className="h-4 w-4 text-pink-500 fill-pink-500" />
                <span className="text-xs text-muted-foreground">Válido apenas hoje!</span>
              </div>
            </div>
            <Button 
              onClick={() => {
                usarCupomAniversario();
                navigate("/ebd/shopify-pedidos");
              }}
              disabled={isUsandoCupom}
              className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 gap-2 text-white"
            >
              <Gift className="h-4 w-4" />
              Usar Cupom de R$50
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Se o onboarding foi concluído (e não há revistas novas), mostrar card de parabéns
  if (progress.concluido && revistasNaoAplicadas.length === 0) {
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
                {progress.modoRecompra ? "Revista Configurada com Sucesso!" : "Parabéns! Onboarding Completo!"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Você ganhou <span className="font-bold text-green-600">{progress.descontoObtido}% de desconto</span> na sua próxima compra
                {!progress.modoRecompra && " + Brinde de Aniversário"}!
              </p>
            </div>
            <Button 
              onClick={() => navigate("/ebd/shopify-pedidos")}
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
  const totalEtapas = progress.etapas.length;

  const handleEtapaClick = (etapaId: number) => {
    if (etapaId === 6) {
      setShowAniversarioDialog(true);
    } else if (etapaId === 1) {
      // Etapa 1 (Aplicar Revista):
      // - Se tem MAIS de 1 revista não aplicada → abre modal para escolher
      // - Se tem apenas 1 revista → segue o setup normal de 7 etapas (navega para rotas individuais)
      // - Se não tem revistas → vai pro catálogo
      if (revistasNaoAplicadas.length > 1) {
        setShowAplicarRevistaDialog(true);
      } else if (revistasNaoAplicadas.length === 1) {
        // Primeira revista: seguir setup de 7 etapas - ir para criar turma
        navigate("/ebd/turmas/nova");
        } else {
          navigate("/ebd/shopify-pedidos");
        }
    } else if (etapaId === 2) {
      // Cadastrar Turma
      navigate("/ebd/turmas/nova");
    } else if (etapaId === 3) {
      // Cadastrar Professor
      navigate("/ebd/teachers");
    } else if (etapaId === 4) {
      // Definir Data de Início - abrir dialog
      setShowDataInicioDialog(true);
    } else if (etapaId === 5) {
      // Criar Escala
      navigate("/ebd/schedule");
    } else if (etapaId === 7) {
      // Configurar lançamento - abrir modal
      setShowConfigLancamentoDialog(true);
    } else {
      const route = ETAPA_ROUTES[etapaId];
      if (route) navigate(route);
    }
  };

  const birthdaySchema = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida")
    .refine((val) => {
      const d = new Date(val + "T00:00:00");
      return !Number.isNaN(d.getTime());
    }, "Informe uma data válida");

  const handleSalvarAniversario = async () => {
    const parsed = birthdaySchema.safeParse(dataAniversario);
    if (!parsed.success) {
      toast.error("Data inválida", { description: parsed.error.issues[0]?.message });
      return;
    }

    try {
      await marcarEtapaAsync(6, undefined, parsed.data);
      setShowAniversarioDialog(false);
      setDataAniversario("");
    } catch (e) {
      // o toast já é exibido pelo hook; manter aqui por garantia
      const msg = e instanceof Error ? e.message : "Tente novamente.";
      toast.error("Não foi possível salvar a data", { description: msg });
    }
  };

  const handleConfigComplete = () => {
    // Refetch progress após configuração
    verificarEtapas();
  };

  return (
    <>
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 overflow-hidden relative">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <CardHeader className="pb-2 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                {progress.modoRecompra ? (
                  <RefreshCw className="h-6 w-6 text-primary" />
                ) : (
                  <Gift className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">
                  {progress.modoRecompra 
                    ? "Configure a Revista e Ganhe Desconto!" 
                    : "Complete seu Setup e Ganhe Desconto!"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {progress.modoRecompra ? (
                    <>Até <span className="font-bold text-primary">30% de desconto</span> na próxima compra</>
                  ) : (
                    <>Até <span className="font-bold text-primary">30% de desconto</span> na próxima compra + Brinde de Aniversário</>
                  )}
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
              {progress.etapas.filter((e) => e.completada).length} de {totalEtapas} etapas concluídas
            </p>
          </div>

          {/* Revistas não aplicadas (se houver múltiplas) */}
          {revistasNaoAplicadas.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {revistasNaoAplicadas.length} revista(s) aguardando configuração
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {revistasNaoAplicadas.slice(0, 3).map((revista) => (
                  <Badge key={revista.id} variant="secondary" className="text-xs">
                    {revista.titulo} ({revista.quantidade}x)
                  </Badge>
                ))}
                {revistasNaoAplicadas.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{revistasNaoAplicadas.length - 3} mais
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Etapas */}
          <div className={cn(
            "grid gap-2",
            totalEtapas <= 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-6"
          )}>
            {progress.etapas.map((etapa) => {
              const Icon = ETAPA_ICONS[etapa.id] || BookOpen;
              const isCompleta = etapa.completada;
              const isAtual = proximaEtapa?.id === etapa.id;
              
              // Para etapa 1, tentar pegar imagem da revista
              const revistaImagem = etapa.id === 1 && revistasNaoAplicadas.length > 0 
                ? revistasNaoAplicadas[0].imagemUrl 
                : null;
              
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
                    "h-10 w-10 rounded-full flex items-center justify-center overflow-hidden",
                    isCompleta 
                      ? "bg-green-500/20" 
                      : isAtual 
                      ? "bg-primary/20" 
                      : "bg-muted"
                  )}>
                    {isCompleta ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : revistaImagem ? (
                      <img 
                        src={revistaImagem} 
                        alt="Revista" 
                        className="h-full w-full object-cover"
                      />
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
                    const Icon = ETAPA_ICONS[proximaEtapa.id] || BookOpen;
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
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t flex-wrap">
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
            {!progress.modoRecompra && (
              <span className="flex items-center gap-1">
                <Cake className="h-3 w-3" />
                Aniversário: <strong className="text-foreground">R$50</strong>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para informar data de aniversário */}
      <Dialog open={showAniversarioDialog} onOpenChange={setShowAniversarioDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cake className="h-5 w-5 text-pink-500" />
              Informe sua Data de Aniversário
            </DialogTitle>
            <DialogDescription>
              Ao informar sua data de aniversário, você ganhará um cupom especial de <strong>R$ 50,00</strong> de desconto para usar em qualquer produto da Editora no dia do seu aniversário!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="data-aniversario">Data de Aniversário</Label>
            <Input
              id="data-aniversario"
              type="date"
              value={dataAniversario}
              onChange={(e) => setDataAniversario(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAniversarioDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarAniversario} disabled={!dataAniversario}>
              <Gift className="h-4 w-4 mr-2" />
              Salvar e Ganhar Cupom
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Configurar Lançamento */}
      {churchId && (
        <ConfigurarLancamentoDialog
          open={showConfigLancamentoDialog}
          onOpenChange={setShowConfigLancamentoDialog}
          churchId={churchId}
        />
      )}

      {/* Dialog integrado para configurar revista */}
      <AplicarRevistaDialog
        open={showAplicarRevistaDialog}
        onOpenChange={setShowAplicarRevistaDialog}
        churchId={churchId}
        revistasNaoAplicadas={revistasNaoAplicadas}
        onComplete={handleConfigComplete}
        marcarEtapa={marcarEtapa}
      />

      {/* Dialog: Definir Data de Início */}
      <DefinirDataInicioDialog
        open={showDataInicioDialog}
        onOpenChange={setShowDataInicioDialog}
        churchId={churchId}
        revista={revistaParaDataInicio}
        onComplete={handleConfigComplete}
      />
    </>
  );
}
