import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import type { BlingSaldoDeposito } from "@/lib/bling";

interface DividirDepositoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoTitulo: string;
  sku: string;
  quantidadeSolicitada: number;
  saldosPorDeposito: BlingSaldoDeposito[];
  onConfirm: (
    distribuicao: Array<{ depositoId: number; nome: string; quantidade: number }>,
  ) => void;
}

/**
 * Sugere e permite ajustar a distribuição de quantidades por depósito
 * quando a quantidade solicitada excede o saldo de um único depósito.
 */
export function DividirDepositoDialog({
  open,
  onOpenChange,
  produtoTitulo,
  sku,
  quantidadeSolicitada,
  saldosPorDeposito,
  onConfirm,
}: DividirDepositoDialogProps) {
  const depositosOrdenados = useMemo(
    () =>
      [...saldosPorDeposito]
        .filter((d) => d.saldo > 0)
        .sort((a, b) => b.saldo - a.saldo),
    [saldosPorDeposito],
  );

  const [quantidades, setQuantidades] = useState<Record<number, number>>({});

  // Sugestão inicial: preenche em ordem de maior saldo até completar
  useEffect(() => {
    if (!open) return;
    const sug: Record<number, number> = {};
    let restante = quantidadeSolicitada;
    for (const d of depositosOrdenados) {
      if (restante <= 0) break;
      const aloca = Math.min(d.saldo, restante);
      sug[d.depositoId] = aloca;
      restante -= aloca;
    }
    setQuantidades(sug);
  }, [open, quantidadeSolicitada, depositosOrdenados]);

  const totalAlocado = Object.values(quantidades).reduce((s, n) => s + (n || 0), 0);
  const totalDisponivel = depositosOrdenados.reduce((s, d) => s + d.saldo, 0);
  const diferenca = quantidadeSolicitada - totalAlocado;
  const insuficiente = quantidadeSolicitada > totalDisponivel;

  const handleConfirm = () => {
    if (insuficiente) {
      toast.error(
        `Saldo insuficiente. Total disponível: ${totalDisponivel} un.`,
      );
      return;
    }
    if (totalAlocado !== quantidadeSolicitada) {
      toast.error(
        `A soma dos depósitos (${totalAlocado}) precisa ser igual à quantidade pedida (${quantidadeSolicitada}).`,
      );
      return;
    }
    const distribuicao = depositosOrdenados
      .map((d) => ({
        depositoId: d.depositoId,
        nome: d.nome,
        quantidade: quantidades[d.depositoId] || 0,
      }))
      .filter((d) => d.quantidade > 0);
    onConfirm(distribuicao);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            Dividir por depósito
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{produtoTitulo}</span>{" "}
            <span className="text-muted-foreground">(SKU {sku})</span>
            <br />
            Quantidade pedida:{" "}
            <span className="font-semibold text-foreground">
              {quantidadeSolicitada} un.
            </span>{" "}
            — o pedido será dividido em <b>1 proposta por depósito</b>, cada uma
            com o frete calculado a partir do CEP daquele depósito.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {depositosOrdenados.length === 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              Nenhum depósito com saldo disponível para este produto.
            </div>
          )}
          {depositosOrdenados.map((d) => (
            <div
              key={d.depositoId}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="min-w-0">
                <Label className="font-medium">{d.nome}</Label>
                <p className="text-xs text-muted-foreground">
                  Saldo disponível: {d.saldo} un.
                </p>
              </div>
              <Input
                type="number"
                min={0}
                max={d.saldo}
                value={quantidades[d.depositoId] ?? 0}
                onChange={(e) => {
                  const raw = parseInt(e.target.value, 10);
                  const v = Number.isFinite(raw) ? Math.max(0, raw) : 0;
                  setQuantidades((prev) => ({
                    ...prev,
                    [d.depositoId]: Math.min(v, d.saldo),
                  }));
                }}
                className="w-24 text-center"
              />
            </div>
          ))}

          <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Total alocado:</span>
              <span
                className={
                  totalAlocado === quantidadeSolicitada
                    ? "font-semibold text-emerald-600"
                    : "font-semibold text-amber-600"
                }
              >
                {totalAlocado} / {quantidadeSolicitada} un.
              </span>
            </div>
            {diferenca !== 0 && (
              <p className="text-xs text-muted-foreground">
                {diferenca > 0
                  ? `Faltam ${diferenca} un. para completar.`
                  : `Passou em ${-diferenca} un.`}
              </p>
            )}
            {insuficiente && (
              <p className="text-xs text-destructive">
                Saldo total insuficiente — máximo possível: {totalDisponivel} un.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              depositosOrdenados.length === 0 ||
              totalAlocado !== quantidadeSolicitada
            }
          >
            Confirmar divisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
