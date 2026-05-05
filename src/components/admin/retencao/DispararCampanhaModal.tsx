import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

export function DispararCampanhaModal({ open, onOpenChange, clientes, onDispatched }: Props) {
  const [faixa, setFaixa] = useState<Faixa>("atencao");
  const [excluirRecentes, setExcluirRecentes] = useState(true);
  const [loading, setLoading] = useState(false);
  const [recentesIds, setRecentesIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
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

  const alvo = useMemo(() => {
    let list = clientes.filter((c) => inFaixa(c.dias_sem_compra || 0, faixa));
    if (excluirRecentes) list = list.filter((c) => !recentesIds.has(c.cliente_id));
    return list;
  }, [clientes, faixa, excluirRecentes, recentesIds]);

  const preview = alvo[0];
  const previewMsg = preview
    ? `Olá ${preview.nome_igreja}! Sentimos sua falta na Editora Central Gospel. ${preview.vendedor_nome || "Nosso consultor"} preparou novidades especiais para você. Quer dar uma olhada?`
    : "Nenhum cliente para preview.";

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("retencao-disparar-whatsapp", {
        body: { faixa, excluir_recentes: excluirRecentes },
      });
      if (error) throw error;
      const r = data as { total: number; sucesso: number; falha: number };
      toast.success(`✅ ${r.sucesso} enviadas. ${r.falha} falharam.`);
      onOpenChange(false);
      onDispatched?.();
    } catch (e: any) {
      toast.error("Erro ao disparar: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Disparar campanha WhatsApp</DialogTitle>
          <DialogDescription>
            Reengajamento via template <span className="font-mono">retencao_ebd_reengajamento</span>
          </DialogDescription>
        </DialogHeader>

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
            />
            <Label htmlFor="excl" className="text-sm cursor-pointer">
              Excluir clientes que receberam mensagem nos últimos 30 dias
            </Label>
          </div>

          <div className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-sm font-medium">
            Serão impactados <span className="text-lg font-bold">{alvo.length}</span> clientes
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || alvo.length === 0}>
            {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando…</>) : "Confirmar e disparar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
