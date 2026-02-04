import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Eye, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EmailTemplateDialog } from "./EmailTemplateDialog";
import { EmailPreviewDialog } from "./EmailPreviewDialog";

interface Template {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  assunto: string;
  corpo_html: string;
  variaveis: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function EmailTemplatesTab() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["royalties-email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_email_templates")
        .select("*")
        .order("codigo");

      if (error) throw error;
      return data as Template[];
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("royalties_email_templates")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["royalties-email-templates"] });
      toast({ title: "Template atualizado" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar template", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Templates de Email
          </CardTitle>
          <CardDescription>
            Edite os templates de email que serão enviados para os autores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Variáveis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates?.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-mono text-sm">
                    {template.codigo}
                  </TableCell>
                  <TableCell className="font-medium">{template.nome}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                    {template.descricao}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(template.variaveis as string[])?.slice(0, 3).map((v) => (
                        <Badge key={v} variant="outline" className="text-xs">
                          {`{${v}}`}
                        </Badge>
                      ))}
                      {(template.variaveis as string[])?.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{(template.variaveis as string[]).length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ id: template.id, is_active: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewTemplate(template)}
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingTemplate(template)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EmailTemplateDialog
        template={editingTemplate}
        open={!!editingTemplate}
        onOpenChange={(open) => !open && setEditingTemplate(null)}
      />

      <EmailPreviewDialog
        template={previewTemplate}
        open={!!previewTemplate}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
      />
    </>
  );
}
