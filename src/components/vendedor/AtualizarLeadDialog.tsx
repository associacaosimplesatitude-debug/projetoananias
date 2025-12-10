import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Lead {
  id: string;
  nome_igreja: string;
  status_lead: string;
  motivo_perda: string | null;
  data_followup: string | null;
  observacoes: string | null;
}

interface AtualizarLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onSuccess: () => void;
}

const STATUS_OPTIONS = [
  "Não Contatado",
  "Em Negociação",
  "Reativado",
  "Perdido",
];

const MOTIVO_PERDA_OPTIONS = [
  "Preço",
  "Concorrência",
  "Logística",
  "Igreja Fechou",
  "Sem Interesse",
  "Outro",
];

export function AtualizarLeadDialog({ open, onOpenChange, lead, onSuccess }: AtualizarLeadDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    status_lead: lead?.status_lead || "Não Contatado",
    motivo_perda: lead?.motivo_perda || "",
    data_followup: lead?.data_followup || "",
    observacoes: lead?.observacoes || "",
  });

  // Reset form when lead changes
  useState(() => {
    if (lead) {
      setFormData({
        status_lead: lead.status_lead || "Não Contatado",
        motivo_perda: lead.motivo_perda || "",
        data_followup: lead.data_followup || "",
        observacoes: lead.observacoes || "",
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    setIsSubmitting(true);
    try {
      const updateData: any = {
        status_lead: formData.status_lead,
        data_followup: formData.data_followup || null,
        observacoes: formData.observacoes || null,
      };

      if (formData.status_lead === "Perdido") {
        updateData.motivo_perda = formData.motivo_perda || null;
      }

      const { error } = await supabase
        .from("ebd_leads_reativacao")
        .update(updateData)
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Lead atualizado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
      toast.error("Erro ao atualizar lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Igreja: <strong>{lead.nome_igreja}</strong>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Status do Lead</Label>
            <Select
              value={formData.status_lead}
              onValueChange={(value) => setFormData({ ...formData, status_lead: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.status_lead === "Perdido" && (
            <div className="space-y-2">
              <Label>Motivo da Perda</Label>
              <Select
                value={formData.motivo_perda}
                onValueChange={(value) => setFormData({ ...formData, motivo_perda: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVO_PERDA_OPTIONS.map((motivo) => (
                    <SelectItem key={motivo} value={motivo}>
                      {motivo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Data do Próximo Follow-up</Label>
            <Input
              type="date"
              value={formData.data_followup}
              onChange={(e) => setFormData({ ...formData, data_followup: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações / Próximo Passo</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Descreva o próximo passo ou observações sobre o lead..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
