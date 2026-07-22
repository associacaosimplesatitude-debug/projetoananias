import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, RefreshCw, Loader2, MoreVertical, Play, Pause, X, BarChart3,
  Target, Send, Calendar, AlertTriangle,
} from "lucide-react";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  agendada: { label: "Agendada", variant: "outline" },
  materializando: { label: "Materializando", variant: "outline" },
  pronta: { label: "Pronta", variant: "default" },
  processando: { label: "Processando", variant: "default" },
  pausada: { label: "Pausada", variant: "destructive" },
  concluida: { label: "Concluída", variant: "default" },
  cancelada: { label: "Cancelada", variant: "secondary" },
  erro: { label: "Erro", variant: "destructive" },
  // legacy
  enviando: { label: "Enviando", variant: "default" },
  enviada: { label: "Enviada", variant: "default" },
  ativa: { label: "Ativa", variant: "default" },
};

const DIAS_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface VarConfig {
  tipo: "fixo" | "campo";
  valor: string;
}

export default function WhatsAppCampaigns() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // ---- Queries ----
  const { data: campaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ["whatsapp-campanhas-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_campanhas")
        .select("*, whatsapp_templates(nome, corpo), whatsapp_publicos(nome, total_calculado)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: (q) => {
      const list = (q.state.data as any[]) || [];
      const active = list.some((c) => ["processando", "materializando", "agendada", "pronta", "enviando"].includes(c.status));
      return active ? 8000 : false;
    },
  });

  const { data: quietHours } = useQuery({
    queryKey: ["whatsapp-quiet-hours"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "whatsapp_quiet_hours")
        .maybeSingle();
      if (!data?.value) return null;
      try { return JSON.parse(data.value); } catch { return null; }
    },
  });

  // ---- Mutations ----
  const syncTemplates = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-sync-templates-from-meta", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Templates sincronizados${data?.total ? `: ${data.total}` : ""}`);
    } catch (e: any) {
      toast.error("Falha ao sincronizar templates: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, extra }: { id: string; status: string; extra?: any }) => {
      const patch: any = { status, ...(extra || {}) };
      if (status === "pausada") patch.pausada_em = new Date().toISOString();
      if (status === "cancelada") patch.finalizada_em = new Date().toISOString();
      const { error } = await supabase.from("whatsapp_campanhas").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-campanhas-v2"] });
      toast.success("Campanha atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("whatsapp_campanha_destinatarios").delete().eq("campanha_id", id);
      const { error } = await supabase.from("whatsapp_campanhas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-campanhas-v2"] });
      toast.success("Campanha excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Campanhas WhatsApp</h2>
          <p className="text-sm text-muted-foreground">Disparo em massa via templates aprovados Meta</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={syncTemplates} disabled={syncing} className="gap-2">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar templates Meta
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Campanha
          </Button>
        </div>
      </div>

      {loadingCampaigns ? (
        <div className="flex justify-center p-8 text-muted-foreground">Carregando...</div>
      ) : !campaigns?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <Target className="h-12 w-12 mb-4 opacity-50" />
            <p>Nenhuma campanha criada ainda.</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Criar primeira campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c: any) => (
            <CampaignCard
              key={c.id}
              campanha={c}
              onAction={(action) => {
                if (action === "delete") {
                  if (c.total_enviados > 0) {
                    toast.error("Não é possível excluir uma campanha que já enviou mensagens.");
                    return;
                  }
                  if (confirm("Excluir esta campanha?")) deleteCampaign.mutate(c.id);
                } else if (action === "pausar") {
                  updateStatus.mutate({ id: c.id, status: "pausada" });
                } else if (action === "retomar") {
                  updateStatus.mutate({ id: c.id, status: "processando" });
                } else if (action === "cancelar") {
                  if (confirm("Cancelar esta campanha?")) updateStatus.mutate({ id: c.id, status: "cancelada" });
                } else if (action === "relatorio") {
                  const base = location.pathname.startsWith("/admin/ebd") ? "/admin/ebd/marketing" : "/admin/whatsapp";
                  navigate(`${base}/campanhas/${c.id}/rastreamento`);
                }
              }}
            />
          ))}
        </div>
      )}

      <NovaCampanhaDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        quietHours={quietHours}
        onCreated={() => qc.invalidateQueries({ queryKey: ["whatsapp-campanhas-v2"] })}
      />
    </div>
  );
}

