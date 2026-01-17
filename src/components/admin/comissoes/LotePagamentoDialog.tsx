import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Download, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ComissaoParaLote {
  id: string;
  vendedor_nome: string;
  cliente_nome: string;
  valor_comissao: number;
  data_vencimento: string;
  tipo: string;
}

interface LotePagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comissoes: ComissaoParaLote[];
  onConfirmar: (referencia: string) => void;
  isLoading?: boolean;
}

export function LotePagamentoDialog({ 
  open, 
  onOpenChange, 
  comissoes, 
  onConfirmar,
  isLoading 
}: LotePagamentoDialogProps) {
  const [referencia, setReferencia] = useState(() => {
    const hoje = new Date();
    return `Pagamento Dia 05 - ${format(hoje, "MMM/yyyy", { locale: ptBR })}`;
  });

  const totalComissao = comissoes.reduce((sum, c) => sum + c.valor_comissao, 0);

  // Agrupar por vendedor para resumo
  const resumoPorVendedor = comissoes.reduce((acc, c) => {
    const key = c.vendedor_nome;
    if (!acc[key]) {
      acc[key] = { vendedor: key, total: 0, quantidade: 0 };
    }
    acc[key].total += c.valor_comissao;
    acc[key].quantidade++;
    return acc;
  }, {} as Record<string, { vendedor: string; total: number; quantidade: number }>);

  const resumoArray = Object.values(resumoPorVendedor).sort((a, b) => b.total - a.total);

  const handleExportCSV = () => {
    const headers = ["Vendedor", "Cliente", "Tipo", "Vencimento", "Valor Comissão"];
    const rows = comissoes.map(c => [
      c.vendedor_nome,
      c.cliente_nome,
      c.tipo,
      c.data_vencimento,
      c.valor_comissao.toFixed(2)
    ]);
    
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lote-pagamento-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerar Lote de Pagamento
          </DialogTitle>
          <DialogDescription>
            Revise as comissões a serem incluídas neste lote de pagamento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Referência */}
          <div className="space-y-2">
            <Label htmlFor="referencia">Referência do Lote</Label>
            <Input
              id="referencia"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ex: Pagamento Dia 05 - Jan/2026"
            />
          </div>

          {/* Resumo por Vendedor */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <h4 className="font-medium mb-3">Resumo por Vendedor</h4>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {resumoArray.map(item => (
                <div key={item.vendedor} className="flex justify-between items-center p-2 bg-background rounded">
                  <div>
                    <p className="font-medium text-sm">{item.vendedor}</p>
                    <p className="text-xs text-muted-foreground">{item.quantidade} itens</p>
                  </div>
                  <p className="font-bold text-purple-600">
                    R$ {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200">
            <div>
              <p className="text-sm text-green-700">Total do Lote</p>
              <p className="font-medium text-green-700">{comissoes.length} comissões</p>
            </div>
            <p className="text-2xl font-bold text-green-700">
              R$ {totalComissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Lista detalhada (colapsável) */}
          <details className="group">
            <summary className="cursor-pointer font-medium text-sm text-muted-foreground hover:text-foreground">
              Ver detalhes ({comissoes.length} itens)
            </summary>
            <div className="mt-3 max-h-60 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comissoes.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.vendedor_nome}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{c.cliente_nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-purple-600">
                        R$ {c.valor_comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => onConfirmar(referencia)}
            disabled={isLoading || !referencia.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
