import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BookOpen,
  UserCheck,
  Sparkles,
  Activity,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useSuperintendente } from "@/hooks/useSuperintendente";
import { DistribuirLicencaDialog } from "@/components/superintendente/DistribuirLicencaDialog";
import { AlunosLista } from "@/components/superintendente/AlunosLista";

interface PacoteRow {
  id: string;
  plano: string;
  status: string;
  quantidade_total: number;
  quantidade_usada: number;
  inicio_em: string | null;
  expira_em: string | null;
  revista_aluno_id: string | null;
  revista_professor_id: string | null;
  revista_id: string | null;
  alunos_count: number;
  ativados_count: number;
  revista_aluno_titulo: string | null;
  revista_professor_titulo: string | null;
}

export default function SuperintendenteHome() {
  const { nomeSuperintendente, nomeIgreja, clienteId, isLoading: loadingSE } =
    useSuperintendente();
  const qc = useQueryClient();
  const [distribuirOpen, setDistribuirOpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const primeiroNome = (nomeSuperintendente || "").split(" ")[0] || "Superintendente";

  const { data: pacotes, isLoading: loadingPacotes } = useQuery({
    queryKey: ["superintendente", "pacotes", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<PacoteRow[]> => {
      const { data: lics, error } = await supabase
        .from("revista_licencas")
        .select(
          "id, plano, status, quantidade_total, quantidade_usada, inicio_em, expira_em, revista_aluno_id, revista_professor_id, revista_id"
        )
        .eq("superintendente_id", clienteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = lics || [];

      // Buscar títulos das revistas
      const revistaIds = Array.from(
        new Set(
          list.flatMap((l) =>
            [l.revista_aluno_id, l.revista_professor_id, l.revista_id].filter(
              (x) => !!x
            ) as string[]
          )
        )
      );
      let revistaTitulos: Record<string, string> = {};
      if (revistaIds.length > 0) {
        const { data: revs } = await supabase
          .from("revistas_digitais")
          .select("id, titulo")
          .in("id", revistaIds);
        (revs || []).forEach((r: any) => {
          revistaTitulos[r.id] = r.titulo;
        });
      }

      // Buscar contagem de alunos por pacote + ativados (via shopify primeiro_acesso_em)
      const result: PacoteRow[] = [];
      for (const l of list) {
        const { data: alunos } = await supabase
          .from("revista_licenca_alunos")
          .select("id")
          .eq("licenca_id", l.id);

        let ativados = 0;
        const alunosIds = (alunos || []).map((a: any) => a.id);
        if (alunosIds.length > 0) {
          const orderIds = alunosIds.map((id) => `SE-${id}`);
          const { data: shop } = await supabase
            .from("revista_licencas_shopify")
            .select("primeiro_acesso_em")
            .in("shopify_order_id", orderIds)
            .not("primeiro_acesso_em", "is", null);
          ativados = (shop || []).length;
        }

        result.push({
          ...l,
          alunos_count: (alunos || []).length,
          ativados_count: ativados,
          revista_aluno_titulo: l.revista_aluno_id
            ? revistaTitulos[l.revista_aluno_id] || null
            : null,
          revista_professor_titulo: l.revista_professor_id
            ? revistaTitulos[l.revista_professor_id] || null
            : null,
        });
      }
      return result;
    },
  });

  const kpis = useMemo(() => {
    const ativos = (pacotes || []).filter((p) => p.status === "ativa");
    const total = ativos.reduce((s, p) => s + p.quantidade_total, 0);
    const usadas = ativos.reduce((s, p) => s + p.quantidade_usada, 0);
    const ativados = ativos.reduce((s, p) => s + p.ativados_count, 0);
    return {
      total,
      usadas,
      disponiveis: Math.max(0, total - usadas),
      ativados,
    };
  }, [pacotes]);

  const onPoolChanged = () => {
    qc.invalidateQueries({ queryKey: ["superintendente", "pacotes", clienteId] });
  };

  const toggleExpand = (id: string) =>
    setExpanded((s) => ({ ...s, [id]: !s[id] }));

  if (loadingSE) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Olá, {primeiroNome}!
        </h1>
        {nomeIgreja && (
          <p className="text-sm text-muted-foreground mt-1">{nomeIgreja}</p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Total de licenças"
          value={kpis.total}
          color="bg-[#1B3A5C] text-white"
        />
        <KpiCard
          icon={<UserCheck className="h-5 w-5" />}
          label="Distribuídas"
          value={kpis.usadas}
          color="bg-amber-500 text-white"
        />
        <KpiCard
          icon={<Sparkles className="h-5 w-5" />}
          label="Disponíveis"
          value={kpis.disponiveis}
          color="bg-emerald-600 text-white"
        />
        <KpiCard
          icon={<Activity className="h-5 w-5" />}
          label="Ativados"
          value={kpis.ativados}
          color="bg-sky-600 text-white"
        />
      </div>

      {/* Pacotes */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Meus Pacotes</h2>

        {loadingPacotes && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        )}

        {!loadingPacotes && (!pacotes || pacotes.length === 0) && (
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Você ainda não tem nenhum Plano Superintendente ativo.
              </p>
              <Button asChild variant="default">
                <a
                  href="https://centralgospel.com.br/superintendente"
                  target="_blank"
                  rel="noreferrer"
                >
                  Comprar agora
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loadingPacotes &&
          (pacotes || []).map((p) => {
            const disponiveis = Math.max(0, p.quantidade_total - p.quantidade_usada);
            const pct =
              p.quantidade_total > 0
                ? Math.round((p.quantidade_usada / p.quantidade_total) * 100)
                : 0;
            const esgotado = p.quantidade_usada >= p.quantidade_total;
            const titulo =
              p.revista_aluno_titulo ||
              p.revista_professor_titulo ||
              "Revista Digital";
            const isExpanded = !!expanded[p.id];

            return (
              <Card key={p.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <CardTitle className="text-base md:text-lg">{titulo}</CardTitle>
                      {p.revista_aluno_titulo && p.revista_professor_titulo && (
                        <p className="text-xs text-muted-foreground mt-1">
                          + {p.revista_professor_titulo}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={p.status === "ativa" ? "default" : "outline"}
                        className={
                          p.status === "ativa"
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200"
                            : ""
                        }
                      >
                        {p.status}
                      </Badge>
                      <Badge variant="outline">
                        {p.expira_em
                          ? `Expira ${format(new Date(p.expira_em), "dd/MM/yyyy", { locale: ptBR })}`
                          : "Vitalício"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Progress value={pct} className="h-2" />
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">{p.quantidade_usada}</strong>{" "}
                      de{" "}
                      <strong className="text-foreground">{p.quantidade_total}</strong>{" "}
                      licenças distribuídas — {disponiveis}{" "}
                      {disponiveis === 1 ? "disponível" : "disponíveis"}
                    </p>
                    {p.inicio_em && (
                      <p className="text-xs text-muted-foreground">
                        Início:{" "}
                        {format(new Date(p.inicio_em), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block">
                            <Button
                              onClick={() => setDistribuirOpen(p.id)}
                              disabled={esgotado || p.status !== "ativa"}
                              className="w-full sm:w-auto"
                              style={{ backgroundColor: "#1B3A5C", color: "white" }}
                            >
                              Distribuir Licença
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {esgotado && (
                          <TooltipContent>Pool esgotado</TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>

                    <Button
                      variant="outline"
                      onClick={() => toggleExpand(p.id)}
                      className="w-full sm:w-auto"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 mr-2" />
                      ) : (
                        <ChevronDown className="h-4 w-4 mr-2" />
                      )}
                      Ver alunos ({p.alunos_count})
                    </Button>
                  </div>

                  {isExpanded && (
                    <AlunosLista licencaId={p.id} onPoolChanged={onPoolChanged} />
                  )}
                </CardContent>

                {distribuirOpen === p.id && (
                  <DistribuirLicencaDialog
                    licencaId={p.id}
                    revistaTitulo={titulo}
                    disponiveis={disponiveis}
                    open={distribuirOpen === p.id}
                    onOpenChange={(o) => !o && setDistribuirOpen(null)}
                    onSuccess={() => {
                      onPoolChanged();
                      qc.invalidateQueries({
                        queryKey: ["superintendente", "alunos", p.id],
                      });
                    }}
                  />
                )}
              </Card>
            );
          })}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-md flex items-center justify-center ${color}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
