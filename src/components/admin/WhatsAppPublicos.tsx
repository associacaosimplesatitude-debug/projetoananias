import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  ChevronDown,
  ChevronRight,
  Users,
  Calendar,
  Phone,
  Mail,
  Tag,
  Plus,
  MoreVertical,
  RefreshCw,
  Copy,
  Pencil,
  Trash2,
  Eye,
  UsersRound,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// =====================================================================
// Tipos
// =====================================================================

type SegmentoKey =
  | "advec"
  | "igreja_cnpj"
  | "igreja_cpf"
  | "ecommerce"
  | "licenciado_revista"
  | "pessoa_fisica"
  | "revendedor"
  | "lojista"
  | "representante";

const SEGMENTO_LABELS: Record<SegmentoKey, string> = {
  advec: "ADVEC",
  igreja_cnpj: "Igreja CNPJ",
  igreja_cpf: "Igreja CPF",
  ecommerce: "E-commerce",
  licenciado_revista: "Licenciado Revista",
  pessoa_fisica: "Pessoa Física",
  revendedor: "Revendedor",
  lojista: "Lojista",
  representante: "Representante",
};

const SEGMENTO_ORDER: SegmentoKey[] = [
  "advec",
  "igreja_cnpj",
  "igreja_cpf",
  "ecommerce",
  "licenciado_revista",
  "pessoa_fisica",
  "revendedor",
  "lojista",
  "representante",
];

type RecenciaTipo = "qualquer" | "sem_comprar_ha" | "comprou_nos_ultimos";

interface Filtros {
  segmentos: SegmentoKey[];
  segmentos_logica: "or" | "and";
  recencia_tipo: RecenciaTipo;
  recencia_dias: number;
  incluir_sem_compras: boolean;
  excluir_optout: boolean;
}

interface PublicoRow {
  id: string;
  nome: string;
  descricao: string | null;
  filtros: Filtros;
  total_calculado: number | null;
  calculado_em: string | null;
  created_at: string;
  updated_at: string;
}

const defaultFiltros: Filtros = {
  segmentos: [],
  segmentos_logica: "or",
  recencia_tipo: "qualquer",
  recencia_dias: 60,
  incluir_sem_compras: false,
  excluir_optout: true,
};

// =====================================================================
// Sub-bloco legado: Compradores de Revistas por Mês
// =====================================================================

interface Contato {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  valor_total: number;
  data_pedido: string;
  order_number: string;
  vendedor_id: string | null;
  produtos: string;
  tem_desconto: boolean;
  percentual_desconto: number | null;
}

interface PublicoMes {
  mes: string;
  total_contatos: number;
  com_desconto: number;
  sem_desconto: number;
  contatos: Contato[];
}

