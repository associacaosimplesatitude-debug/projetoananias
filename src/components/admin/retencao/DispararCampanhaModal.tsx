import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { KanbanCliente } from "./RetencaoKanban";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientes: KanbanCliente[];
  onDispatched?: () => void;
}

type Faixa = "atencao" | "critico" | "urgente";

const faixaLabel: Record<Faixa, string> = {
  atencao: "Atenção (30–60d)",
  critico: "Crítico (60–90d)",
  urgente: "Urgente (90+d)",
};

function inFaixa(d: number, f: Faixa) {
  if (f === "atencao") return d >= 30 && d < 60;
  if (f === "critico") return d >= 60 && d < 90;
  return d >= 90;
}

const NUMEROS_TESTE = [
  { id: "cleuton", nome: "Cleuton Soares", telefone: "11947141878" },
  { id: "cayk", nome: "Cayk Soares", telefone: "11954937736" },
];

interface Progresso {
  enviadas: number;
  sucessos: number;
  falhas: number;
  total: number;
  status: string;
  erro?: string | null;
}

export function DispararCampanhaModal({ open, onOpenChange, clientes, onDispatched }: Props) {
  const [faixa, setFaixa] = useState<Faixa>("atencao");
  const [excluirRecentes, setExcluirRecentes] = useState(true);
  const [loading, setLoading] = useState(false);
  const [recentesIds, setRecentesIds] = useState<Set<string>>(new Set());
  const [testeIds, setTesteIds] = useState<Set<string>>(new Set());
  const [campanhaId, setCampanhaId] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setTesteIds(new Set());
    setCampanhaId(null);
    setProgresso(null);
    (async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("retencao_disparos")
        .select("cliente_id")
        .eq("status", "sucesso")
        .gt("enviado_em", cutoff);
      setRecentesIds(new Set((data || []).map((r: any) => r.cliente_id)));
    })();
  }, [open]);

  // Polling do progresso
  useEffect(() => {
    if (!campanhaId) return;
    startedAtRef.current = Date.now();
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      const { data, error } = await supabase
        .from("retencao_campanhas")
        .select("enviadas,sucessos,falhas,total_alvo,status,erro")
        .eq("id", campanhaId)
        .single();
      if (!error && data) {
        const p: Progresso = {
          enviadas: data.enviadas || 0,
          sucessos: data.sucessos || 0,
          falhas: data.falhas || 0,
          total: data.total_alvo || 0,
          status: data.status,
          erro: data.erro,
        };
        setProgresso(p);
        if (p.status === "concluida") {
          stopped = true;
          toast.success(`✅ Campanha finalizada: ${p.sucessos} enviadas, ${p.falhas} falharam`);
          onDispatched?.();
          onOpenChange(false);
          return;
        }
        if (p.status === "erro") {
          stopped = true;
          toast.error("Erro na campanha: " + (p.erro || "desconhecido"));
          return;
        }
      }
      // timeout 30 min
      if (startedAtRef.current && Date.now() - startedAtRef.current > 30 * 60 * 1000) {
        stopped = true;
        return;
      }
      setTimeout(poll, 2000);
    };
    poll();
    return () => {
      stopped = true;
    };
  }, [campanhaId, onDispatched, onOpenChange]);

  const isTeste = testeIds.size > 0;

  const alvo = useMemo(() => {
    let list = clientes.filter((c) => inFaixa(c.dias_sem_compra || 0, faixa));
    if (excluirRecentes) list = list.filter((c) => !recentesIds.has(c.cliente_id));
    return list;
  }, [clientes, faixa, excluirRecentes, recentesIds]);

  const totalImpactados = isTeste ? testeIds.size : alvo.length;

  const preview = alvo[0];
  const previewMsg = preview
    ? `Olá ${preview.nome_igreja}! Sentimos sua falta na Editora Central Gospel. ${preview.vendedor_nome || "Nosso consultor"} preparou novidades especiais para você. Quer dar uma olhada?`
    : "Nenhum cliente para preview.";

  const toggleTeste = (id: string) => {
    setTesteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const selecionados = NUMEROS_TESTE.filter((n) => testeIds.has(n.id));
      const body: any = isTeste
        ? {
            isTeste: true,
            numeros_teste: selecionados.map((n) => n.telefone),
            numeros_teste_detalhes: selecionados,
          }
        : { faixa, excluir_recentes: excluirRecentes };
      const { data, error } = await supabase.functions.invoke("retencao-disparar-whatsapp", { body });
      if (error) throw error;
      const r = data as { campanha_id: string; total_alvo: number };
      if (!r?.campanha_id) throw new Error("Resposta inválida do servidor");
      setCampanhaId(r.campanha_id);
      setProgresso({ enviadas: 0, sucessos: 0, falhas: 0, total: r.total_alvo, status: "processando" });
      toast.info(`Campanha iniciada: ${r.total_alvo} envios em background`);
    } catch (e: any) {
      toast.error("Erro ao disparar: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  const isProcessing = !!progresso && progresso.status === "processando";
  const pct = progresso && progresso.total > 0 ? Math.round((progresso.enviadas / progresso.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Disparar campanha WhatsApp</DialogTitle>
          <DialogDescription>
            Reengajamento via template <span className="font-mono">retencao_ebd_reengajamento</span>
          </DialogDescription>
        </DialogHeader>

        {progresso ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Enviadas: {progresso.enviadas} / {progresso.total}</span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <Progress value={pct} />
            </div>
            <div className="rounded-md bg-muted p-3 text-sm">
              ✅ Sucessos: <span className="font-bold">{progresso.sucessos}</span>
              {"  "}❌ Falhas: <span className="font-bold">{progresso.falhas}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isProcessing
                ? "Processo rodando em background. Você pode fechar este modal — a campanha continuará."
                : progresso.status === "erro"
                  ? `Erro: ${progresso.erro || ""}`
                  : "Concluída."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Faixa de risco</Label>
              <Select value={faixa} onValueChange={(v) => setFaixa(v as Faixa)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(faixaLabel) as Faixa[]).map((k) => (
                    <SelectItem key={k} value={k}>{faixaLabel[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="excl"
                checked={excluirRecentes}
                onCheckedChange={(v) => setExcluirRecentes(!!v)}
                disabled={isTeste}
              />
              <Label htmlFor="excl" className={`text-sm cursor-pointer ${isTeste ? "opacity-50" : ""}`}>
                Excluir clientes que receberam mensagem nos últimos 30 dias
              </Label>
            </div>

            <div className="rounded-md border border-dashed p-3 space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Envio de teste</p>
              <p className="text-[11px] text-muted-foreground">
                Se selecionar números abaixo, a campanha será enviada APENAS para eles, ignorando a faixa de risco.
              </p>
              {NUMEROS_TESTE.map((n) => (
                <div key={n.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`teste-${n.id}`}
                    checked={testeIds.has(n.id)}
                    onCheckedChange={() => toggleTeste(n.id)}
                  />
                  <Label htmlFor={`teste-${n.id}`} className="text-sm cursor-pointer">
                    {n.nome} — <span className="font-mono">{n.telefone}</span>
                  </Label>
                </div>
              ))}
            </div>

            <div className={`rounded-md px-3 py-2 text-sm font-medium border ${isTeste ? "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200" : "bg-primary/10 border-primary/20"}`}>
              {isTeste ? "Modo teste — " : ""}Serão impactados <span className="text-lg font-bold">{totalImpactados}</span> {isTeste ? "número(s)" : "clientes"}
            </div>

            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <p className="text-xs text-muted-foreground font-semibold mb-1">Preview da mensagem</p>
              <p className="whitespace-pre-wrap">{previewMsg}</p>
              <div className="flex flex-wrap gap-1 pt-2">
                <span className="text-[10px] px-2 py-0.5 rounded bg-background border">Quero ver as novidades</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-background border">Falar com consultor</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-background border">Agora não, obrigado</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {progresso ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {isProcessing ? "Fechar e acompanhar em background" : "Fechar"}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={loading || totalImpactados === 0}>
                {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Iniciando…</>) : isTeste ? "Enviar teste" : "Confirmar e disparar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
