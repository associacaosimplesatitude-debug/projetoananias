import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVendedor } from "@/hooks/useVendedor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Send, History, Zap, Mail, Eye, Loader2, CheckCircle, XCircle, Clock, MousePointerClick, EyeIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  isAdminView?: boolean;
}

export default function VendedorEmailsEBD({ isAdminView = false }: Props) {
  const vendedorHook = useVendedor();
  const vendedor = isAdminView ? null : vendedorHook?.vendedor ?? null;
  const queryClient = useQueryClient();
  const [selectedCliente, setSelectedCliente] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [emailContentHtml, setEmailContentHtml] = useState<string>("");
  const [showEmailContent, setShowEmailContent] = useState(false);

  // Fetch clientes - admin vê todos, vendedor vê os seus
  const { data: clientes = [] } = useQuery({
    queryKey: ["ebd-clientes-emails", isAdminView ? "all" : vendedor?.id],
    queryFn: async () => {
      let query = supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, nome_responsavel, email_superintendente")
        .not("email_superintendente", "is", null)
        .order("nome_igreja");

      if (!isAdminView && vendedor?.id) {
        query = query.eq("vendedor_id", vendedor.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isAdminView || !!vendedor?.id,
  });

  // Fetch templates ativos
  const { data: templates = [] } = useQuery({
    queryKey: ["ebd-email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_email_templates")
        .select("*")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch logs - admin vê todos, vendedor vê os seus
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["ebd-email-logs", isAdminView ? "all" : vendedor?.id],
    queryFn: async () => {
      let query = supabase
        .from("ebd_email_logs")
        .select("*, template:ebd_email_templates(nome, codigo, corpo_html), cliente:ebd_clientes(nome_igreja), vendedor:vendedores(nome)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!isAdminView && vendedor?.id) {
        query = query.eq("vendedor_id", vendedor.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isAdminView || !!vendedor?.id,
  });

  // Fetch stats automáticos
  const { data: autoStats } = useQuery({
    queryKey: ["ebd-email-auto-stats", isAdminView ? "all" : vendedor?.id],
    queryFn: async () => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const buildQuery = (startDate: string) => {
        let q = supabase.from("ebd_email_logs").select("id", { count: "exact", head: true })
          .eq("tipo_envio", "cron").gte("created_at", startDate);
        if (!isAdminView && vendedor?.id) {
          q = q.eq("vendedor_id", vendedor.id);
        }
        return q;
      };

      // Tracking stats for the month
      const buildTrackingQuery = () => {
        let q = supabase.from("ebd_email_logs")
          .select("id, email_aberto, link_clicado")
          .eq("status", "enviado")
          .gte("created_at", startOfMonth);
        if (!isAdminView && vendedor?.id) {
          q = q.eq("vendedor_id", vendedor.id);
        }
        return q;
      };

      const [hRes, wRes, mRes, trackingRes] = await Promise.all([
        buildQuery(startOfDay),
        buildQuery(startOfWeek),
        buildQuery(startOfMonth),
        buildTrackingQuery(),
      ]);

      const trackingData = trackingRes.data || [];
      const totalEnviados = trackingData.length;
      const totalAbertos = trackingData.filter((l: any) => l.email_aberto).length;
      const totalClicados = trackingData.filter((l: any) => l.link_clicado).length;

      return {
        hoje: hRes.count || 0,
        semana: wRes.count || 0,
        mes: mRes.count || 0,
        taxaAbertura: totalEnviados > 0 ? Math.round((totalAbertos / totalEnviados) * 100) : 0,
        taxaClique: totalEnviados > 0 ? Math.round((totalClicados / totalEnviados) * 100) : 0,
        totalAbertos,
        totalClicados,
        totalEnviados,
      };
    },
    enabled: isAdminView || !!vendedor?.id,
  });

  // Fetch próximos disparos
  const { data: proximosDisparos = [] } = useQuery({
    queryKey: ["ebd-proximos-disparos", isAdminView ? "all" : vendedor?.id],
    queryFn: async () => {
      const today = new Date();
      const in14days = new Date(today);
      in14days.setDate(in14days.getDate() + 14);

      let query = supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, nome_responsavel, data_proxima_compra")
        .not("data_proxima_compra", "is", null)
        .gte("data_proxima_compra", today.toISOString().split("T")[0])
        .lte("data_proxima_compra", in14days.toISOString().split("T")[0])
        .order("data_proxima_compra");

      if (!isAdminView && vendedor?.id) {
        query = query.eq("vendedor_id", vendedor.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isAdminView || !!vendedor?.id,
  });

  // Enviar email
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCliente || !selectedTemplate) {
        throw new Error("Selecione cliente e template");
      }
      const { data, error } = await supabase.functions.invoke("send-ebd-email", {
        body: {
          clienteId: selectedCliente,
          templateCode: selectedTemplate,
          vendedorId: vendedor?.id || null,
          tipoEnvio: "manual",
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Email enviado com sucesso! ✉️" });
      queryClient.invalidateQueries({ queryKey: ["ebd-email-logs"] });
      setSelectedCliente("");
      setSelectedTemplate("");
      setShowPreview(false);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao enviar email", description: err.message, variant: "destructive" });
    },
  });

  // Preview
  const handlePreview = () => {
    const template = templates.find((t: any) => t.codigo === selectedTemplate);
    const cliente = clientes.find((c: any) => c.id === selectedCliente);
    if (!template || !cliente) return;

    let html = template.corpo_html;
    const vars: Record<string, string> = {
      nome: cliente.nome_responsavel || cliente.nome_igreja,
      nome_igreja: cliente.nome_igreja,
      vendedor_nome: vendedor?.nome || "Vendedor",
      vendedor_telefone: "",
      link_painel: "https://gestaoebd.lovable.app/login/ebd",
      link_catalogo: "#",
      data_proxima_compra: "DD/MM/AAAA",
      dias_sem_login: "30",
      trimestre: "2025.1",
    };
    for (const [k, v] of Object.entries(vars)) {
      html = html.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
    setPreviewHtml(html);
    setShowPreview(true);
  };

  // Ver conteúdo do email enviado
  const handleViewEmailContent = (log: any) => {
    const templateHtml = (log.template as any)?.corpo_html;
    const dadosEnviados = log.dados_enviados as Record<string, any> | null;

    if (!templateHtml) {
      toast({ title: "Template não encontrado", variant: "destructive" });
      return;
    }

    let html = templateHtml;
    if (dadosEnviados) {
      for (const [k, v] of Object.entries(dadosEnviados)) {
        html = html.replace(new RegExp(`\\{${k}\\}`, "g"), String(v || ""));
      }
    }
    setEmailContentHtml(html);
    setShowEmailContent(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📧 Emails EBD</h1>
        <p className="text-muted-foreground">
          {isAdminView
            ? "Gerencie todos os emails EBD enviados por vendedores"
            : "Dispare emails para seus clientes e acompanhe os envios automáticos"}
        </p>
      </div>

      <Tabs defaultValue="enviar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="enviar" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Disparar Email
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="automaticos" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automáticos
          </TabsTrigger>
        </TabsList>

        {/* === Aba Enviar === */}
        <TabsContent value="enviar">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Enviar Email Manual
              </CardTitle>
              <CardDescription>Selecione o cliente e o template para enviar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cliente</label>
                  <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome_igreja} ({c.email_superintendente})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Template</label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t: any) => (
                        <SelectItem key={t.codigo} value={t.codigo}>
                          {t.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedTemplate && (
                <div className="bg-muted p-3 rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    {templates.find((t: any) => t.codigo === selectedTemplate)?.descricao}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={!selectedCliente || !selectedTemplate}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  onClick={() => sendMutation.mutate()}
                  disabled={!selectedCliente || !selectedTemplate || sendMutation.isPending}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {sendMutation.isPending ? "Enviando..." : "Enviar Email"}
                </Button>
              </div>

              {showPreview && previewHtml && (
                <div className="border rounded-lg overflow-hidden mt-4">
                  <div className="bg-muted px-4 py-2 border-b flex justify-between items-center">
                    <p className="text-sm font-medium">Preview do Email</p>
                    <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>✕</Button>
                  </div>
                  <div
                    className="bg-white p-0"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Aba Histórico === */}
        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Envios</CardTitle>
              <CardDescription>
                {isAdminView ? "Todos os emails enviados por todos os vendedores" : "Todos os emails enviados para seus clientes"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum email enviado ainda</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        {isAdminView && <TableHead>Vendedor</TableHead>}
                        <TableHead>Cliente</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aberto</TableHead>
                        <TableHead>Clicou</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                          {isAdminView && (
                            <TableCell className="text-sm">
                              {(log.vendedor as any)?.nome || "—"}
                            </TableCell>
                          )}
                          <TableCell className="text-sm">
                            {(log.cliente as any)?.nome_igreja || log.destinatario}
                          </TableCell>
                          <TableCell className="text-sm">
                            {(log.template as any)?.nome || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.tipo_envio === "cron" ? "secondary" : log.tipo_envio === "manual" ? "default" : "outline"}>
                              {log.tipo_envio === "cron" ? "⚡ Auto" : log.tipo_envio === "manual" ? "✋ Manual" : log.tipo_envio}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.status === "enviado" ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" /> Enviado
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" /> Erro
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <EyeIcon className={`h-4 w-4 ${log.email_aberto ? "text-green-600" : "text-muted-foreground/40"}`} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  {log.email_aberto
                                    ? `Aberto em ${format(new Date(log.data_abertura), "dd/MM/yy HH:mm", { locale: ptBR })}`
                                    : "Não aberto"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <MousePointerClick className={`h-4 w-4 ${log.link_clicado ? "text-green-600" : "text-muted-foreground/40"}`} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  {log.link_clicado
                                    ? `Clicou em ${format(new Date(log.data_clique), "dd/MM/yy HH:mm", { locale: ptBR })}`
                                    : "Não clicou"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewEmailContent(log)}
                              disabled={!(log.template as any)?.corpo_html}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Aba Automáticos === */}
        <TabsContent value="automaticos">
          <div className="space-y-4">
            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold">{autoStats?.hoje || 0}</p>
                  <p className="text-sm text-muted-foreground">Hoje</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold">{autoStats?.semana || 0}</p>
                  <p className="text-sm text-muted-foreground">Esta semana</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold">{autoStats?.mes || 0}</p>
                  <p className="text-sm text-muted-foreground">Este mês</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-green-600">{autoStats?.taxaAbertura || 0}%</p>
                  <p className="text-sm text-muted-foreground">Taxa de Abertura</p>
                  <p className="text-xs text-muted-foreground">{autoStats?.totalAbertos || 0}/{autoStats?.totalEnviados || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-blue-600">{autoStats?.taxaClique || 0}%</p>
                  <p className="text-sm text-muted-foreground">Taxa de Clique</p>
                  <p className="text-xs text-muted-foreground">{autoStats?.totalClicados || 0}/{autoStats?.totalEnviados || 0}</p>
                </CardContent>
              </Card>
            </div>

            {/* Próximos disparos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Próximos Disparos Agendados
                </CardTitle>
                <CardDescription>Clientes com data de reposição nos próximos 14 dias</CardDescription>
              </CardHeader>
              <CardContent>
                {proximosDisparos.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhum disparo agendado</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Igreja</TableHead>
                        <TableHead>Data Reposição</TableHead>
                        <TableHead>Dias</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {proximosDisparos.map((c: any) => {
                        const dias = Math.ceil(
                          (new Date(c.data_proxima_compra).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                        );
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.nome_igreja}</TableCell>
                            <TableCell>
                              {format(new Date(c.data_proxima_compra), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell>
                              <Badge variant={dias <= 3 ? "destructive" : dias <= 7 ? "secondary" : "outline"}>
                                {dias === 0 ? "Hoje!" : `${dias} dias`}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog para ver conteúdo do email */}
      <Dialog open={showEmailContent} onOpenChange={setShowEmailContent}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conteúdo do Email</DialogTitle>
          </DialogHeader>
          <div
            className="bg-white rounded-lg border p-0"
            dangerouslySetInnerHTML={{ __html: emailContentHtml }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
