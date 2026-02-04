import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface Template {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  assunto: string;
  corpo_html: string;
  variaveis: string[];
  is_active: boolean;
}

interface EmailTemplateDialogProps {
  template: Template | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailTemplateDialog({ template, open, onOpenChange }: EmailTemplateDialogProps) {
  const queryClient = useQueryClient();
  const [assunto, setAssunto] = useState("");
  const [corpoHtml, setCorpoHtml] = useState("");

  useEffect(() => {
    if (template) {
      setAssunto(template.assunto);
      setCorpoHtml(template.corpo_html);
    }
  }, [template]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!template) return;

      const { error } = await supabase
        .from("royalties_email_templates")
        .update({
          assunto,
          corpo_html: corpoHtml,
          updated_at: new Date().toISOString(),
        })
        .eq("id", template.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["royalties-email-templates"] });
      toast({ title: "Template atualizado com sucesso!" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar template", variant: "destructive" });
    },
  });

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Template: {template.nome}</DialogTitle>
          <DialogDescription>
            Código: <code className="bg-muted px-1 rounded">{template.codigo}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Variáveis Disponíveis</Label>
            <div className="flex flex-wrap gap-2">
              {(template.variaveis as string[])?.map((v) => (
                <Badge
                  key={v}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => {
                    navigator.clipboard.writeText(`{${v}}`);
                    toast({ title: `{${v}} copiado!` });
                  }}
                >
                  {`{${v}}`}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Clique para copiar uma variável
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assunto">Assunto do Email</Label>
            <Input
              id="assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Ex: 🎉 Nova venda: {livro}"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="corpo">Corpo do Email (HTML)</Label>
            <Textarea
              id="corpo"
              value={corpoHtml}
              onChange={(e) => setCorpoHtml(e.target.value)}
              placeholder="HTML do email..."
              className="min-h-[400px] font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
