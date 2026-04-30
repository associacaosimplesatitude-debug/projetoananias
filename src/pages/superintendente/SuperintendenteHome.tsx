import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BookOpen,
  UserCheck,
  Sparkles,
  Activity,
  ExternalLink,
  Search,
  LayoutGrid,
  LayoutList,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
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
import {
  CapaPlaceholder,
  tipoLabel,
  tipoBadgeClass,
} from "@/components/superintendente/CapaPlaceholder";
import { cn } from "@/lib/utils";

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
  titulo: string | null;
  tipo_conteudo: string | null;
  capa_url: string | null;
  revista_professor_titulo: string | null;
}

type ViewMode = "grid" | "list";
type TipoFilter = "todos" | "revista" | "livro_digital" | "infografico";

const VIEW_MODE_KEY = "multi-licenca-view-mode";

export default function SuperintendenteHome() {
  const { clienteId, isLoading: loadingSE } = useSuperintendente();
  const qc = useQueryClient();
  const [distribuirOpen, setDistribuirOpen] = useState<string | null>(null);
  const [drawerPacoteId, setDrawerPacoteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Hidratar viewMode do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      if (saved === "grid" || saved === "list") setViewMode(saved);
    } catch {
      // ignora
    }
  }, []);

  const handleViewModeChange = (v: string) => {
    if (v !== "grid" && v !== "list") return;
    setViewMode(v);
    try {
      localStorage.setItem(VIEW_MODE_KEY, v);
    } catch {
      // ignora
    }
  };

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

      // Buscar dados das revistas (titulo, tipo_conteudo, capa_url)
      const revistaIds = Array.from(
        new Set(
          list.flatMap((l) =>
            [l.revista_aluno_id, l.revista_professor_id, l.revista_id].filter(
              (x) => !!x
            ) as string[]
          )
        )
      );
      const revistaInfo: Record<
        string,
        { titulo: string; tipo_conteudo: string | null; capa_url: string | null }
      > = {};
      if (revistaIds.length > 0) {
        const { data: revs } = await supabase
          .from("revistas_digitais")
          .select("id, titulo, tipo_conteudo, capa_url")
          .in("id", revistaIds);
        (revs || []).forEach((r: any) => {
          revistaInfo[r.id] = {
            titulo: r.titulo,
            tipo_conteudo: r.tipo_conteudo,
            capa_url: r.capa_url,
          };
        });
      }

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

        // Pega a info principal do pacote da revista do aluno (ou revista_id, ou professor)
        const principalId = l.revista_aluno_id || l.revista_id || l.revista_professor_id;
        const principal = principalId ? revistaInfo[principalId] : null;
        const profInfo = l.revista_professor_id
          ? revistaInfo[l.revista_professor_id]
          : null;

        result.push({
          ...l,
          alunos_count: (alunos || []).length,
          ativados_count: ativados,
          titulo: principal?.titulo ?? null,
          tipo_conteudo: principal?.tipo_conteudo ?? null,
          capa_url: principal?.capa_url ?? null,
          revista_professor_titulo:
            l.revista_aluno_id && profInfo ? profInfo.titulo : null,
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

  // Contagens por tipo (só pacotes com revista vinculada)
  const counts = useMemo(() => {
    const list = pacotes || [];
    const vinculados = list.filter(
      (p) => !!(p.revista_aluno_id || p.revista_id || p.revista_professor_id)
    );
    return {
      todos: list.length,
      revista: vinculados.filter((p) => p.tipo_conteudo === "revista").length,
      livro_digital: vinculados.filter((p) => p.tipo_conteudo === "livro_digital")
        .length,
      infografico: vinculados.filter((p) => p.tipo_conteudo === "infografico").length,
    };
  }, [pacotes]);

  // Pacotes filtrados (tipo + busca)
  const pacotesFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (pacotes || []).filter((p) => {
      if (tipoFilter !== "todos" && p.tipo_conteudo !== tipoFilter) return false;
      if (term && !(p.titulo || "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [pacotes, tipoFilter, search]);

  const onPoolChanged = () => {
    qc.invalidateQueries({ queryKey: ["superintendente", "pacotes", clienteId] });
  };

  const filtroAtivo = tipoFilter !== "todos" || search.trim().length > 0;
  const limparFiltros = () => {
    setTipoFilter("todos");
    setSearch("");
  };

  const pacoteAtual = useMemo(
    () => (pacotes || []).find((p) => p.id === drawerPacoteId) || null,
    [pacotes, drawerPacoteId]
  );

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

  const totalPacotes = (pacotes || []).length;

  return (
    <div className="space-y-6">
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

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Meus Pacotes</h2>
        </div>

        {/* Empty state quando nenhum pacote existe */}
        {!loadingPacotes && totalPacotes === 0 && (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Você ainda não tem nenhum pacote ativo. Compre na loja Editora Central
                Gospel para começar.
              </p>
              <Button asChild variant="default">
                <a
                  href="https://centralgospel.com.br/multi-licenca"
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

        {/* Barra de filtros */}
        {!loadingPacotes && totalPacotes > 0 && (
          <>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <Tabs
                value={tipoFilter}
                onValueChange={(v) => setTipoFilter(v as TipoFilter)}
                className="w-full md:w-auto"
              >
                <TabsList className="flex flex-wrap h-auto">
                  <TabsTrigger value="todos" className="gap-2">
                    Todos
                    <Badge variant="secondary" className="h-5 px-1.5">
                      {counts.todos}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="revista" className="gap-2">
                    Revistas
                    <Badge variant="secondary" className="h-5 px-1.5">
                      {counts.revista}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="livro_digital" className="gap-2">
                    Livros
                    <Badge variant="secondary" className="h-5 px-1.5">
                      {counts.livro_digital}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="infografico" className="gap-2">
                    Infográficos
                    <Badge variant="secondary" className="h-5 px-1.5">
                      {counts.infografico}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar pacote por título..."
                    className="pl-8"
                  />
                </div>
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(v) => v && handleViewModeChange(v)}
                  className="hidden md:flex"
                >
                  <ToggleGroupItem value="grid" aria-label="Visualização em grade">
                    <LayoutGrid className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="Visualização em lista">
                    <LayoutList className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {filtroAtivo && (
              <p className="text-sm text-muted-foreground">
                Mostrando {pacotesFiltrados.length}{" "}
                {pacotesFiltrados.length === 1
                  ? "pacote filtrado"
                  : "pacotes filtrados"}{" "}
                (de {totalPacotes} totais)
              </p>
            )}
          </>
        )}

        {loadingPacotes && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        )}

        {/* Empty state após filtro */}
        {!loadingPacotes &&
          totalPacotes > 0 &&
          pacotesFiltrados.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Nenhum pacote nesta categoria.
                </p>
                <Button variant="outline" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              </CardContent>
            </Card>
          )}

        {/* Lista de pacotes */}
        {!loadingPacotes && pacotesFiltrados.length > 0 && (
          <>
            {/* Mobile: sempre Grid 1 col. Desktop: respeita viewMode. */}
            <div
              className={cn(
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
                  : "grid grid-cols-1 md:flex md:flex-col gap-3"
              )}
            >
              {pacotesFiltrados.map((p) =>
                viewMode === "list" ? (
                  <PacoteCardLista
                    key={p.id}
                    pacote={p}
                    onOpenDrawer={() => setDrawerPacoteId(p.id)}
                    onDistribuir={() => setDistribuirOpen(p.id)}
                  />
                ) : (
                  <PacoteCardGrid
                    key={p.id}
                    pacote={p}
                    onOpenDrawer={() => setDrawerPacoteId(p.id)}
                    onDistribuir={() => setDistribuirOpen(p.id)}
                  />
                )
              )}
            </div>
          </>
        )}
      </div>

      {/* Drawer de detalhes */}
      <Sheet
        open={!!drawerPacoteId}
        onOpenChange={(o) => !o && setDrawerPacoteId(null)}
      >
        <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col">
          {pacoteAtual && (
            <PacoteDrawerContent
              pacote={pacoteAtual}
              onDistribuir={() => setDistribuirOpen(pacoteAtual.id)}
              onPoolChanged={onPoolChanged}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog de distribuir */}
      {distribuirOpen &&
        (() => {
          const p = (pacotes || []).find((x) => x.id === distribuirOpen);
          if (!p) return null;
          const disponiveis = Math.max(
            0,
            p.quantidade_total - p.quantidade_usada
          );
          return (
            <DistribuirLicencaDialog
              licencaId={p.id}
              revistaTitulo={p.titulo || "Pacote sem revista vinculada"}
              disponiveis={disponiveis}
              open={true}
              onOpenChange={(o) => !o && setDistribuirOpen(null)}
              onSuccess={() => {
                onPoolChanged();
                qc.invalidateQueries({
                  queryKey: ["superintendente", "alunos", p.id],
                });
              }}
            />
          );
        })()}
    </div>
  );
}

/* ============================================================
 * Helpers de pacote
 * ============================================================ */

function getPacoteDerivados(p: PacoteRow) {
  const inconsistente = p.quantidade_usada > p.quantidade_total;
  const disponiveis = Math.max(0, p.quantidade_total - p.quantidade_usada);
  const pct = inconsistente
    ? 100
    : p.quantidade_total > 0
    ? Math.round((p.quantidade_usada / p.quantidade_total) * 100)
    : 0;
  const esgotado = p.quantidade_usada >= p.quantidade_total;
  const semRevista = !p.revista_aluno_id && !p.revista_id && !p.revista_professor_id;
  const titulo = semRevista
    ? "Pacote sem revista vinculada"
    : p.titulo || "Revista Digital";
  return { inconsistente, disponiveis, pct, esgotado, semRevista, titulo };
}

/* ============================================================
 * Card Grid
 * ============================================================ */

function PacoteCardGrid({
  pacote,
  onOpenDrawer,
  onDistribuir,
}: {
  pacote: PacoteRow;
  onOpenDrawer: () => void;
  onDistribuir: () => void;
}) {
  const { inconsistente, disponiveis, pct, esgotado, semRevista, titulo } =
    getPacoteDerivados(pacote);

  return (
    <Card
      onClick={onOpenDrawer}
      className="cursor-pointer hover:shadow-md transition flex flex-col overflow-hidden"
    >
      {pacote.capa_url && !semRevista ? (
        <img
          src={pacote.capa_url}
          alt={titulo}
          className="w-full h-[200px] object-cover"
          loading="lazy"
        />
      ) : (
        <CapaPlaceholder tipo={pacote.tipo_conteudo} size="lg" />
      )}

      <CardContent className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {semRevista ? (
            <Badge variant="outline">Sem produto</Badge>
          ) : (
            <Badge
              variant="outline"
              className={tipoBadgeClass(pacote.tipo_conteudo)}
            >
              {tipoLabel(pacote.tipo_conteudo)}
            </Badge>
          )}
          {inconsistente && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Atenção: dados inconsistentes
            </Badge>
          )}
        </div>

        <h3 className="text-base font-semibold line-clamp-2">{titulo}</h3>

        <div className="space-y-1">
          <Progress value={pct} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {inconsistente
              ? `${pacote.alunos_count} ${
                  pacote.alunos_count === 1 ? "leitor" : "leitores"
                }`
              : `${pacote.quantidade_usada} de ${pacote.quantidade_total} ${
                  pacote.quantidade_total === 1 ? "leitor" : "leitores"
                }`}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          {pacote.expira_em
            ? `Expira em ${format(new Date(pacote.expira_em), "dd/MM/yyyy", {
                locale: ptBR,
              })}`
            : "Vitalício"}
        </p>

        <div className="mt-auto pt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block w-full">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDistribuir();
                    }}
                    disabled={esgotado || pacote.status !== "ativa" || semRevista}
                    className="w-full"
                    style={{ backgroundColor: "#1B3A5C", color: "white" }}
                  >
                    Distribuir Licença
                  </Button>
                </span>
              </TooltipTrigger>
              {esgotado && <TooltipContent>Pool esgotado</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================================
 * Card Lista
 * ============================================================ */

function PacoteCardLista({
  pacote,
  onOpenDrawer,
  onDistribuir,
}: {
  pacote: PacoteRow;
  onOpenDrawer: () => void;
  onDistribuir: () => void;
}) {
  const { inconsistente, disponiveis, pct, esgotado, semRevista, titulo } =
    getPacoteDerivados(pacote);

  return (
    <Card
      onClick={onOpenDrawer}
      className="cursor-pointer hover:bg-accent/50 transition"
    >
      <CardContent className="p-3 flex flex-row items-center gap-3">
        {pacote.capa_url && !semRevista ? (
          <img
            src={pacote.capa_url}
            alt={titulo}
            className="h-20 w-[60px] object-cover rounded-md shrink-0"
            loading="lazy"
          />
        ) : (
          <CapaPlaceholder tipo={pacote.tipo_conteudo} size="sm" />
        )}

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {semRevista ? (
              <Badge variant="outline">Sem produto</Badge>
            ) : (
              <Badge
                variant="outline"
                className={tipoBadgeClass(pacote.tipo_conteudo)}
              >
                {tipoLabel(pacote.tipo_conteudo)}
              </Badge>
            )}
            <h3 className="text-base font-semibold truncate">{titulo}</h3>
            {inconsistente && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Inconsistente
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {pacote.expira_em
              ? `Expira em ${format(new Date(pacote.expira_em), "dd/MM/yyyy", {
                  locale: ptBR,
                })}`
              : "Vitalício"}
            {pacote.inicio_em &&
              ` · Início ${format(new Date(pacote.inicio_em), "dd/MM/yyyy", {
                locale: ptBR,
              })}`}
          </p>
          <div className="flex items-center gap-2">
            <Progress value={pct} className="h-2 flex-1" />
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {inconsistente
                ? `${pacote.alunos_count} leitores`
                : `${pacote.quantidade_usada} de ${pacote.quantidade_total} · ${disponiveis} disponíveis`}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDistribuir();
          }}
          disabled={esgotado || pacote.status !== "ativa" || semRevista}
          style={{ backgroundColor: "#1B3A5C", color: "white" }}
          className="shrink-0"
        >
          Distribuir Licença
        </Button>
      </CardContent>
    </Card>
  );
}

/* ============================================================
 * Drawer Content
 * ============================================================ */

function PacoteDrawerContent({
  pacote,
  onDistribuir,
  onPoolChanged,
}: {
  pacote: PacoteRow;
  onDistribuir: () => void;
  onPoolChanged: () => void;
}) {
  const { inconsistente, disponiveis, pct, esgotado, semRevista, titulo } =
    getPacoteDerivados(pacote);

  return (
    <>
      <SheetHeader className="space-y-3">
        <div className="flex items-start gap-3">
          {pacote.capa_url && !semRevista ? (
            <img
              src={pacote.capa_url}
              alt={titulo}
              className="h-20 w-[60px] object-cover rounded-md shrink-0"
            />
          ) : (
            <CapaPlaceholder tipo={pacote.tipo_conteudo} size="sm" />
          )}
          <div className="flex-1 min-w-0 space-y-1.5">
            <SheetTitle className="text-left text-lg leading-tight">
              {titulo}
            </SheetTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {semRevista ? (
                <Badge variant="outline">Sem produto</Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={tipoBadgeClass(pacote.tipo_conteudo)}
                >
                  {tipoLabel(pacote.tipo_conteudo)}
                </Badge>
              )}
              <Badge
                variant={pacote.status === "ativa" ? "default" : "outline"}
                className={
                  pacote.status === "ativa"
                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200"
                    : ""
                }
              >
                {pacote.status}
              </Badge>
              {inconsistente && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Dados inconsistentes
                </Badge>
              )}
            </div>
          </div>
        </div>
      </SheetHeader>

      <div className="space-y-4 py-4 flex-1">
        <div className="space-y-2">
          <Progress value={pct} className="h-3" />
          <p className="text-sm text-muted-foreground">
            {inconsistente ? (
              <>
                <strong className="text-foreground">{pacote.alunos_count}</strong>{" "}
                leitores cadastrados (pool informado: {pacote.quantidade_total})
              </>
            ) : (
              <>
                <strong className="text-foreground">{pacote.quantidade_usada}</strong>{" "}
                distribuídas de{" "}
                <strong className="text-foreground">{pacote.quantidade_total}</strong>{" "}
                · {disponiveis} disponíveis ·{" "}
                <strong className="text-foreground">{pacote.ativados_count}</strong>{" "}
                ativados
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Início:{" "}
            {pacote.inicio_em
              ? format(new Date(pacote.inicio_em), "dd/MM/yyyy", { locale: ptBR })
              : "—"}{" "}
            · Expiração:{" "}
            {pacote.expira_em
              ? format(new Date(pacote.expira_em), "dd/MM/yyyy", { locale: ptBR })
              : "Vitalício"}
          </p>
        </div>

        <Button
          onClick={onDistribuir}
          disabled={esgotado || pacote.status !== "ativa" || semRevista}
          className="w-full"
          style={{ backgroundColor: "#1B3A5C", color: "white" }}
        >
          Distribuir Licença
        </Button>

        <div className="border-t pt-4">
          <AlunosLista licencaId={pacote.id} onPoolChanged={onPoolChanged} />
        </div>
      </div>

      <SheetFooter>
        <SheetClose asChild>
          <Button variant="outline" className="w-full sm:w-auto">
            Fechar
          </Button>
        </SheetClose>
      </SheetFooter>
    </>
  );
}

/* ============================================================
 * KPI Card
 * ============================================================ */

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
