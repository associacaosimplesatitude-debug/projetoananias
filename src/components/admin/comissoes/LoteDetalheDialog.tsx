import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FileText, Download, CheckCircle2, Calendar, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LoteComissaoItem {
  id: string;
  vendedor_nome: string;
  vendedor_foto?: string | null;
  cliente_nome: string;
  valor_comissao: number;
  data_vencimento: string;
  tipo: string;
}

interface LoteInfo {
  id: string;
  referencia: string;
  mes_referencia: string;
  tipo: string;
  valor_total: number;
  quantidade_itens: number;
  status: string;
  created_at: string;
  pago_em: string | null;
}

interface VendedorResumo {
  nome: string;
  foto: string | null;
  total: number;
  quantidade: number;
  comissoes: LoteComissaoItem[];
}

interface LoteDetalheDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lote: LoteInfo | null;
  comissoes: LoteComissaoItem[];
}

export function LoteDetalheDialog({ 
  open, 
  onOpenChange, 
  lote, 
  comissoes 
}: LoteDetalheDialogProps) {
  if (!lote) return null;

  // Agrupar por vendedor
  const vendedoresAgrupados: VendedorResumo[] = Object.values(
    comissoes.reduce((acc, c) => {
      const key = c.vendedor_nome;
      if (!acc[key]) {
        acc[key] = {
          nome: c.vendedor_nome,
          foto: c.vendedor_foto || null,
          total: 0,
          quantidade: 0,
          comissoes: []
        };
      }
      acc[key].total += c.valor_comissao;
      acc[key].quantidade++;
      acc[key].comissoes.push(c);
      return acc;
    }, {} as Record<string, VendedorResumo>)
  ).sort((a, b) => b.total - a.total);

  const getInitials = (nome: string) => {
    return nome
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const handleExportCSVVendedor = (vendedor: VendedorResumo) => {
    const headers = ["Cliente", "Tipo", "Vencimento", "Valor Comissão"];
    const rows = vendedor.comissoes.map(c => [
      c.cliente_nome,
      c.tipo,
      c.data_vencimento,
      c.valor_comissao.toFixed(2)
    ]);
    
    const csv = [
      `Vendedor: ${vendedor.nome}`,
      `Total: R$ ${vendedor.total.toFixed(2)}`,
      "",
      headers.join(";"), 
      ...rows.map(r => r.join(";"))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comissoes-${vendedor.nome.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const handleExportCSVCompleto = () => {
    const headers = ["Vendedor", "Cliente", "Tipo", "Vencimento", "Valor Comissão"];
    const rows = comissoes.map(c => [
      c.vendedor_nome,
      c.cliente_nome,
      c.tipo,
      c.data_vencimento,
      c.valor_comissao.toFixed(2)
    ]);
    
    const csv = [
      `Lote: ${lote.referencia}`,
      `Total: R$ ${lote.valor_total.toFixed(2)}`,
      "",
      headers.join(";"), 
      ...rows.map(r => r.join(";"))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lote-${lote.referencia.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhes do Lote de Pagamento
          </DialogTitle>
          <DialogDescription>
            {lote.referencia}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info do Lote */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30 border">
            <div>
              <p className="text-xs text-muted-foreground">Mês Referência</p>
              <p className="font-medium">
                {format(parseISO(lote.mes_referencia), "MMMM/yyyy", { locale: ptBR })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Quantidade</p>
              <p className="font-medium">{lote.quantidade_itens} itens</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {lote.status === 'pago' ? 'Pago' : lote.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pago em</p>
              <p className="font-medium">
                {lote.pago_em 
                  ? format(parseISO(lote.pago_em), "dd/MM/yyyy")
                  : "-"
                }
              </p>
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200">
            <div>
              <p className="text-sm text-green-700">Total do Lote</p>
              <p className="font-medium text-green-700">{vendedoresAgrupados.length} vendedores</p>
            </div>
            <p className="text-2xl font-bold text-green-700">
              R$ {lote.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Por Vendedor */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Quebra por Vendedor</h4>
              <Button variant="outline" size="sm" onClick={handleExportCSVCompleto}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Completo
              </Button>
            </div>
            
            <Accordion type="multiple" className="space-y-2">
              {vendedoresAgrupados.map((vendedor) => (
                <AccordionItem 
                  key={vendedor.nome}
                  value={vendedor.nome}
                  className="border rounded-lg px-4 bg-card"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={vendedor.foto || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(vendedor.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                          <p className="font-medium">{vendedor.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {vendedor.quantidade} {vendedor.quantidade === 1 ? 'item' : 'itens'}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-purple-600">
                        R$ {vendedor.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2 pb-4">
                      <div className="flex justify-end">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleExportCSVVendedor(vendedor)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Exportar CSV
                        </Button>
                      </div>
                      
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead className="text-right">Comissão</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vendedor.comissoes.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="max-w-[200px] truncate">{item.cliente_nome}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{item.tipo}</Badge>
                              </TableCell>
                              <TableCell>
                                {format(parseISO(item.data_vencimento), "dd/MM/yyyy")}
                              </TableCell>
                              <TableCell className="text-right text-purple-600">
                                R$ {item.valor_comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
