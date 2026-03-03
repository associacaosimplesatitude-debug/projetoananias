import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Copy, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import WhatsAppTemplateCreator from "./WhatsAppTemplateCreator";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  RASCUNHO: { label: "Rascunho", variant: "secondary" },
  PENDENTE: { label: "Pendente", variant: "outline" },
  APROVADO: { label: "Aprovado", variant: "default" },
  REJEITADO: { label: "Rejeitado", variant: "destructive" },
};

export default function WhatsAppTemplatesList() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [showCreator, setShowCreator] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["whatsapp-templates", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("whatsapp_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "TODOS") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template excluído!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (template: any) => {
      const { error } = await supabase.from("whatsapp_templates").insert({
        nome: template.nome + "_copia",
        categoria: template.categoria,
        idioma: template.idioma,
        corpo: template.corpo,
        rodape: template.rodape,
        botoes: template.botoes,
        variaveis_usadas: template.variaveis_usadas,
        status: "RASCUNHO",
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template duplicado!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const checkStatus = async (templateId: string) => {
    setCheckingId(templateId);
    try {
      const response = await supabase.functions.invoke("whatsapp-submit-template", {
        body: { action: "check_status", template_id: templateId },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success(`Status atualizado: ${response.data.status}`);
    } catch (err: any) {
      toast.error("Erro ao verificar: " + err.message);
    } finally {
      setCheckingId(null);
    }
  };

  const handleEdit = (template: any) => {
    setEditingTemplate({
      id: template.id,
      nome: template.nome,
      categoria: template.categoria,
      idioma: template.idioma,
      corpo: template.corpo,
      rodape: template.rodape || "",
      botoes: typeof template.botoes === "string" ? JSON.parse(template.botoes) : template.botoes || [],
      status: template.status,
      cabecalho_tipo: template.cabecalho_tipo || "NONE",
      cabecalho_texto: template.cabecalho_texto || "",
      cabecalho_midia_url: template.cabecalho_midia_url || "",
    });
    setShowCreator(true);
  };

  if (showCreator) {
    return (
      <WhatsAppTemplateCreator
        editingTemplate={editingTemplate}
        onClose={() => {
          setShowCreator(false);
          setEditingTemplate(null);
        }}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">Templates de Mensagem</CardTitle>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                <SelectItem value="PENDENTE">Pendente</SelectItem>
                <SelectItem value="APROVADO">Aprovado</SelectItem>
                <SelectItem value="REJEITADO">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingTemplate(null); setShowCreator(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Template
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8 text-muted-foreground">Carregando...</div>
        ) : !templates?.length ? (
          <div className="text-center p-8 text-muted-foreground">
            Nenhum template encontrado. Crie seu primeiro template!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t: any) => {
                  const sb = STATUS_BADGES[t.status] || STATUS_BADGES.RASCUNHO;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-sm">{t.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{t.categoria}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sb.variant} className="text-xs">{sb.label}</Badge>
                        {t.status === "REJEITADO" && t.meta_rejection_reason && (
                          <p className="text-xs text-destructive mt-1">{t.meta_rejection_reason}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(t.created_at), "dd/MM/yy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {t.status === "RASCUNHO" && (
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(t)} title="Editar">
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => duplicateMutation.mutate(t)} title="Duplicar">
                            <Copy className="h-4 w-4" />
                          </Button>
                          {t.status === "PENDENTE" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => checkStatus(t.id)}
                              disabled={checkingId === t.id}
                              title="Verificar Status"
                            >
                              {checkingId === t.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {t.status === "RASCUNHO" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Excluir este template?")) deleteMutation.mutate(t.id);
                              }}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
