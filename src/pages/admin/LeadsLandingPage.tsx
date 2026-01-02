import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Church, User, Mail, Phone, Calendar, MessageCircle, Target, GripVertical, UserPlus, DollarSign } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useState } from "react";
import { LeadsLandingKPIs } from "@/components/admin/LeadsLandingKPIs";
import { AtribuirVendedorDialog } from "@/components/admin/AtribuirVendedorDialog";

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
  vendedor_id: string | null;
  motivo_perda: string | null;
}

interface Vendedor {
  id: string;
  nome: string;
}

// KANBAN DO GERENTE: inclui "Atribuir Vendedor" após "Setup Preenchido"
const KANBAN_COLUMNS = [
  { id: "Cadastrou", label: "Cadastrou", color: "bg-gray-100 border-gray-300", auto: true, canDrop: false },
  { id: "Logou", label: "Logou", color: "bg-blue-100 border-blue-300", auto: true, canDrop: false },
  { id: "Setup Preenchido", label: "Setup Preenchido", color: "bg-purple-100 border-purple-300", auto: true, canDrop: false },
  { id: "Atribuir Vendedor", label: "Atribuir Vendedor", color: "bg-amber-100 border-amber-300", auto: true, canDrop: false },
  { id: "Contato", label: "Contato", color: "bg-yellow-100 border-yellow-300", auto: false, canDrop: true },
  { id: "Negociação", label: "Negociação", color: "bg-orange-100 border-orange-300", auto: false, canDrop: true },
  { id: "Fechou", label: "Fechou", color: "bg-green-100 border-green-300", auto: false, canDrop: false },
  { id: "Cancelado", label: "Cancelado", color: "bg-red-100 border-red-300", auto: false, canDrop: false },
];

export default function LeadsLandingPage() {
  const queryClient = useQueryClient();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [leadParaAtribuir, setLeadParaAtribuir] = useState<Lead | null>(null);

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

  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome")
        .eq("status", "Ativo")
        .order("nome");

      if (error) throw error;
      return data as Vendedor[];
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

  const atribuirVendedorMutation = useMutation({
    mutationFn: async ({ leadId, vendedorId }: { leadId: string; vendedorId: string }) => {
      // Atribui vendedor e move para Contato
      const { error } = await supabase
        .from("ebd_leads_reativacao")
        .update({ 
          vendedor_id: vendedorId, 
          status_kanban: "Contato",
          updated_at: new Date().toISOString()
        })
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-landing-page"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-leads-kanban"] });
      toast.success("Vendedor atribuído! Lead movido para Contato");
      setLeadParaAtribuir(null);
    },
    onError: () => {
      toast.error("Erro ao atribuir vendedor");
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

    // Verificar se pode soltar nessa coluna
    if (!column.canDrop) {
      if (column.auto) {
        toast.error(`A coluna "${column.label}" é atualizada automaticamente`);
      } else {
        toast.error(`Não é possível mover leads diretamente para "${column.label}"`);
      }
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
    return leads?.filter(lead => {
      const status = lead.status_kanban || "Cadastrou";
      
      // Leads em "Setup Preenchido" SEM vendedor vão para "Atribuir Vendedor"
      if (columnId === "Atribuir Vendedor") {
        return status === "Setup Preenchido" && !lead.vendedor_id;
      }
      
      // Leads em "Setup Preenchido" COM vendedor ficam em "Setup Preenchido" (transição antiga)
      if (columnId === "Setup Preenchido") {
        return status === "Setup Preenchido" && lead.vendedor_id;
      }
      
      return status === columnId;
    }) || [];
  };

  const getCampanhaFromComoConheceu = (como: string | null) => {
    if (!como) return null;
    if (["Google", "YouTube", "Meta Ads"].includes(como)) {
      return como;
    }
    return null;
  };

  const getVendedorNome = (vendedorId: string | null) => {
    if (!vendedorId) return null;
    const vendedor = vendedores.find(v => v.id === vendedorId);
    return vendedor?.nome || null;
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
          const isAtribuirVendedor = column.id === "Atribuir Vendedor";
          
          return (
            <div
              key={column.id}
              className={`flex-shrink-0 w-64 rounded-lg border-2 ${column.color}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="p-3 border-b border-inherit">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-1">
                    {isAtribuirVendedor && <UserPlus className="h-3.5 w-3.5" />}
                    {column.label}
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {columnLeads.length}
                  </Badge>
                </div>
                {column.auto && !isAtribuirVendedor && (
                  <span className="text-xs text-muted-foreground">Automático</span>
                )}
                {isAtribuirVendedor && (
                  <span className="text-xs text-amber-700">Ação obrigatória</span>
                )}
              </div>
              
              <ScrollArea className="h-[calc(100vh-520px)]">
                <div className="p-2 space-y-2">
                  {columnLeads.map((lead) => {
                    const campanha = getCampanhaFromComoConheceu(lead.como_conheceu);
                    const vendedorNome = getVendedorNome(lead.vendedor_id);
                    
                    return (
                      <Card
                        key={lead.id}
                        className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                        draggable={!isAtribuirVendedor}
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

                          {vendedorNome && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                              <User className="h-2.5 w-2.5 mr-0.5" />
                              {vendedorNome}
                            </Badge>
                          )}

                          {lead.valor_fechamento && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                              <DollarSign className="h-3 w-3 shrink-0" />
                              <span>{formatCurrency(lead.valor_fechamento)}</span>
                            </div>
                          )}

                          {lead.motivo_perda && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-200">
                              {lead.motivo_perda}
                            </Badge>
                          )}

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

                          {/* Botão para atribuir vendedor */}
                          {isAtribuirVendedor && (
                            <Button
                              size="sm"
                              className="w-full mt-2 h-7 text-xs"
                              onClick={() => setLeadParaAtribuir(lead)}
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              Atribuir Vendedor
                            </Button>
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

      {/* Dialog de atribuição */}
      <AtribuirVendedorDialog
        open={!!leadParaAtribuir}
        onOpenChange={(open) => !open && setLeadParaAtribuir(null)}
        lead={leadParaAtribuir}
        onConfirm={(leadId, vendedorId) => atribuirVendedorMutation.mutate({ leadId, vendedorId })}
        isLoading={atribuirVendedorMutation.isPending}
      />
    </div>
  );
}
