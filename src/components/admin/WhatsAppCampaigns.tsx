import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, RefreshCw, Loader2, MoreVertical, Play, Pause, X, BarChart3,
  Target, Calendar, Hourglass,
} from "lucide-react";
import NovaCampanhaWizard from "@/components/admin/whatsapp-wizard/NovaCampanhaWizard";

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
        .select("*, whatsapp_templates(nome, corpo, status), whatsapp_publicos(nome, total_calculado)")
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

      <NovaCampanhaWizard
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        quietHours={quietHours}
        onCreated={() => qc.invalidateQueries({ queryKey: ["whatsapp-campanhas-v2"] })}
        onGoToPublicos={() => window.dispatchEvent(new CustomEvent("marketing:goto-publicos"))}
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
              {c.whatsapp_templates?.status === "PENDENTE" && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Hourglass className="h-3 w-3" /> Aguardando aprovação da mensagem
                </Badge>
              )}
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
