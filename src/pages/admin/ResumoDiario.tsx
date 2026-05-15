import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format, subDays, startOfDay, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  CalendarIcon,
  MessageCircle,
  BookOpen,
  Library,
  Smartphone,
  Package,
  ArrowRight,
  Users,
  TrendingUp,
  TrendingDown,
  Inbox,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(v || 0);

type CanalKey =
  | "faturados"
  | "mercado_pago"
  | "ecommerce"
  | "balcao_penha"
  | "shopee"
  | "mercado_livre";

const CANAIS: {
  key: CanalKey;
  label: string;
  bg: string;
  text: string;
  value: string;
}[] = [
  { key: "faturados", label: "Faturados", bg: "bg-teal-50", text: "text-teal-800", value: "text-teal-900" },
  { key: "mercado_pago", label: "Mercado Pago", bg: "bg-purple-50", text: "text-purple-800", value: "text-purple-900" },
  { key: "ecommerce", label: "E-commerce", bg: "bg-blue-50", text: "text-blue-800", value: "text-blue-900" },
  { key: "balcao_penha", label: "Balcão Penha", bg: "bg-emerald-50", text: "text-emerald-800", value: "text-emerald-900" },
  { key: "shopee", label: "Shopee", bg: "bg-orange-50", text: "text-orange-800", value: "text-orange-900" },
  { key: "mercado_livre", label: "Mercado Livre", bg: "bg-amber-50", text: "text-amber-800", value: "text-amber-900" },
];

interface CanalStat { total: number; pedidos: number }
interface VendedorTop { id?: string; nome: string; foto_url?: string | null; pedidos: number; total: number }
interface MixItem { unidades: number; total: number }
interface ResumoData {
  totais: {
    faturamento: number;
    pedidos: number;
    ticket_medio: number;
    produtos: number;
    variacao_pct: number;
    pedidos_ontem: number;
    faturamento_ontem: number;
  };
  canais: Record<CanalKey, CanalStat>;
  vendedores_top5: VendedorTop[];
  mix_produtos: {
    revistas: MixItem;
    livros_fisicos: MixItem;
    digitais: MixItem;
    outros: MixItem;
  };
  multi_licenca: { pacotes: number; total: number };
  destaque_produto?: { titulo: string; quantidade: number } | null;
}

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function maskPhone(tel: string): string {
  const d = (tel || "").replace(/\D/g, "");
  if (d.length < 4) return tel;
  return `${tel.slice(0, tel.length - 6)}••••${tel.slice(-2)}`;
}

interface EnvioLog {
  id: string;
  telefone: string;
  status: "sucesso" | "falha";
  disparo_tipo: "manual" | "cron";
  created_at: string;
  erro_mensagem: string | null;
}