function CompradoresRevistasPorMes() {
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  const { data: publicos, isLoading } = useQuery({
    queryKey: ["publicos-revistas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_publicos_revistas_por_mes");
      if (error) throw error;
      return (data as unknown as PublicoMes[]) || [];
    },
  });

  const toggleMonth = (mes: string) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(mes)) next.delete(mes);
      else next.add(mes);
      return next;
    });
  };

  const formatMes = (mesStr: string) => {
    const d = new Date(mesStr);
    return format(d, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compradores de Revistas por Mês</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Compradores de Revistas por Mês
        </CardTitle>
        <CardDescription>
          Contatos únicos agrupados por mês de compra.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!publicos || publicos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum público encontrado.</p>
        ) : (
          publicos.map((pub) => {
            const isOpen = openMonths.has(pub.mes);
            return (
              <Collapsible key={pub.mes} open={isOpen} onOpenChange={() => toggleMonth(pub.mes)}>
                <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{formatMes(pub.mes)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Badge variant="secondary" className="text-sm">
                      {pub.total_contatos} contato{pub.total_contatos !== 1 ? "s" : ""}
                    </Badge>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {pub.com_desconto} com desconto
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {pub.sem_desconto} sem desconto
                    </Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border border-t-0 rounded-b-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Desconto</TableHead>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="max-w-[200px]">Produtos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pub.contatos.map((c, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{c.customer_name || "-"}</TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1 text-xs">
                                <Mail className="h-3 w-3" />
                                {c.customer_email || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1 text-xs">
                                <Phone className="h-3 w-3" />
                                {c.customer_phone || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {c.tem_desconto && c.percentual_desconto ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                                  {c.percentual_desconto}%
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Não</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{c.order_number || "-"}</TableCell>
                            <TableCell className="text-xs font-medium">
                              {c.valor_total ? formatCurrency(c.valor_total) : "-"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {c.data_pedido ? format(new Date(c.data_pedido), "dd/MM/yyyy") : "-"}
                            </TableCell>
                            <TableCell className="max-w-[200px] text-xs truncate" title={c.produtos}>
                              {c.produtos || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================================
// Helpers
// =====================================================================

function recenciaResumo(f: Filtros): string {
  if (f.recencia_tipo === "qualquer") return "Qualquer recência";
  if (f.recencia_tipo === "sem_comprar_ha")
    return `Sem comprar há ${f.recencia_dias}+ dias${f.incluir_sem_compras ? " (inclui sem compras)" : ""}`;
  return `Comprou nos últimos ${f.recencia_dias} dias`;
}

// =====================================================================
// Dialog de criação/edição
// =====================================================================

interface PublicoDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: PublicoRow | null;
  cloneFrom: PublicoRow | null;
  onSaved: () => void;
}

function PublicoDialog({ open, onOpenChange, editing, cloneFrom, onSaved }: PublicoDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(defaultFiltros);
  const [saving, setSaving] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [sample, setSample] = useState<Array<{ telefone: string; nome: string; email: string }>>([]);
  const [sampleLoading, setSampleLoading] = useState(false);

  // Init form when opening
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNome(editing.nome);
      setDescricao(editing.descricao || "");
      setFiltros({ ...defaultFiltros, ...editing.filtros });
    } else if (cloneFrom) {
      setNome(`${cloneFrom.nome} (cópia)`);
      setDescricao(cloneFrom.descricao || "");
      setFiltros({ ...defaultFiltros, ...cloneFrom.filtros });
    } else {
      setNome("");
      setDescricao("");
      setFiltros(defaultFiltros);
    }
    setPreviewCount(null);
  }, [open, editing, cloneFrom]);

  // Debounced preview count
  useEffect(() => {
    if (!open) return;
    if (filtros.segmentos.length === 0) {
      setPreviewCount(0);
      return;
    }
    setPreviewLoading(true);
    const t0 = performance.now();
    const handle = setTimeout(async () => {
      const { data, error } = await (supabase as any).rpc("whatsapp_publico_contar", {
        filtros: filtros as any,
      });
      const elapsed = performance.now() - t0;
      if (elapsed > 2000) {
        // eslint-disable-next-line no-console
        console.warn("[WhatsAppPublicos] contagem demorou", elapsed, "ms");
      }
      if (error) {
        // eslint-disable-next-line no-console
        console.error("whatsapp_publico_contar", error);
        setPreviewCount(null);
      } else {
        setPreviewCount(data as number);
      }
      setPreviewLoading(false);
    }, 500);
    return () => clearTimeout(handle);
  }, [filtros, open]);

  const toggleSegmento = (key: SegmentoKey) => {
    setFiltros((f) => {
      const has = f.segmentos.includes(key);
      const next = has ? f.segmentos.filter((s) => s !== key) : [...f.segmentos, key];
      return { ...f, segmentos: next };
    });
  };

  const verAmostra = async () => {
    setSampleLoading(true);
    setSampleOpen(true);
    const { data, error } = await (supabase as any).rpc("whatsapp_publico_materializar", {
      filtros: filtros as any,
      limite: 10,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("whatsapp_publico_materializar", error);
      setSample([]);
    } else {
      setSample((data as any) || []);
    }
    setSampleLoading(false);
  };

  const podeSalvar = nome.trim().length > 0 && filtros.segmentos.length > 0;

  const salvar = async () => {
    if (!podeSalvar || !user) return;
    setSaving(true);
    try {
      // Calcular total ao salvar
      const { data: total, error: errCount } = await (supabase as any).rpc("whatsapp_publico_contar", {
        filtros: filtros as any,
      });
      if (errCount) throw errCount;

      const payload = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        filtros: filtros as any,
        total_calculado: total as number,
        calculado_em: new Date().toISOString(),
      };

      if (editing) {
        const { error } = await (supabase as any)
          .from("whatsapp_publicos")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Público atualizado" });
      } else {
        const { error } = await (supabase as any).from("whatsapp_publicos").insert({
          ...payload,
          created_by: user.id,
        });
        if (error) throw error;
        toast({ title: "Público criado" });
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Erro ao salvar",
        description: e?.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Público" : "Novo Público"}</DialogTitle>
            <DialogDescription>
              Defina segmentos e recência de compra para gerar uma lista dinâmica de contatos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pub-nome">Nome *</Label>
              <Input
                id="pub-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Igrejas inativas 90 dias"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pub-desc">Descrição</Label>
              <Textarea
                id="pub-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Opcional"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Segmentos *</Label>
              <div className="flex flex-wrap gap-2">
                {SEGMENTO_ORDER.map((key) => {
                  const active = filtros.segmentos.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSegmento(key)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:bg-muted",
                      )}
                    >
                      {SEGMENTO_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            {filtros.segmentos.length > 1 && (
              <div className="space-y-2">
                <Label>Lógica entre segmentos</Label>
                <RadioGroup
                  value={filtros.segmentos_logica}
                  onValueChange={(v) =>
                    setFiltros((f) => ({ ...f, segmentos_logica: v as "or" | "and" }))
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="or" id="logica-or" />
                    <Label htmlFor="logica-or" className="font-normal cursor-pointer">
                      Qualquer um
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="and" id="logica-and" />
                    <Label htmlFor="logica-and" className="font-normal cursor-pointer">
                      Todos
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <div className="space-y-2">
              <Label>Recência de compra</Label>
              <RadioGroup
                value={filtros.recencia_tipo}
                onValueChange={(v) =>
                  setFiltros((f) => ({
                    ...f,
                    recencia_tipo: v as RecenciaTipo,
                    incluir_sem_compras: v === "comprou_nos_ultimos" ? false : f.incluir_sem_compras,
                  }))
                }
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="qualquer" id="rec-q" />
                  <Label htmlFor="rec-q" className="font-normal cursor-pointer">Qualquer</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sem_comprar_ha" id="rec-sem" />
                  <Label htmlFor="rec-sem" className="font-normal cursor-pointer">Sem comprar há</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="comprou_nos_ultimos" id="rec-com" />
                  <Label htmlFor="rec-com" className="font-normal cursor-pointer">Comprou nos últimos</Label>
                </div>
              </RadioGroup>
            </div>

            {filtros.recencia_tipo !== "qualquer" && (
              <div className="space-y-2">
                <Label htmlFor="pub-dias">Dias</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    id="pub-dias"
                    type="number"
                    min={1}
                    value={filtros.recencia_dias}
                    onChange={(e) =>
                      setFiltros((f) => ({ ...f, recencia_dias: Math.max(1, Number(e.target.value) || 1) }))
                    }
                    className="w-28"
                  />
                  {[30, 60, 90, 180].map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant={filtros.recencia_dias === d ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFiltros((f) => ({ ...f, recencia_dias: d }))}
                    >
                      {d}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {filtros.recencia_tipo === "sem_comprar_ha" && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="incluir-sem" className="cursor-pointer">
                    Incluir contatos sem nenhuma compra
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Trata "nunca comprou" como "há infinitos dias".
                  </p>
                </div>
                <Switch
                  id="incluir-sem"
                  checked={filtros.incluir_sem_compras}
                  onCheckedChange={(c) => setFiltros((f) => ({ ...f, incluir_sem_compras: c }))}
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="excluir-optout" className="cursor-pointer">
                  Excluir opt-outs
                </Label>
                <p className="text-xs text-muted-foreground">
                  Recomendado. Remove quem pediu para não receber mensagens.
                </p>
              </div>
              <Switch
                id="excluir-optout"
                checked={filtros.excluir_optout}
                onCheckedChange={(c) => setFiltros((f) => ({ ...f, excluir_optout: c }))}
              />
            </div>

            <Card className="bg-muted/30">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Preview</p>
                  <p className="text-3xl font-bold">
                    {previewLoading ? (
                      <Skeleton className="h-9 w-20 inline-block" />
                    ) : previewCount === null ? (
                      "—"
                    ) : (
                      previewCount.toLocaleString("pt-BR")
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">contatos atingidos</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={verAmostra}
                  disabled={filtros.segmentos.length === 0 || previewCount === 0}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver amostra (10)
                </Button>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={!podeSalvar || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sampleOpen} onOpenChange={setSampleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Amostra (10 contatos)</DialogTitle>
            <DialogDescription>
              Pré-visualização ordenada por compra mais recente.
            </DialogDescription>
          </DialogHeader>
          {sampleLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sample.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum contato encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sample.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.nome || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{c.telefone || "-"}</TableCell>
                    <TableCell className="text-xs">{c.email || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// =====================================================================
// Card do público salvo
// =====================================================================

interface PublicoCardProps {
  publico: PublicoRow;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
  onRecalculate: () => void;
  recalculating: boolean;
}

function PublicoCard({ publico, onEdit, onClone, onDelete, onRecalculate, recalculating }: PublicoCardProps) {
  const segmentos = publico.filtros?.segmentos || [];
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{publico.nome}</CardTitle>
            {publico.descricao && (
              <CardDescription className="text-xs mt-1 line-clamp-2">
                {publico.descricao}
              </CardDescription>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onClone}>
                <Copy className="h-4 w-4 mr-2" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRecalculate} disabled={recalculating}>
                <RefreshCw className={cn("h-4 w-4 mr-2", recalculating && "animate-spin")} /> Recalcular
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Badge variant="secondary" className="text-2xl px-3 py-1 font-bold">
            {publico.total_calculado?.toLocaleString("pt-BR") ?? "—"}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">
            {publico.calculado_em
              ? `Atualizado ${formatDistanceToNow(new Date(publico.calculado_em), { addSuffix: true, locale: ptBR })}`
              : "Nunca calculado"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {segmentos.length === 0 ? (
            <Badge variant="outline" className="text-xs">Sem segmentos</Badge>
          ) : (
            segmentos.map((s) => (
              <Badge key={s} variant="outline" className="text-xs">
                {SEGMENTO_LABELS[s as SegmentoKey] || s}
              </Badge>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground">{recenciaResumo(publico.filtros)}</p>
      </CardContent>
    </Card>
  );
}

// =====================================================================
// Componente principal
// =====================================================================

export default function WhatsAppPublicos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isSuperadmin } = useIsSuperadmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PublicoRow | null>(null);
  const [cloneFrom, setCloneFrom] = useState<PublicoRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PublicoRow | null>(null);
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);

  const { data: publicos, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-publicos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_publicos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PublicoRow[];
    },
  });

  const openNovo = () => {
    setEditing(null);
    setCloneFrom(null);
    setDialogOpen(true);
  };
  const openEditar = (p: PublicoRow) => {
    setEditing(p);
    setCloneFrom(null);
    setDialogOpen(true);
  };
  const openDuplicar = (p: PublicoRow) => {
    setEditing(null);
    setCloneFrom(p);
    setDialogOpen(true);
  };

  const recalcular = async (p: PublicoRow) => {
    setRecalculatingId(p.id);
    const { error } = await (supabase as any).rpc("whatsapp_publico_recalcular", {
      publico_id: p.id,
    });
    setRecalculatingId(null);
    if (error) {
      toast({ title: "Erro ao recalcular", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Público recalculado" });
      qc.invalidateQueries({ queryKey: ["whatsapp-publicos"] });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase as any)
      .from("whatsapp_publicos")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Público excluído" });
      qc.invalidateQueries({ queryKey: ["whatsapp-publicos"] });
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Públicos Personalizados */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UsersRound className="h-5 w-5" />
                Públicos Personalizados
              </CardTitle>
              <CardDescription>
                Listas dinâmicas de contatos filtradas por segmento e recência, prontas para campanhas.
              </CardDescription>
            </div>
            <Button onClick={openNovo}>
              <Plus className="h-4 w-4 mr-2" /> Novo Público
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-44 w-full" />
              ))}
            </div>
          ) : !publicos || publicos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <UsersRound className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-1">Nenhum público criado ainda</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Crie seu primeiro público para segmentar contatos por tipo de cliente e atividade recente.
              </p>
              <Button onClick={openNovo}>
                <Plus className="h-4 w-4 mr-2" /> Criar primeiro público
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicos.map((p) => (
                <PublicoCard
                  key={p.id}
                  publico={p}
                  onEdit={() => openEditar(p)}
                  onClone={() => openDuplicar(p)}
                  onDelete={() => setDeleteTarget(p)}
                  onRecalculate={() => recalcular(p)}
                  recalculating={recalculatingId === p.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sub-bloco legado - visível apenas para superadmin */}
      {isSuperadmin && <CompradoresRevistasPorMes />}

      <PublicoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        cloneFrom={cloneFrom}
        onSaved={() => refetch()}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir público?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O público "{deleteTarget?.nome}" será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