// ---- Card de campanha ----
function CampaignCard({ campanha: c, onAction }: { campanha: any; onAction: (a: string) => void }) {
  const st = STATUS_MAP[c.status] || STATUS_MAP.rascunho;
  const total = c.total_publico || 0;
  const enviados = c.total_enviados || 0;
  const erros = c.total_erros || 0;
  const progresso = total > 0 ? Math.min(100, Math.round(((enviados + erros) / total) * 100)) : 0;
  const showProgress = ["processando", "concluida", "enviando", "enviada", "pausada"].includes(c.status);
  const canPause = c.status === "processando";
  const canResume = c.status === "pausada";
  const canCancel = ["rascunho", "agendada", "pronta", "pausada", "processando"].includes(c.status);
  const canDelete = enviados === 0;
  const canReport = ["processando", "concluida", "pausada", "enviada", "enviando"].includes(c.status);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">{c.nome}</span>
              <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Público: {c.whatsapp_publicos?.nome || "—"} · Template: {c.whatsapp_templates?.nome || "—"}
            </p>
            {c.status === "agendada" && c.agendada_para && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Agendada para {format(new Date(c.agendada_para), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canReport && (
                <DropdownMenuItem onClick={() => onAction("relatorio")}>
                  <BarChart3 className="h-4 w-4 mr-2" /> Ver relatório
                </DropdownMenuItem>
              )}
              {canPause && (
                <DropdownMenuItem onClick={() => onAction("pausar")}>
                  <Pause className="h-4 w-4 mr-2" /> Pausar
                </DropdownMenuItem>
              )}
              {canResume && (
                <DropdownMenuItem onClick={() => onAction("retomar")}>
                  <Play className="h-4 w-4 mr-2" /> Retomar
                </DropdownMenuItem>
              )}
              {canCancel && (
                <DropdownMenuItem onClick={() => onAction("cancelar")}>
                  <X className="h-4 w-4 mr-2" /> Cancelar
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem className="text-destructive" onClick={() => onAction("delete")}>
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {showProgress && total > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{enviados} enviados {erros > 0 && <span className="text-destructive">· {erros} erros</span>}</span>
              <span>{enviados + erros} / {total}</span>
            </div>
            <Progress value={progresso} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Dialog Nova Campanha ----
function NovaCampanhaDialog({
  open, onClose, quietHours, onCreated,
}: {
  open: boolean; onClose: () => void; quietHours: any; onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [publicoId, setPublicoId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [varConfig, setVarConfig] = useState<Record<string, VarConfig>>({});
  const [quando, setQuando] = useState<"agora" | "agendar">("agora");
  const [agendadaPara, setAgendadaPara] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(""); setPublicoId(""); setTemplateId(""); setHeaderMediaUrl("");
      setVarConfig({}); setQuando("agora"); setAgendadaPara("");
    }
  }, [open]);

  const { data: publicos } = useQuery({
    queryKey: ["whatsapp-publicos-list"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_publicos")
        .select("id, nome, total_calculado")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["whatsapp-templates-approved-v2"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("status", "APROVADO")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const selectedTemplate = useMemo(
    () => templates?.find((t) => t.id === templateId),
    [templates, templateId]
  );

  // Detect variables {{N}} in body
  const variables = useMemo(() => {
    if (!selectedTemplate?.corpo) return [] as string[];
    const matches = selectedTemplate.corpo.match(/\{\{\d+\}\}/g) || [];
    return Array.from(new Set(matches));
  }, [selectedTemplate]);

  const previewBody = useMemo(() => {
    if (!selectedTemplate?.corpo) return null;
    const parts = selectedTemplate.corpo.split(/(\{\{\d+\}\})/g);
    return parts.map((p: string, i: number) => {
      if (/^\{\{\d+\}\}$/.test(p)) {
        return (
          <span key={i} className="inline-block px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono mx-0.5">
            {p}
          </span>
        );
      }
      return <span key={i}>{p}</span>;
    });
  }, [selectedTemplate]);

  const headerMediaType = selectedTemplate?.cabecalho_tipo &&
    ["IMAGE", "VIDEO", "DOCUMENT"].includes(selectedTemplate.cabecalho_tipo)
    ? selectedTemplate.cabecalho_tipo
    : null;

  const minDateTime = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [open]);

  const quietHoursLabel = useMemo(() => {
    if (!quietHours) return "Sempre permitido";
    const dias = (quietHours.dias_semana || []).map((d: number) => DIAS_LABEL[d - 1]).join(", ");
    return `${String(quietHours.inicio_hora).padStart(2, "0")}h–${String(quietHours.fim_hora).padStart(2, "0")}h, ${dias} (${quietHours.timezone || "America/Sao_Paulo"})`;
  }, [quietHours]);

  const handleSave = async (acao: "rascunho" | "iniciar") => {
    if (!nome.trim()) { toast.error("Informe o nome da campanha"); return; }
    if (!publicoId) { toast.error("Selecione um público"); return; }
    if (!templateId) { toast.error("Selecione um template"); return; }
    for (const v of variables) {
      const cfg = varConfig[v];
      if (!cfg) { toast.error(`Configure a variável ${v}`); return; }
      if (cfg.tipo === "fixo" && !cfg.valor.trim()) {
        toast.error(`Informe o valor fixo da variável ${v}`); return;
      }
    }
    if (headerMediaType && !headerMediaUrl.trim()) {
      toast.error(`Informe a URL pública da mídia do cabeçalho (${headerMediaType})`); return;
    }

    let status = "rascunho";
    let agendaIso: string | null = null;
    if (acao === "iniciar") {
      if (quando === "agora") {
        status = "agendada";
        agendaIso = new Date().toISOString();
      } else {
        if (!agendadaPara) { toast.error("Selecione a data e hora do agendamento"); return; }
        const d = new Date(agendadaPara);
        if (d.getTime() < Date.now() + 4 * 60 * 1000) {
          toast.error("Agendamento deve ser pelo menos 5 minutos no futuro"); return;
        }
        status = "agendada";
        agendaIso = d.toISOString();
      }
    }

    // Build template_variaveis keyed by numeric index (1..N)
    const templateVars: Record<string, VarConfig> = {};
    variables.forEach((v, i) => {
      const key = v.replace(/\{\{|\}\}/g, "").trim();
      const cfg = varConfig[v];
      if (cfg) {
        templateVars[String(i + 1)] = cfg;
        templateVars[key] = cfg;
      }
    });

    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { data: pub } = await supabase
        .from("whatsapp_publicos").select("filtros").eq("id", publicoId).single();
      const { error } = await supabase.from("whatsapp_campanhas").insert([{
        nome: nome.trim(),
        publico_id: publicoId,
        template_id: templateId,
        template_variaveis: templateVars as any,
        cabecalho_midia_url: headerMediaType ? headerMediaUrl.trim() : null,
        filtros_publico: (pub?.filtros as any) || null,
        status,
        agendada_para: agendaIso,
        created_by: user?.id,
      }]);
      if (error) throw error;
      toast.success(acao === "iniciar" ? "Campanha agendada!" : "Rascunho salvo");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova campanha</DialogTitle>
          <DialogDescription>
            Vincule um público, escolha um template aprovado da Meta e defina quando enviar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Nome da campanha *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Lançamento Set/2026" />
          </div>

          <div className="space-y-2">
            <Label>Público *</Label>
            <Select value={publicoId} onValueChange={setPublicoId}>
              <SelectTrigger><SelectValue placeholder="Selecione um público" /></SelectTrigger>
              <SelectContent>
                {(publicos || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} ({p.total_calculado ?? "?"} contatos)
                  </SelectItem>
                ))}
                {publicos && publicos.length === 0 && (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Crie um público na aba "Públicos".</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Template aprovado Meta *</Label>
            <Select value={templateId} onValueChange={(v) => { setTemplateId(v); setVarConfig({}); }}>
              <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
              <SelectContent>
                {(templates || []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome} · {t.categoria} · {t.idioma}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Pré-visualização</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {selectedTemplate.cabecalho_texto && (
                  <div className="font-semibold">{selectedTemplate.cabecalho_texto}</div>
                )}
                <div className="whitespace-pre-wrap text-foreground/90">{previewBody}</div>
                {selectedTemplate.rodape && (
                  <div className="text-xs text-muted-foreground mt-2">{selectedTemplate.rodape}</div>
                )}
              </CardContent>
            </Card>
          )}

          {headerMediaType && (
            <div className="space-y-2">
              <Label>URL pública da mídia do cabeçalho ({headerMediaType}) *</Label>
              <Input
                value={headerMediaUrl}
                onChange={(e) => setHeaderMediaUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}

          {variables.length > 0 && (
            <div className="space-y-3">
              <Label>Variáveis do template</Label>
              {variables.map((v) => {
                const cfg = varConfig[v] || { tipo: "campo" as const, valor: "primeiro_nome" };
                return (
                  <Card key={v}>
                    <CardContent className="p-3 space-y-2">
                      <div className="text-sm font-medium">Variável {v}</div>
                      <RadioGroup
                        value={cfg.tipo === "fixo" ? "fixo" : (cfg.valor || "primeiro_nome")}
                        onValueChange={(val) => {
                          if (val === "fixo") {
                            setVarConfig({ ...varConfig, [v]: { tipo: "fixo", valor: cfg.tipo === "fixo" ? cfg.valor : "" } });
                          } else {
                            setVarConfig({ ...varConfig, [v]: { tipo: "campo", valor: val } });
                          }
                        }}
                        className="flex flex-wrap gap-4"
                      >
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <RadioGroupItem value="primeiro_nome" /> Primeiro nome do contato
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <RadioGroupItem value="nome_completo" /> Nome completo do contato
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <RadioGroupItem value="fixo" /> Valor fixo
                        </label>
                      </RadioGroup>
                      {cfg.tipo === "fixo" && (
                        <Input
                          value={cfg.valor}
                          onChange={(e) => setVarConfig({ ...varConfig, [v]: { tipo: "fixo", valor: e.target.value } })}
                          placeholder="Digite o valor"
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <Label>Quando enviar</Label>
            <RadioGroup value={quando} onValueChange={(v: any) => setQuando(v)} className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <RadioGroupItem value="agora" /> Enviar assim que possível
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <RadioGroupItem value="agendar" /> Agendar para data e hora
              </label>
            </RadioGroup>
            {quando === "agendar" && (
              <Input
                type="datetime-local"
                value={agendadaPara}
                min={minDateTime}
                onChange={(e) => setAgendadaPara(e.target.value)}
              />
            )}
            <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Envios respeitam a janela permitida em <code className="text-[10px]">system_settings.whatsapp_quiet_hours</code> (atual: {quietHoursLabel}).</span>
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="secondary" onClick={() => handleSave("rascunho")} disabled={saving}>
            Salvar como rascunho
          </Button>
          <Button onClick={() => handleSave("iniciar")} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