export default function ResumoDiario() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const [searchParams] = useSearchParams();

  const initialDate = (() => {
    const d = searchParams.get('d');
    if (d) {
      const parsed = parseISO(d);
      if (isValid(parsed)) return startOfDay(parsed);
    }
    return startOfDay(new Date());
  })();

  const [date, setDate] = useState<Date>(initialDate);
  const dataRef = format(date, "yyyy-MM-dd");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["resumo-diario", dataRef, isAdmin],
    queryFn: async () => {
      // Usa a função pública (acessível para anônimos e admins) — mesmos dados em ambos os casos
      const { data, error } = await supabase.rpc("get_resumo_diario_publico", { data_ref: dataRef });
      if (error) {
        toast.error("Erro ao carregar resumo", { description: error.message });
        throw error;
      }
      const raw = data as any;
      const canalKeyMap: Record<string, CanalKey> = {
        "Faturados": "faturados",
        "Mercado Pago": "mercado_pago",
        "E-commerce": "ecommerce",
        "Balcão Penha": "balcao_penha",
        "Shopee": "shopee",
        "Mercado Livre": "mercado_livre",
      };
      const canais = {} as Record<CanalKey, CanalStat>;
      (CANAIS).forEach((c) => { canais[c.key] = { total: 0, pedidos: 0 }; });
      for (const row of (raw?.canais ?? []) as Array<{ canal: string; valor: number; pedidos: number }>) {
        const k = canalKeyMap[row.canal];
        if (k) canais[k] = { total: Number(row.valor) || 0, pedidos: Number(row.pedidos) || 0 };
      }
      const mapMix = (m: any): MixItem => ({
        unidades: Number(m?.quantidade) || 0,
        total: Number(m?.valor) || 0,
      });
      const t = raw?.totais ?? {};
      const shaped: ResumoData = {
        totais: {
          faturamento: Number(t.faturamento) || 0,
          pedidos: Number(t.pedidos) || 0,
          ticket_medio: Number(t.ticket_medio) || 0,
          produtos: Number(t.produtos_vendidos ?? t.produtos) || 0,
          variacao_pct: t.variacao_percentual == null ? 0 : Number(t.variacao_percentual),
          pedidos_ontem: Number(t.pedidos_ontem) || 0,
          faturamento_ontem: Number(t.faturamento_ontem) || 0,
        },
        canais,
        vendedores_top5: ((raw?.vendedores_top5 ?? []) as any[]).map((v) => ({
          id: v.vendedor_id ?? v.id,
          nome: v.nome,
          foto_url: v.foto_url,
          pedidos: Number(v.pedidos) || 0,
          total: Number(v.valor ?? v.total) || 0,
        })),
        mix_produtos: {
          revistas: mapMix(raw?.mix_produtos?.revistas),
          livros_fisicos: mapMix(raw?.mix_produtos?.livros_fisicos),
          digitais: mapMix(raw?.mix_produtos?.digitais),
          outros: mapMix(raw?.mix_produtos?.outros),
        },
        multi_licenca: {
          pacotes: Number(raw?.multi_licenca?.pacotes) || 0,
          total: Number(raw?.multi_licenca?.valor ?? raw?.multi_licenca?.total) || 0,
        },
        destaque_produto: raw?.destaque_produto
          ? { titulo: raw.destaque_produto.titulo, quantidade: Number(raw.destaque_produto.quantidade) || 0 }
          : null,
      };
      return shaped;
    },
  });

  const { data: ativosCount } = useQuery({
    queryKey: ["resumo-destinatarios-ativos-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("resumo_diario_destinatarios")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: enviosLog } = useQuery({
    queryKey: ["resumo-envios-log", dataRef],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumo_diario_envios_log")
        .select("id, telefone, status, disparo_tipo, created_at, erro_mensagem")
        .eq("data_ref", dataRef)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as EnvioLog[];
    },
  });

  const enviarMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "enviar-resumo-diario-whatsapp",
        { body: { data_ref: dataRef, disparo_tipo: "manual" } }
      );
      if (error) throw error;
      return data as { sucesso: number; falhas: number; total_destinatarios: number; detalhes?: any[] };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["resumo-envios-log", dataRef] });
      const { sucesso = 0, falhas = 0 } = res || ({} as any);
      if (falhas === 0 && sucesso > 0) {
        toast.success(`Resumo enviado para ${sucesso} ${sucesso === 1 ? "destinatário" : "destinatários"}`);
      } else if (sucesso > 0 && falhas > 0) {
        toast.warning(`${sucesso} enviado(s), ${falhas} com falha`);
      } else {
        toast.error("Falha ao enviar", {
          description: res?.detalhes?.[0]?.erro || "Nenhum envio bem-sucedido",
        });
      }
    },
    onError: (err: any) => {
      toast.error("Falha ao enviar", { description: err?.message || "Erro desconhecido" });
    },
  });

  const handleClickEnviar = () => setConfirmOpen(true);
  const handleConfirmar = async () => {
    setConfirmOpen(false);
    await enviarMutation.mutateAsync();
  };


  const variacao = data?.totais.variacao_pct ?? 0;
  const variacaoCor =
    variacao > 0 ? "bg-green-100 text-green-800" : variacao < 0 ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700";
  const variacaoTexto =
    data?.totais.faturamento_ontem === 0
      ? "—"
      : `${variacao > 0 ? "↑" : variacao < 0 ? "↓" : "—"} ${Math.abs(variacao).toFixed(1).replace(".", ",")}% vs ontem`;

  const diffPedidos = (data?.totais.pedidos ?? 0) - (data?.totais.pedidos_ontem ?? 0);

  const mixMax = useMemo(() => {
    if (!data) return 1;
    const m = data.mix_produtos;
    return Math.max(m.revistas.total, m.livros_fisicos.total, m.digitais.total, m.outros.total, 1);
  }, [data]);

  const isEmpty = !isLoading && data && data.totais.pedidos === 0;

  const dataInicio = dataRef;
  const dataFim = dataRef;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sticky top-0 z-10 -mx-6 -mt-6 px-6 pt-6 pb-4 bg-background border-b">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Resumo diário</h1>
            <p className="text-sm text-muted-foreground capitalize">
              {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDate(startOfDay(new Date()))}>
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDate(startOfDay(subDays(new Date(), 1)))}>
              Ontem
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(date, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(startOfDay(d))}
                  disabled={(d) => d > new Date() || d < subDays(new Date(), 90)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              onClick={handleClickEnviar}
              disabled={enviarMutation.isPending}
              className="gap-2"
            >
              {enviarMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              Enviar diretoria
            </Button>
          </div>
        </div>
        <div className="mt-2">
          <Link
            to="/admin/resumo-diario/destinatarios"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Gerenciar destinatários
          </Link>
        </div>
      </div>

      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            Não foi possível carregar o resumo. Tente novamente.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : isEmpty ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <Inbox className="h-12 w-12 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              Nenhuma venda registrada em {format(date, "dd/MM/yyyy")}
            </p>
          </CardContent>
        </Card>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-bold">{brl(data.totais.faturamento)}</div>
                <Badge variant="secondary" className={cn("font-normal", variacaoCor)}>
                  {variacao > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : variacao < 0 ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
                  {variacaoTexto}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-bold">{fmtNum(data.totais.pedidos)}</div>
                <p className="text-xs text-muted-foreground">
                  {diffPedidos > 0 ? "+" : ""}
                  {fmtNum(diffPedidos)} vs ontem
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ticket médio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{brl(data.totais.ticket_medio)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Produtos vendidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-bold">{fmtNum(data.totais.produtos)}</div>
                <p className="text-xs text-muted-foreground">unidades</p>
              </CardContent>
            </Card>
          </div>

          {/* Canais */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Vendas por canal</h2>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
              {CANAIS.map((c) => {
                const stat = data.canais[c.key] ?? { total: 0, pedidos: 0 };
                const isZero = stat.total === 0 && stat.pedidos === 0;
                return (
                  <div
                    key={c.key}
                    className={cn(
                      "rounded-lg p-3 border",
                      c.bg,
                      isZero && "opacity-60"
                    )}
                  >
                    <div className={cn("text-xs font-medium", c.text)}>{c.label}</div>
                    <div className={cn("text-base font-semibold mt-1", c.value)}>{brl(stat.total)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {fmtNum(stat.pedidos)} {stat.pedidos === 1 ? "pedido" : "pedidos"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top vendedores + Mix */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Top vendedores
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.vendedores_top5.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Sem vendedores com vendas no dia
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.vendedores_top5.map((v, i) => (
                      <li key={v.id ?? `${v.nome}-${i}`} className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {v.foto_url ? <AvatarImage src={v.foto_url} alt={v.nome} /> : null}
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {iniciais(v.nome) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{v.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtNum(v.pedidos)} {v.pedidos === 1 ? "pedido" : "pedidos"}
                          </p>
                        </div>
                        <div className="text-sm font-semibold tabular-nums">{brl(v.total)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mix de produtos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "revistas", label: "Revistas", icon: BookOpen, color: "bg-blue-500", item: data.mix_produtos.revistas },
                  { key: "livros_fisicos", label: "Livros físicos", icon: Library, color: "bg-green-500", item: data.mix_produtos.livros_fisicos },
                  { key: "digitais", label: "Digitais", icon: Smartphone, color: "bg-purple-500", item: data.mix_produtos.digitais },
                  { key: "outros", label: "Outros", icon: Package, color: "bg-gray-500", item: data.mix_produtos.outros },
                ].map((row) => {
                  const pct = (row.item.total / mixMax) * 100;
                  const Icon = row.icon;
                  return (
                    <div key={row.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span>{row.label}</span>
                        </div>
                        <span className="font-medium tabular-nums">
                          {fmtNum(row.item.unidades)} un · {brl(row.item.total)}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", row.color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Multi-Licença */}
          {data.multi_licenca.pacotes > 0 && (
            <Card className="border-indigo-200 bg-indigo-50/40">
              <CardContent className="py-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-indigo-800">Multi-Licença (Nova Loja)</div>
                  <div className="text-sm mt-1">
                    <span className="font-semibold">{fmtNum(data.multi_licenca.pacotes)}</span>{" "}
                    {data.multi_licenca.pacotes === 1 ? "pacote vendido" : "pacotes vendidos"} ·{" "}
                    <span className="font-semibold">{brl(data.multi_licenca.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Últimos envios */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Últimos envios
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!enviosLog || enviosLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda não enviado hoje</p>
              ) : (
                <ul className="divide-y">
                  {enviosLog.map((log) => (
                    <li key={log.id} className="flex items-center justify-between py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        {log.status === "sucesso" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                        )}
                        <span className="font-mono text-xs">{maskPhone(log.telefone)}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {log.disparo_tipo}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(log.created_at), "HH:mm:ss")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="pt-2">
            <Button variant="outline" asChild>
              <Link to={`/admin/orders?data_inicio=${dataInicio}&data_fim=${dataFim}`}>
                Ver pedidos detalhados
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          {ativosCount === 0 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Nenhum destinatário ativo</AlertDialogTitle>
                <AlertDialogDescription>
                  Cadastre destinatários para enviar o resumo diário via WhatsApp.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Fechar</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Link to="/admin/resumo-diario/destinatarios">Cadastrar destinatários</Link>
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Enviar resumo do dia?</AlertDialogTitle>
                <AlertDialogDescription>
                  O resumo de <strong>{format(date, "dd/MM/yyyy")}</strong> será enviado para{" "}
                  <strong>
                    {ativosCount ?? 0} {ativosCount === 1 ? "destinatário ativo" : "destinatários ativos"}
                  </strong>{" "}
                  via WhatsApp.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmar}>Confirmar envio</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
