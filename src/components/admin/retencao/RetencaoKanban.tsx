import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MessageSquare } from "lucide-react";
import { RegistrarContatoModal } from "./RegistrarContatoModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
}

interface Props {
  clientes: KanbanCliente[];
  filtroVendedor?: string;
  filtroCanal?: string;
}

const COLUNAS = [
  { key: "a_contatar", label: "📞 A Contatar", color: "border-t-orange-500" },
  { key: "contato_feito", label: "✅ Contato Feito", color: "border-t-blue-500" },
  { key: "retorno_agendado", label: "📅 Retorno Agendado", color: "border-t-yellow-500" },
  { key: "perdido", label: "❌ Perdido", color: "border-t-destructive" },
];

const canalBadgeColor = (canal: string) => {
  switch (canal) {
    case "E-commerce": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "Mercado Pago": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200";
    case "Faturado": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    default: return "";
  }
};

export function RetencaoKanban({ clientes, filtroVendedor, filtroCanal }: Props) {
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

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUNAS.map(col => {
          const items = filtered.filter(c => c.coluna_kanban === col.key);
          return (
            <div key={col.key} className="space-y-3">
              <div className={`rounded-lg border-t-4 ${col.color} bg-muted/30 p-3`}>
                <h3 className="font-semibold text-sm">{col.label} ({items.length})</h3>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum cliente</p>
                )}
                {items.map(c => (
                  <Card key={c.cliente_id} className="shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-medium text-sm leading-tight">{c.nome_igreja}</p>
                        <Badge variant="destructive" className="text-[10px] shrink-0">
                          {c.dias_sem_compra}d
                        </Badge>
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
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Ticket médio: R$ {c.valor_medio.toFixed(2)}
                      </p>

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
