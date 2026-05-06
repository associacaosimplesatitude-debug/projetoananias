import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare } from "lucide-react";
import { RegistrarContatoModal } from "./RegistrarContatoModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export interface KanbanCliente {
  cliente_id: string;
  nome_igreja: string;
  dias_sem_compra: number;
  canal_ultima_compra: string;
  vendedor_nome: string | null;
  vendedor_id: string | null;
  valor_medio: number;
  telefone: string | null;
  email: string | null;
  ultimo_resultado: string | null;
  ultimo_contato_data: string | null;
  coluna_kanban: string;
  dias_para_fechar?: number | null;
  valor_total_compras?: number;
  valor_ultima_compra?: number;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  clientes: KanbanCliente[];
  filtroVendedor?: string;
  filtroCanal?: string;
  disparosMap?: Record<string, string>; // cliente_id -> ISO date do último envio
}

const COLUNAS = [
  { key: "a_contatar", label: "📞 A Contatar", color: "border-t-orange-500" },
  { key: "interessado", label: "🌱 Interessado", color: "border-t-green-500" },
  { key: "falar_com_consultor", label: "💬 Falar com Consultor", color: "border-t-amber-500" },
  { key: "recusou", label: "🙅 Recusou", color: "border-t-rose-400" },
  { key: "fechados", label: "🎯 Fechados (mês)", color: "border-t-emerald-500" },
];

const COLUNA_TO_RESULTADO: Record<string, string | null> = {
  a_contatar: null,
  interessado: "interessado",
  falar_com_consultor: "falar_com_consultor",
  recusou: "recusou",
  fechados: "comprou",
};

const canalBadgeColor = (canal: string) => {
  switch (canal) {
    case "E-commerce": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "Mercado Pago": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200";
    case "Faturado": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    default: return "";
  }
};

export function RetencaoKanban({ clientes, filtroVendedor, filtroCanal, disparosMap }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<KanbanCliente | null>(null);

  const filtered = clientes.filter(c => {
    if (filtroVendedor && c.vendedor_id !== filtroVendedor) return false;
    if (filtroCanal && c.canal_ultima_compra !== filtroCanal) return false;
    return true;
  });

  const openModal = (cliente: KanbanCliente) => {
    setSelectedCliente(cliente);
    setModalOpen(true);
  };

  const queryClient = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const handleDrop = async (colKey: string, cliente: KanbanCliente) => {
    setDragId(null);
    setOverCol(null);
    if (cliente.coluna_kanban === colKey) return;
    const novoResultado = COLUNA_TO_RESULTADO[colKey];
    if (novoResultado === undefined) return;
    if (colKey === "a_contatar") {
      toast.info("Para mover para 'A Contatar', remova os contatos manualmente.");
      return;
    }
    const { error } = await supabase.from("ebd_retencao_contatos").insert({
      cliente_id: cliente.cliente_id,
      vendedor_id: cliente.vendedor_id,
      tipo_contato: "manual",
      resultado: novoResultado,
      observacao: "Movido manualmente no Kanban",
    });
    if (error) {
      toast.error("Erro ao mover: " + error.message);
    } else {
      toast.success("Card movido");
      queryClient.invalidateQueries({ queryKey: ["retencao-dashboard"] });
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {COLUNAS.map(col => {
          const items = filtered.filter(c => c.coluna_kanban === col.key);
          const showTotal = col.key === "a_contatar" || col.key === "fechados";
          const totalCol = showTotal
            ? items.reduce((acc, c) => acc + (c.valor_total_compras ?? 0), 0)
            : 0;
          return (
            <div
              key={col.key}
              className="space-y-3"
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
              onDragLeave={() => setOverCol(prev => prev === col.key ? null : prev)}
              onDrop={(e) => {
                e.preventDefault();
                const c = filtered.find(x => x.cliente_id === dragId);
                if (c) handleDrop(col.key, c);
              }}
            >
              <div className={`rounded-lg border-t-4 ${col.color} bg-muted/30 p-3 ${overCol === col.key ? "ring-2 ring-primary" : ""}`}>
                <h3 className="font-semibold text-sm">{col.label} ({items.length})</h3>
                {showTotal && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">Total: {formatBRL(totalCol)}</p>
                )}
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum cliente</p>
                )}
                {items.map(c => (
                  <Card
                    key={c.cliente_id}
                    draggable
                    onDragStart={() => setDragId(c.cliente_id)}
                    onDragEnd={() => setDragId(null)}
                    className="shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-medium text-sm leading-tight">{c.nome_igreja}</p>
                        {c.coluna_kanban === "fechados" && c.dias_para_fechar != null ? (
                          <Badge className="text-[10px] shrink-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                            Fechou em {c.dias_para_fechar}d
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] shrink-0">
                            {c.dias_sem_compra}d
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        <Badge className={`text-[10px] ${canalBadgeColor(c.canal_ultima_compra)}`}>
                          {c.canal_ultima_compra}
                        </Badge>
                        {c.vendedor_nome && (
                          <Badge variant="outline" className="text-[10px]">
                            {c.vendedor_nome}
                          </Badge>
                        )}
                        {disparosMap?.[c.cliente_id] && (
                          <Badge variant="secondary" className="text-[10px]">
                            📩 Enviada em {format(new Date(disparosMap[c.cliente_id]), "dd/MM", { locale: ptBR })}
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Total compras: R$ {(c.valor_total_compras ?? c.valor_medio).toFixed(2)}</p>
                        {c.valor_ultima_compra != null && c.valor_ultima_compra > 0 && (
                          <p>Última: R$ {c.valor_ultima_compra.toFixed(2)}</p>
                        )}
                      </div>

                      {c.ultimo_contato_data && (
                        <p className="text-[10px] text-muted-foreground">
                          Último contato: {format(new Date(c.ultimo_contato_data), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}

                      <div className="flex items-center gap-1 pt-1">
                        {c.telefone && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                            <a href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                              <MessageSquare className="h-3.5 w-3.5 text-green-600" />
                            </a>
                          </Button>
                        )}
                        {c.email && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                            <a href={`mailto:${c.email}`}>
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={() => openModal(c)}>
                          Registrar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedCliente && (
        <RegistrarContatoModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          clienteId={selectedCliente.cliente_id}
          vendedorId={selectedCliente.vendedor_id}
          nomeCliente={selectedCliente.nome_igreja}
        />
      )}
    </>
  );
}
