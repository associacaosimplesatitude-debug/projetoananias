import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { StatusBadge } from "./Conversas";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function AgenteIAConversaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: conversa } = useQuery({
    queryKey: ["agente-ia-conversa", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agente_ia_conversas")
        .select("*, ebd_clientes:cliente_id(nome_igreja, contato_principal)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: mensagens = [] } = useQuery({
    queryKey: ["agente-ia-conversa-msgs", id],
    enabled: !!id,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agente_ia_mensagens")
        .select("*")
        .eq("conversa_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: escalation } = useQuery({
    queryKey: ["agente-ia-conversa-esc", id],
    enabled: !!id && conversa?.status === "escalada",
    queryFn: async () => {
      const { data } = await supabase
        .from("agente_ia_escalations")
        .select("*, vendedor:vendedor_alvo_id(nome)")
        .eq("conversa_id", id!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  async function changeStatus(newStatus: string) {
    if (!conversa) return;
    const { error } = await supabase
      .from("agente_ia_conversas")
      .update({ status: newStatus, ...(newStatus === "fechada" ? { fechada_em: new Date().toISOString() } : {}) })
      .eq("id", conversa.id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["agente-ia-conversa", id] });
  }

  if (!conversa) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <Link to="/admin/agente-ia/conversas" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-lg">{conversa.ebd_clientes?.nome_igreja ?? "Sem cliente"}</div>
          <div className="text-xs text-muted-foreground">{conversa.telefone} · iniciada {format(new Date(conversa.iniciada_em), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
          <div className="mt-1"><StatusBadge status={conversa.status} /></div>
        </div>
        <div className="flex gap-2">
          {conversa.status === "ativa" && <Button size="sm" variant="outline" onClick={() => changeStatus("pausada_humano")}>Pausar</Button>}
          {conversa.status === "pausada_humano" && <Button size="sm" variant="outline" onClick={() => changeStatus("ativa")}>Retomar</Button>}
          {conversa.status !== "fechada" && <Button size="sm" variant="destructive" onClick={() => changeStatus("fechada")}>Fechar</Button>}
        </div>
      </Card>

      {escalation && (
        <Card className="p-4 border-red-200 bg-red-50/50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium">Conversa escalada</div>
              <div className="text-muted-foreground">
                Motivo: <strong>{escalation.motivo}</strong> · Prioridade: <strong>{escalation.prioridade}</strong> · Vendedor: <strong>{escalation.vendedor?.nome ?? "—"}</strong> · Status: <strong>{escalation.status}</strong>
              </div>
              {escalation.detalhes && <div className="mt-1 text-xs">{escalation.detalhes}</div>}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <Metric label="Turnos" value={conversa.total_turnos ?? 0} />
          <Metric label="Tokens in" value={conversa.total_tokens_in ?? 0} />
          <Metric label="Tokens out" value={conversa.total_tokens_out ?? 0} />
          <Metric label="Custo" value={`R$ ${Number(conversa.custo_estimado ?? 0).toFixed(4)}`} />
          <Metric label="Venda" value={conversa.gerou_venda ? `R$ ${Number(conversa.valor_venda ?? 0).toFixed(2)}` : "—"} />
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="text-sm font-semibold mb-2">Histórico ({mensagens.length} mensagens)</div>
        {mensagens.map((m) => <ChatMessage key={m.id} m={m} />)}
        {mensagens.length === 0 && <div className="text-muted-foreground text-sm">Sem mensagens.</div>}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground uppercase">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function ChatMessage({ m }: { m: any }) {
  const ts = format(new Date(m.created_at), "dd/MM HH:mm:ss", { locale: ptBR });
  const statusBadge = m.status_aprovacao && m.status_aprovacao !== "nao_aplicavel" && (
    <Badge variant="outline" className="text-[9px] ml-1">{m.status_aprovacao}</Badge>
  );

  if (m.role === "tool" || (m.role === "assistant" && m.tool_name)) {
    return (
      <Collapsible className="bg-muted/50 rounded p-2 text-xs">
        <CollapsibleTrigger className="font-medium w-full text-left flex justify-between">
          <span>🔧 Usou ferramenta: {m.tool_name ?? "—"}</span>
          <span className="text-muted-foreground">{ts}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-1">
          {m.conteudo && <div className="whitespace-pre-wrap">{m.conteudo}</div>}
          <div><strong>Input:</strong><pre className="bg-background border rounded p-1 overflow-x-auto text-[10px]">{JSON.stringify(m.tool_input, null, 2)}</pre></div>
          <div><strong>Output:</strong><pre className="bg-background border rounded p-1 overflow-x-auto text-[10px]">{JSON.stringify(m.tool_output, null, 2)}</pre></div>
        </CollapsibleContent>
      </Collapsible>
    );
  }
  if (m.role === "system") {
    return <div className="text-[10px] text-center text-muted-foreground italic py-1">{m.conteudo} · {ts}</div>;
  }
  const isUser = m.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-start" : "justify-end")}>
      <div className={cn(
        "rounded-lg px-3 py-2 text-sm max-w-[75%]",
        isUser ? "bg-muted" : "bg-background border",
      )}>
        <div className="whitespace-pre-wrap">{m.conteudo_editado || m.conteudo}</div>
        <div className="text-[10px] text-muted-foreground mt-1 flex items-center">
          {ts} {statusBadge}
        </div>
      </div>
    </div>
  );
}
