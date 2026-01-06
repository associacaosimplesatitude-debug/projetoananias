import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVendedor } from "@/hooks/useVendedor";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { PlaybookLeadCard } from "@/components/vendedor/PlaybookLeadCard";
import { LeadFechamentoDialog } from "@/components/vendedor/LeadFechamentoDialog";
import { LeadCancelamentoDialog } from "@/components/vendedor/LeadCancelamentoDialog";

interface Lead {
  id: string;
  nome_igreja: string;
  nome_responsavel: string | null;
  email: string | null;
  telefone: string | null;
  created_at: string;
  status_kanban: string | null;
  como_conheceu: string | null;
  observacoes: string | null;
  valor_fechamento: number | null;
}

const KANBAN_STAGES = [
  { id: "Contato", label: "Contato" },
  { id: "Negociação", label: "Negociação" },
  { id: "Fechou", label: "Fechou" },
  { id: "Cancelado", label: "Cancelado" },
];

export default function VendedorLeadsLandingPage() {
  const { vendedor, isLoading: vendedorLoading } = useVendedor();
  const queryClient = useQueryClient();
  const [leadParaFechar, setLeadParaFechar] = useState<Lead | null>(null);
  const [leadParaCancelar, setLeadParaCancelar] = useState<Lead | null>(null);
  const [currentTab, setCurrentTab] = useState("Contato");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["vendedor-leads-landing", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];
      const { data, error } = await supabase
        .from("ebd_leads_reativacao")
        .select("*")
        .eq("vendedor_id", vendedor.id)
        .eq("created_via", "landing_page_form")
        .in("status_kanban", ["Contato", "Negociação", "Fechou", "Cancelado"])
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!vendedor?.id,
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
      queryClient.invalidateQueries({ queryKey: ["vendedor-leads-landing"] });
      
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

  const handleAdvanceStage = (leadId: string, currentStage: string) => {
    const stages = ["Contato", "Negociação", "Fechou"];
    const currentIndex = stages.indexOf(currentStage);
    const nextStage = stages[currentIndex + 1];

    if (nextStage === "Fechou") {
      const lead = leads.find(l => l.id === leadId);
      if (lead) setLeadParaFechar(lead);
      return;
    }

    if (nextStage) {
      updateStatusMutation.mutate({ leadId, newStatus: nextStage });
    }
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

  const getLeadsByStage = (stageId: string) => {
    return leads.filter(lead => lead.status_kanban === stageId);
  };

  if (vendedorLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-purple-500" />
          Leads da Landing Page
        </h2>
        <p className="text-muted-foreground">
          Leads que se cadastraram para testar o sistema
        </p>
      </div>

      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <TabsList className="grid w-full grid-cols-4">
          {KANBAN_STAGES.map((stage) => {
            const count = getLeadsByStage(stage.id).length;
            return (
              <TabsTrigger key={stage.id} value={stage.id} className="relative">
                {stage.label}
                {count > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {KANBAN_STAGES.map((stage) => {
          const stageLeads = getLeadsByStage(stage.id);
          return (
            <TabsContent key={stage.id} value={stage.id} className="mt-6">
              {stageLeads.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Megaphone className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Nenhum lead na etapa "{stage.label}"
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {stageLeads.map((lead) => (
                    <PlaybookLeadCard
                      key={lead.id}
                      lead={lead}
                      onAdvanceStage={handleAdvanceStage}
                      isAdvancing={updateStatusMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Dialogs */}
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
    </div>
  );
}
