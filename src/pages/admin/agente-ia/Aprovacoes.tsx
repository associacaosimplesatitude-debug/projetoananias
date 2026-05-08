import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, Check, Pencil, X, ChevronDown, ExternalLink, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type Mensagem = {
  id: string;
  conversa_id: string;
  role: string;
  conteudo: string | null;
  tool_name: string | null;
  tool_input: any;
  tool_output: any;
  status_aprovacao: string | null;
  created_at: string;
};

type Conversa = {
  id: string;
  cliente_id: string | null;
  telefone: string;
  status: string;
  cliente?: { nome_igreja?: string | null } | null;
};

const MOTIVOS = [
  "Resposta inadequada",
  "Informação errada",
  "Tom errado",
  "Outro",
];

export default function AgenteIAAprovacoes() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [refuseMotivo, setRefuseMotivo] = useState(MOTIVOS[0]);
  const [refuseObs, setRefuseObs] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastIdsRef = useRef<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pending messages (FIFO)
  const { data: pendentes = [], isLoading } = useQuery({
    queryKey: ["agente-ia-pendentes"],
    refetchInterval: 5_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agente_ia_mensagens")
        .select("*")
        .eq("status_aprovacao", "pendente")
        .eq("role", "assistant")
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Mensagem[];
    },
  });

  // Conversas referenced
  const conversaIds = useMemo(
    () => Array.from(new Set(pendentes.map((m) => m.conversa_id))),
    [pendentes],
  );

  const { data: conversasMap = {} } = useQuery({
    queryKey: ["agente-ia-pendentes-conversas", conversaIds],
    enabled: conversaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agente_ia_conversas")
        .select("id, cliente_id, telefone, status, ebd_clientes:cliente_id(nome_igreja)")
        .in("id", conversaIds);
      if (error) throw error;
      const map: Record<string, Conversa> = {};
      for (const row of (data ?? []) as any[]) {
        map[row.id] = {
          id: row.id,
          cliente_id: row.cliente_id,
          telefone: row.telefone,
          status: row.status,
          cliente: row.ebd_clientes ?? null,
        };
      }
      return map;
    },
  });

  // Realtime + sound
  useEffect(() => {
    const channel = supabase
      .channel("agente-ia-aprovacoes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agente_ia_mensagens" },
        () => qc.invalidateQueries({ queryKey: ["agente-ia-pendentes"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    const ids = new Set(pendentes.map((m) => m.id));
    if (lastIdsRef.current.size > 0) {
      const novos = [...ids].filter((i) => !lastIdsRef.current.has(i));
      if (novos.length > 0) {
        try {
          audioRef.current?.play().catch(() => {});
        } catch {}
      }
    }
    lastIdsRef.current = ids;
  }, [pendentes]);

  // Auto-select first if none
  useEffect(() => {
    if (!selectedId && pendentes.length > 0) {
      setSelectedId(pendentes[0].id);
    }
    if (selectedId && !pendentes.find((m) => m.id === selectedId)) {
      setSelectedId(pendentes[0]?.id ?? null);
    }
  }, [pendentes, selectedId]);

  const selected = pendentes.find((m) => m.id === selectedId) || null;

  // Reset edit textarea when selection changes
  useEffect(() => {
    setEditValue(selected?.conteudo ?? "");
  }, [selected?.id]);

  // Last 5 turns of selected conversation
  const { data: historico = [] } = useQuery({
    queryKey: ["agente-ia-hist", selected?.conversa_id],
    enabled: !!selected?.conversa_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agente_ia_mensagens")
        .select("*")
        .eq("conversa_id", selected!.conversa_id)
        .neq("id", selected!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return ((data ?? []) as Mensagem[]).reverse();
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inEditable = tag === "TEXTAREA" || tag === "INPUT";
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (inEditable) return;
        e.preventDefault();
        const idx = pendentes.findIndex((m) => m.id === selectedId);
        const next = e.key === "ArrowDown" ? idx + 1 : idx - 1;
        if (pendentes[next]) setSelectedId(pendentes[next].id);
      } else if (!inEditable && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        if (selected) handleAction("aprovada");
      } else if (!inEditable && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        textareaRef.current?.focus();
      } else if (!inEditable && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        if (selected) setRefuseOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, pendentes, selected]);

  async function handleAction(tipo: "aprovada" | "editada" | "recusada") {
    if (!selected) return;
    setBusy(true);
    try {
      const patch: any = {
        status_aprovacao: tipo,
        aprovada_por: user?.id ?? null,
        aprovada_em: new Date().toISOString(),
      };
      if (tipo === "editada") patch.conteudo_editado = editValue;
      if (tipo === "recusada") {
        patch.motivo_recusa = `${refuseMotivo}${refuseObs ? ` — ${refuseObs}` : ""}`;
      }

      const { error } = await supabase
        .from("agente_ia_mensagens")
        .update(patch)
        .eq("id", selected.id);
      if (error) throw error;

      if (tipo === "aprovada" || tipo === "editada") {
        toast.success(
          tipo === "aprovada" ? "Mensagem aprovada" : "Mensagem editada e aprovada",
          { description: "Envio será ativado quando o agente entrar em produção." },
        );
      } else {
        toast.success("Mensagem recusada", {
          description: "Não será enviada ao cliente.",
        });
      }

      setRefuseOpen(false);
      setRefuseObs("");
      setRefuseMotivo(MOTIVOS[0]);
      qc.invalidateQueries({ queryKey: ["agente-ia-pendentes"] });
    } catch (e: any) {
      toast.error("Erro ao processar", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[600px]">
      {/* Beep audio (silent if blocked) */}
      <audio
        ref={audioRef}
        src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
        preload="auto"
      />

      {/* LEFT: queue */}
      <Card className="lg:col-span-1 p-3 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Fila ({pendentes.length})</h3>
          <Badge variant="outline" className="text-[10px]">FIFO</Badge>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!isLoading && pendentes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
              <Inbox className="h-8 w-8" />
              Nenhuma mensagem pendente
            </div>
          )}
          {pendentes.map((m) => {
            const c = conversasMap[m.conversa_id];
            const ageMs = Date.now() - new Date(m.created_at).getTime();
            const urgent = ageMs > 5 * 60 * 1000;
            const sel = selectedId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={cn(
                  "w-full text-left p-2 rounded-md border text-xs transition-colors",
                  sel ? "bg-primary/10 border-primary" : "hover:bg-muted",
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium truncate">{c?.cliente?.nome_igreja || c?.telefone || "—"}</span>
                  {urgent && <Badge variant="destructive" className="text-[9px] px-1">URGENTE</Badge>}
                </div>
                <div className="text-muted-foreground text-[11px]">
                  {c?.telefone} · {formatDistanceToNow(new Date(m.created_at), { locale: ptBR, addSuffix: true })}
                </div>
                <div className="text-muted-foreground line-clamp-2 mt-1">
                  {(m.conteudo || `[Tool: ${m.tool_name ?? "—"}]`).slice(0, 80)}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* RIGHT: detail */}
      <Card className="lg:col-span-2 p-4 flex flex-col">
        {!selected && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Selecione uma mensagem da fila
          </div>
        )}
        {selected && (
          <>
            <div className="flex items-center justify-between mb-3 pb-3 border-b">
              <div>
                <div className="font-semibold">
                  {conversasMap[selected.conversa_id]?.cliente?.nome_igreja || "Sem cliente vinculado"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {conversasMap[selected.conversa_id]?.telefone}
                </div>
              </div>
              <Link
                to={`/admin/agente-ia/conversas/${selected.conversa_id}`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Ver conversa completa <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {/* Recent turns */}
            <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-1">
              <div className="text-xs font-medium text-muted-foreground uppercase">Últimos turnos</div>
              {historico.length === 0 && <div className="text-xs text-muted-foreground">Sem histórico anterior.</div>}
              {historico.map((h) => (
                <MessageBubble key={h.id} m={h} />
              ))}
            </div>

            {/* Pending message */}
            <div className="border-2 border-amber-400 rounded-md p-3 bg-amber-50/30 mb-3">
              <div className="text-xs font-medium text-amber-700 mb-1">Mensagem pendente do agente</div>
              <div className="text-sm whitespace-pre-wrap">{selected.conteudo || "(sem texto)"}</div>
              {(selected.tool_name || selected.tool_input || selected.tool_output) && (
                <Collapsible className="mt-2">
                  <CollapsibleTrigger className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
                    <ChevronDown className="h-3 w-3" /> Ferramentas usadas
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-1 text-xs">
                    <div><strong>Tool:</strong> {selected.tool_name || "—"}</div>
                    <div><strong>Input:</strong> <pre className="bg-background border rounded p-1 overflow-x-auto">{JSON.stringify(selected.tool_input, null, 2)}</pre></div>
                    <div><strong>Output:</strong> <pre className="bg-background border rounded p-1 overflow-x-auto">{JSON.stringify(selected.tool_output, null, 2)}</pre></div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>

            {/* Edit textarea */}
            <Textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={4}
              className="mb-3"
              placeholder="Edite a mensagem antes de enviar..."
            />

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleAction("aprovada")}
                disabled={busy}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="h-4 w-4" /> Enviar como está <kbd className="ml-1 text-[10px] opacity-70">A</kbd>
              </Button>
              <Button
                onClick={() => handleAction("editada")}
                disabled={busy || editValue === (selected.conteudo ?? "")}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Pencil className="h-4 w-4" /> Editar e enviar <kbd className="ml-1 text-[10px] opacity-70">E</kbd>
              </Button>
              <Button
                onClick={() => setRefuseOpen(true)}
                disabled={busy}
                variant="destructive"
              >
                <X className="h-4 w-4" /> Recusar <kbd className="ml-1 text-[10px] opacity-70">R</kbd>
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Atalhos: A aprovar · E editar · R recusar · ↑/↓ navegar
            </div>
          </>
        )}
      </Card>

      {/* Refuse dialog */}
      <Dialog open={refuseOpen} onOpenChange={setRefuseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar mensagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Motivo</label>
              <select
                className="w-full border rounded-md h-10 px-2 mt-1 bg-background"
                value={refuseMotivo}
                onChange={(e) => setRefuseMotivo(e.target.value)}
              >
                {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Observação (opcional)</label>
              <Input value={refuseObs} onChange={(e) => setRefuseObs(e.target.value)} placeholder="Detalhes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefuseOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => handleAction("recusada")} disabled={busy}>
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageBubble({ m }: { m: Mensagem }) {
  const ts = format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR });
  if (m.role === "tool") {
    return (
      <div className="text-[11px] bg-muted rounded p-2">
        <div className="font-medium">🔧 Ferramenta: {m.tool_name}</div>
        <div className="text-muted-foreground">{ts}</div>
      </div>
    );
  }
  if (m.role === "system") {
    return (
      <div className="text-[10px] text-center text-muted-foreground italic">
        {m.conteudo} · {ts}
      </div>
    );
  }
  const isUser = m.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-start" : "justify-end")}>
      <div className={cn(
        "rounded-lg px-3 py-2 text-xs max-w-[80%]",
        isUser ? "bg-muted" : "bg-background border",
      )}>
        <div className="whitespace-pre-wrap">{m.conteudo}</div>
        <div className="text-[10px] text-muted-foreground mt-1">{ts}</div>
      </div>
    </div>
  );
}
