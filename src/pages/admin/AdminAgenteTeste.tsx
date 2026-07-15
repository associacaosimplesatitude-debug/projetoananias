import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  RotateCcw,
  ChevronDown,
  Wrench,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TELEFONE_TESTE = "11947141878";
const NOME_TESTE = "Assembleia Teste Sistema";

type Mensagem = {
  id: string;
  conversa_id: string;
  role: "user" | "assistant" | "tool" | "system";
  conteudo: string | null;
  tool_name: string | null;
  tool_input: any;
  tool_output: any;
  created_at: string;
};

function ToolsPanel({ tools }: { tools: Mensagem[] }) {
  const [open, setOpen] = useState(false);
  if (tools.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
          <Wrench className="h-3 w-3" />
          Ver ferramentas usadas ({tools.length})
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-2">
        {tools.map((t) => {
          const link = t.tool_output?.link || t.tool_output?.proposta_link;
          return (
            <div key={t.id} className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">{t.tool_name}</Badge>
                <span className="text-muted-foreground">
                  {new Date(t.created_at).toLocaleTimeString("pt-BR")}
                </span>
              </div>
              {t.tool_input && (
                <div>
                  <div className="text-muted-foreground font-semibold">Entrada:</div>
                  <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
                    {JSON.stringify(t.tool_input, null, 2)}
                  </pre>
                </div>
              )}
              {t.tool_output && (
                <div>
                  <div className="text-muted-foreground font-semibold">Saída:</div>
                  <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground max-h-40 overflow-auto">
                    {JSON.stringify(t.tool_output, null, 2)}
                  </pre>
                </div>
              )}
              {t.tool_name === "criar_proposta" && link && (
                <div className="pt-2">
                  <Badge className="bg-green-600 hover:bg-green-700">Proposta criada!</Badge>
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 inline-flex items-center gap-1 text-primary underline"
                  >
                    Abrir proposta <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function AdminAgenteTeste() {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversa } = useQuery({
    queryKey: ["agente-teste-conversa", TELEFONE_TESTE],
    refetchInterval: 3000,
    queryFn: async () => {
      const { data } = await supabase
        .from("agente_ia_conversas")
        .select("id, telefone, status, total_turnos, custo_estimado")
        .eq("telefone", TELEFONE_TESTE)
        .eq("status", "ativa")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: mensagens = [] } = useQuery({
    queryKey: ["agente-teste-mensagens", conversa?.id],
    enabled: !!conversa?.id,
    refetchInterval: 2000,
    queryFn: async () => {
      const { data } = await supabase
        .from("agente_ia_mensagens")
        .select("id, conversa_id, role, conteudo, tool_name, tool_input, tool_output, created_at")
        .eq("conversa_id", conversa!.id)
        .order("created_at", { ascending: true });
      return (data || []) as Mensagem[];
    },
  });

  // Agrupa: para cada mensagem 'assistant' final, coleta as tool msgs anteriores desde a última user msg
  const timeline = useMemo(() => {
    const items: { msg: Mensagem; tools: Mensagem[] }[] = [];
    let bufferTools: Mensagem[] = [];
    for (const m of mensagens) {
      if (m.role === "tool") {
        bufferTools.push(m);
      } else if (m.role === "user") {
        items.push({ msg: m, tools: [] });
        bufferTools = [];
      } else if (m.role === "assistant") {
        if (m.conteudo && m.conteudo.trim()) {
          items.push({ msg: m, tools: bufferTools });
          bufferTools = [];
        }
      }
    }
    return items;
  }, [mensagens]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [timeline.length]);

  async function enviar() {
    const texto = input.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    setInput("");
    try {
      const { data, error } = await supabase.functions.invoke("agente-teste-proxy", {
        body: { mensagem_user: texto, telefone: TELEFONE_TESTE },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      qc.invalidateQueries({ queryKey: ["agente-teste-conversa", TELEFONE_TESTE] });
      qc.invalidateQueries({ queryKey: ["agente-teste-mensagens"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar mensagem");
    } finally {
      setEnviando(false);
    }
  }

  async function reiniciar() {
    if (!confirm("Encerrar a conversa de teste atual e iniciar uma nova?")) return;
    try {
      const { data, error } = await supabase.functions.invoke("agente-teste-proxy", {
        body: { acao: "reiniciar", telefone: TELEFONE_TESTE },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Conversa reiniciada");
      qc.invalidateQueries({ queryKey: ["agente-teste-conversa", TELEFONE_TESTE] });
      qc.invalidateQueries({ queryKey: ["agente-teste-mensagens"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao reiniciar");
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agente IA — Teste</h1>
          <p className="text-sm text-muted-foreground">
            Simulando: <strong>{NOME_TESTE}</strong> — {TELEFONE_TESTE}
          </p>
        </div>
        <Button variant="outline" onClick={reiniciar} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reiniciar conversa
        </Button>
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 flex items-start gap-2 text-sm">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>Modo teste.</strong> Nenhuma mensagem é enviada pelo WhatsApp real.
          Propostas geradas ficarão vinculadas ao Vendedor Teste.
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            Conversa
            {conversa && (
              <Badge variant="outline" className="text-[11px]">
                {conversa.total_turnos} turnos
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={scrollRef}
            className="h-[55vh] overflow-y-auto space-y-3 pr-2"
          >
            {timeline.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-10">
                Envie uma mensagem para iniciar a conversa de teste.
              </div>
            )}
            {timeline.map(({ msg, tools }) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                      isUser
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm",
                    )}
                  >
                    {msg.conteudo}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 px-1">
                    {new Date(msg.created_at).toLocaleTimeString("pt-BR")}
                  </div>
                  {!isUser && <ToolsPanel tools={tools} />}
                </div>
              );
            })}
            {enviando && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Agente pensando...
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder="Digite como se fosse o cliente..."
              disabled={enviando}
              autoFocus
            />
            <Button onClick={enviar} disabled={enviando || !input.trim()} className="gap-2">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
