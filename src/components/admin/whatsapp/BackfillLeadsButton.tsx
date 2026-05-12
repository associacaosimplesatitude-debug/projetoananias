import { useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BackfillResult {
  ok: boolean;
  dryRun: boolean;
  rangeDays: number;
  totalPedidos: number;
  leadsCriados: number;
  leadsAtualizados: number;
  pulados: number;
  erros: number;
  errosDetalhe?: Array<{ pedido: string; motivo: string }>;
  clientesResetados: number;
  clientesResetDetalhe?: Array<{ id: string; nome: string; motivo?: string }>;
  duracaoMs: number;
}

export function BackfillLeadsButton() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(60);
  const [limit, setLimit] = useState(500);
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);

  const executar = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "backfill-leads-from-orders",
        { body: { days, limit, dryRun } },
      );
      if (error) throw error;
      setResult(data as BackfillResult);
      toast.success(
        dryRun
          ? `Simulação: ${data.leadsCriados} criar, ${data.leadsAtualizados} atualizar, ${data.clientesResetados} resetar`
          : `Backfill: ${data.leadsCriados} criados, ${data.leadsAtualizados} atualizados, ${data.clientesResetados} resetados`,
      );
    } catch (e: any) {
      toast.error(e?.message || "Falha ao executar backfill");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
          <Database className="h-3.5 w-3.5" />
          Backfill de Leads
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Backfill de Leads dos Pedidos</DialogTitle>
          <DialogDescription>
            Percorre pedidos pagos da Nova Loja dos últimos N dias, cria leads
            que ainda não existem e reseta o tipo_cliente='Igreja' dos clientes
            da Nova Loja para indefinido. Idempotente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="bl-days">Dias</Label>
            <Input
              id="bl-days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 60)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-limit">Limite de pedidos</Label>
            <Input
              id="bl-limit"
              type="number"
              min={1}
              max={2000}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 500)}
              disabled={loading}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="bl-dry"
              checked={dryRun}
              onCheckedChange={(v) => setDryRun(!!v)}
              disabled={loading}
            />
            <Label htmlFor="bl-dry" className="text-sm font-normal cursor-pointer">
              Dry-run (não grava, só conta)
            </Label>
          </div>

          {result && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              <div className="font-medium mb-1">
                Resultado {result.dryRun ? "(simulação)" : ""}
              </div>
              <div>Pedidos analisados: <strong>{result.totalPedidos}</strong></div>
              <div>Leads criados: <strong>{result.leadsCriados}</strong></div>
              <div>Leads atualizados: <strong>{result.leadsAtualizados}</strong></div>
              <div>Pulados (já completos): <strong>{result.pulados}</strong></div>
              <div>Clientes 'Igreja' resetados: <strong>{result.clientesResetados}</strong></div>
              <div>Erros: <strong>{result.erros}</strong></div>
              <div className="text-xs text-muted-foreground">
                Janela: {result.rangeDays} dias • {result.duracaoMs} ms
              </div>
              {result.errosDetalhe && result.errosDetalhe.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto text-xs">
                  <div className="font-medium mb-0.5">Detalhe dos erros:</div>
                  {result.errosDetalhe.map((er, i) => (
                    <div key={i} className="truncate">
                      #{er.pedido}: {er.motivo}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            {result ? "Fechar" : "Cancelar"}
          </Button>
          <Button onClick={executar} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Executar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
