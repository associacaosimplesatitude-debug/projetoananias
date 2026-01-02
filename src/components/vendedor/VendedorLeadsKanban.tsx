import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Church, User, Mail, Phone, Calendar, GripVertical, DollarSign } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { LeadFechamentoDialog } from "./LeadFechamentoDialog";
import { LeadCancelamentoDialog } from "./LeadCancelamentoDialog";

interface Lead {
  id: string;
  nome_igreja: string;
  nome_responsavel: string | null;
  email: string | null;
  telefone: string | null;
  created_at: string;
  status_kanban: string | null;
  valor_fechamento: number | null;
  vendedor_id: string | null;
}

// Etapas do vendedor: apenas Contato, Negociação, Fechou, Cancelado
const VENDEDOR_KANBAN_COLUMNS = [
  { id: "Contato", label: "Contato", color: "bg-yellow-100 border-yellow-300" },
  { id: "Negociação", label: "Negociação", color: "bg-orange-100 border-orange-300" },
  { id: "Fechou", label: "Fechou", color: "bg-green-100 border-green-300" },
  { id: "Cancelado", label: "Cancelado", color: "bg-red-100 border-red-300" },
];

interface VendedorLeadsKanbanProps {
  vendedorId: string;
}

export function VendedorLeadsKanban({ vendedorId }: VendedorLeadsKanbanProps) {
  const queryClient = useQueryClient();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [leadParaFechar, setLeadParaFechar] = useState<Lead | null>(null);
  const [leadParaCancelar, setLeadParaCancelar] = useState<Lead | null>(null);

  const { data: leads, isLoading } = useQuery({
    queryKey: ["vendedor-leads-kanban", vendedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_leads_reativacao")
        .select("*")
        .eq("vendedor_id", vendedorId)
        .eq("created_via", "landing_page_form")
        .in("status_kanban", ["Contato", "Negociação", "Fechou", "Cancelado"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!vendedorId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ 
      leadId, 
      newStatus, 
      valorFechamento, 
      motivoPerda 
    }: { 
      leadId: string; 
      newStatus: string;
      valorFechamento?: number;
      motivoPerda?: string;
    }) => {
      const updateData: Record<string, unknown> = { 
        status_kanban: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === "Fechou" && valorFechamento) {
        updateData.valor_fechamento = valorFechamento;
        updateData.data_fechamento = new Date().toISOString();
        updateData.status_lead = "Reativado";
      }

      if (newStatus === "Cancelado" && motivoPerda) {
        updateData.motivo_perda = motivoPerda;
        updateData.status_lead = "Perdido";
      }

      const { error } = await supabase
        .from("ebd_leads_reativacao")
        .update(updateData)
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["vendedor-leads-kanban"] });
      queryClient.invalidateQueries({ queryKey: ["leads-landing-page"] });
      
      if (variables.newStatus === "Fechou") {
        toast.success("🎉 Fechamento registrado com sucesso!");
      } else if (variables.newStatus === "Cancelado") {
        toast.success("Cancelamento registrado");
      } else {
        toast.success("Status atualizado!");
      }
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    
    if (!draggedLead) return;
    if (draggedLead.status_kanban === columnId) {
      setDraggedLead(null);
      return;
    }

    // Se mover para Fechou, abre dialog para pedir valor
    if (columnId === "Fechou") {
      setLeadParaFechar(draggedLead);
      setDraggedLead(null);
      return;
    }

    // Se mover para Cancelado, abre dialog para pedir motivo
    if (columnId === "Cancelado") {
      setLeadParaCancelar(draggedLead);
      setDraggedLead(null);
      return;
    }

    // Movimentos normais
    updateStatusMutation.mutate({ leadId: draggedLead.id, newStatus: columnId });
    setDraggedLead(null);
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
  };

  const handleFechamento = (valor: number) => {
    if (leadParaFechar) {
      updateStatusMutation.mutate({
        leadId: leadParaFechar.id,
        newStatus: "Fechou",
        valorFechamento: valor,
      });
      setLeadParaFechar(null);
    }
  };

  const handleCancelamento = (motivo: string) => {
    if (leadParaCancelar) {
      updateStatusMutation.mutate({
        leadId: leadParaCancelar.id,
        newStatus: "Cancelado",
        motivoPerda: motivo,
      });
      setLeadParaCancelar(null);
    }
  };

  const getLeadsByColumn = (columnId: string) => {
    return leads?.filter(lead => lead.status_kanban === columnId) || [];
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return null;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {VENDEDOR_KANBAN_COLUMNS.map((column) => {
          const columnLeads = getLeadsByColumn(column.id);
          
          return (
            <div
              key={column.id}
              className={`flex-shrink-0 w-72 rounded-lg border-2 ${column.color}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="p-3 border-b border-inherit">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{column.label}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {columnLeads.length}
                  </Badge>
                </div>
              </div>
              
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="p-2 space-y-2">
                  {columnLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead)}
                      onDragEnd={handleDragEnd}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-1">
                              <Church className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                              <p className="font-medium text-sm leading-tight truncate">
                                {lead.nome_igreja}
                              </p>
                            </div>
                          </div>
                        </div>

                        {lead.nome_responsavel && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate">{lead.nome_responsavel}</span>
                          </div>
                        )}

                        {lead.email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                        )}

                        {lead.telefone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{lead.telefone}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>
                            {format(new Date(lead.created_at), "dd/MM/yy", { locale: ptBR })}
                          </span>
                        </div>

                        {lead.valor_fechamento && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                            <DollarSign className="h-3 w-3 shrink-0" />
                            <span>{formatCurrency(lead.valor_fechamento)}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  
                  {columnLeads.length === 0 && (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      Nenhum lead
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>

      <LeadFechamentoDialog
        open={!!leadParaFechar}
        onOpenChange={(open) => !open && setLeadParaFechar(null)}
        leadNome={leadParaFechar?.nome_igreja || ""}
        onConfirm={handleFechamento}
        isLoading={updateStatusMutation.isPending}
      />

      <LeadCancelamentoDialog
        open={!!leadParaCancelar}
        onOpenChange={(open) => !open && setLeadParaCancelar(null)}
        leadNome={leadParaCancelar?.nome_igreja || ""}
        onConfirm={handleCancelamento}
        isLoading={updateStatusMutation.isPending}
      />
    </>
  );
}
