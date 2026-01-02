import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Church, User, Mail, Phone, Calendar, MessageCircle, Target, GripVertical } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useState } from "react";
import { LeadsLandingKPIs } from "@/components/admin/LeadsLandingKPIs";

interface Lead {
  id: string;
  nome_igreja: string;
  nome_responsavel: string | null;
  email: string | null;
  telefone: string | null;
  created_at: string;
  como_conheceu: string | null;
  origem_lead: string | null;
  tipo_lead: string | null;
  status_lead: string;
  status_kanban: string | null;
  valor_fechamento: number | null;
  data_fechamento: string | null;
}

const KANBAN_COLUMNS = [
  { id: "Cadastrou", label: "Cadastrou", color: "bg-gray-100 border-gray-300", auto: true },
  { id: "Logou", label: "Logou", color: "bg-blue-100 border-blue-300", auto: true },
  { id: "Setup Preenchido", label: "Setup Preenchido", color: "bg-purple-100 border-purple-300", auto: true },
  { id: "Contato", label: "Contato", color: "bg-yellow-100 border-yellow-300", auto: false },
  { id: "Negociação", label: "Negociação", color: "bg-orange-100 border-orange-300", auto: false },
  { id: "Fechou", label: "Fechou", color: "bg-green-100 border-green-300", auto: true },
  { id: "Cancelado", label: "Cancelado", color: "bg-red-100 border-red-300", auto: false },
];

export default function LeadsLandingPage() {
  const queryClient = useQueryClient();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads-landing-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_leads_reativacao")
        .select("*")
        .eq("created_via", "landing_page_form")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("ebd_leads_reativacao")
        .update({ status_kanban: newStatus })
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-landing-page"] });
      toast.success("Status atualizado!");
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
    
    const column = KANBAN_COLUMNS.find(c => c.id === columnId);
    if (!column) return;

    // Prevent moving to automatic columns (except manual ones)
    if (column.auto && columnId !== draggedLead.status_kanban) {
      toast.error(`A coluna "${column.label}" é atualizada automaticamente`);
      setDraggedLead(null);
      return;
    }

    if (draggedLead.status_kanban !== columnId) {
      updateStatusMutation.mutate({ leadId: draggedLead.id, newStatus: columnId });
    }
    
    setDraggedLead(null);
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
  };

  const getLeadsByColumn = (columnId: string) => {
    return leads?.filter(lead => (lead.status_kanban || "Cadastrou") === columnId) || [];
  };

  const getCampanhaFromComoConheceu = (como: string | null) => {
    if (!como) return null;
    if (["Google", "YouTube", "Meta Ads"].includes(como)) {
      return como;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full">
      <div>
        <h1 className="text-2xl font-bold">Leads de Landing Page</h1>
        <p className="text-muted-foreground">
          Kanban de leads cadastrados via formulário ({leads?.length || 0} leads)
        </p>
      </div>

      {/* KPIs */}
      <LeadsLandingKPIs leads={leads || []} />

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((column) => {
          const columnLeads = getLeadsByColumn(column.id);
          
          return (
            <div
              key={column.id}
              className={`flex-shrink-0 w-64 rounded-lg border-2 ${column.color}`}
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
                {column.auto && (
                  <span className="text-xs text-muted-foreground">Automático</span>
                )}
              </div>
              
              <ScrollArea className="h-[calc(100vh-520px)]">
                <div className="p-2 space-y-2">
                  {columnLeads.map((lead) => {
                    const campanha = getCampanhaFromComoConheceu(lead.como_conheceu);
                    
                    return (
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
                                <p className="font-medium text-xs leading-tight truncate">
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
                              {format(new Date(lead.created_at), "dd/MM/yy HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                          </div>

                          {(campanha || lead.como_conheceu) && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {campanha && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">
                                  <Target className="h-2.5 w-2.5 mr-0.5" />
                                  {campanha}
                                </Badge>
                              )}
                              {lead.como_conheceu && !campanha && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  <MessageCircle className="h-2.5 w-2.5 mr-0.5" />
                                  {lead.como_conheceu}
                                </Badge>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  
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
    </div>
  );
}
