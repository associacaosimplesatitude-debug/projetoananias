import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Send, Eye, EyeOff, Save, CheckCircle2, XCircle, Clock, MessageSquare, Settings, ChevronDown, ChevronRight, Webhook, Activity, Smartphone, Loader2, Filter, Users, Phone } from "lucide-react";
import { format } from "date-fns";

const MESSAGE_TYPES = [
  { value: "pedido_aprovado", label: "Pedido Aprovado" },
  { value: "dados_acesso", label: "Dados de Acesso" },
  { value: "rastreio", label: "Código de Rastreio" },
  { value: "cupom", label: "Cupom de Desconto" },
  { value: "promocao", label: "Promoção" },
  { value: "lembrete_aula", label: "Lembrete de Aula" },
  { value: "agenda_aulas", label: "Agenda de Aulas" },
];

const TEMPLATES: Record<string, string> = {
  pedido_aprovado: "Olá {nome}! 🎉\n\nSeu pedido foi aprovado com sucesso!\n\nEm breve você receberá mais informações sobre o envio.\n\nObrigado pela preferência!",
  dados_acesso: "Olá {nome}! 👋\n\nSeguem seus dados de acesso ao sistema EBD:\n\n📧 Login: {email}\n🔑 Senha: {senha}\n\nAcesse em: {link}\n\nQualquer dúvida, estamos à disposição!",
  rastreio: "Olá {nome}! 📦\n\nSeu pedido foi enviado!\n\n🚚 Código de rastreio: {codigo}\n\nAcompanhe em: https://www.linkcorreios.com.br/?id={codigo}\n\nBoas aulas!",
  cupom: "Olá {nome}! 🎁\n\nVocê ganhou um cupom de desconto!\n\n🏷️ Cupom: {cupom}\n💰 Desconto: {desconto}\n📅 Válido até: {validade}\n\nAproveite!",
  promocao: "Olá {nome}! 🔥\n\nTemos uma promoção especial para você!\n\n{detalhes}\n\nNão perca essa oportunidade!",
  lembrete_aula: "Olá {nome}! 📚\n\nLembrete: sua aula da EBD é amanhã!\n\n📅 Data: {data}\n⏰ Horário: {horario}\n📖 Lição: {licao}\n\nNão falte! 🙏",
  agenda_aulas: "Olá {nome}! 📋\n\nConfira a agenda de aulas da EBD:\n\n{agenda}\n\nBoas aulas! 🙏",
};

function JsonBlock({ data, label }: { data: unknown; label: string }) {
  if (!data) return null;
  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto max-h-60 overflow-y-auto font-mono">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function CredentialsTab() {
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [showClientToken, setShowClientToken] = useState(false);
  const [instanceId, setInstanceId] = useState("");
  const [token, setToken] = useState("");
  const [clientToken, setClientToken] = useState("");
  const [statusResult, setStatusResult] = useState<any>(null);
  const [deviceResult, setDeviceResult] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingDevice, setLoadingDevice] = useState(false);

  // Auto envio toggle
  const [autoEnvio, setAutoEnvio] = useState(true);
  const [loadingAutoEnvio, setLoadingAutoEnvio] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings-zapi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["zapi_instance_id", "zapi_token", "zapi_client_token"]);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((s) => { map[s.key] = s.value; });
      return map;
    },
  });

  const { data: autoEnvioSetting } = useQuery({
    queryKey: ["system-settings-auto-envio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "whatsapp_auto_envio_ativo")
        .maybeSingle();
      if (error) throw error;
      return data?.value !== "false";
    },
  });

  useState(() => {
    if (settings) {
      setInstanceId(settings["zapi_instance_id"] || "");
      setToken(settings["zapi_token"] || "");
      setClientToken(settings["zapi_client_token"] || "");
    }
  });

  useEffect(() => {
    if (autoEnvioSetting !== undefined) setAutoEnvio(autoEnvioSetting);
  }, [autoEnvioSetting]);

  const currentInstanceId = instanceId || settings?.["zapi_instance_id"] || "";
  const currentToken = token || settings?.["zapi_token"] || "";
  const currentClientToken = clientToken || settings?.["zapi_client_token"] || "";
  const isConfigured = !!(settings?.["zapi_instance_id"] && settings?.["zapi_token"] && settings?.["zapi_client_token"]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = [
        { key: "zapi_instance_id", value: currentInstanceId, description: "Z-API ID da Instância" },
        { key: "zapi_token", value: currentToken, description: "Z-API Token da Instância" },
        { key: "zapi_client_token", value: currentClientToken, description: "Z-API Token de Segurança da Conta" },
      ];
      for (const entry of entries) {
        const { error } = await supabase
          .from("system_settings")
          .upsert({ key: entry.key, value: entry.value, description: entry.description, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["system-settings-zapi"] }); toast.success("Credenciais salvas com sucesso!"); },
    onError: (err: Error) => { toast.error("Erro ao salvar: " + err.message); },
  });

  const fetchInstanceInfo = async (action: "status" | "device") => {
    const setLoading = action === "status" ? setLoadingStatus : setLoadingDevice;
    const setResult = action === "status" ? setStatusResult : setDeviceResult;
    setLoading(true);
    setResult(null);
    try {
      const response = await supabase.functions.invoke("zapi-instance-info", { body: { action } });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      setResult(response.data?.data);
    } catch (err: any) {
      toast.error(`Erro ao buscar ${action}: ${err.message}`);
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleAutoEnvio = async (checked: boolean) => {
    setLoadingAutoEnvio(true);
    try {
      await supabase
        .from("system_settings")
        .upsert({ key: "whatsapp_auto_envio_ativo", value: checked ? "true" : "false", description: "Liga/desliga envio automático de WhatsApp", updated_at: new Date().toISOString() }, { onConflict: "key" });
      setAutoEnvio(checked);
      queryClient.invalidateQueries({ queryKey: ["system-settings-auto-envio"] });
      toast.success(checked ? "Envio automático ativado" : "Envio automático desativado");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoadingAutoEnvio(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center p-8 text-muted-foreground">Carregando...</div>;


  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Envio Automático de WhatsApp</CardTitle>
              <CardDescription>Controle o envio automático de mensagens do funil pós-venda e notificações de pedidos.</CardDescription>
            </div>
            <Switch checked={autoEnvio} onCheckedChange={toggleAutoEnvio} disabled={loadingAutoEnvio} />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Credenciais Z-API</CardTitle>
              <CardDescription>Configure as credenciais da sua instância Z-API para envio de mensagens WhatsApp.</CardDescription>
            </div>
            <Badge variant={isConfigured ? "default" : "destructive"} className="gap-1">
              {isConfigured ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {isConfigured ? "Configurado" : "Não configurado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instance-id">ID da Instância</Label>
            <Input id="instance-id" placeholder="Ex: 3C7A..." value={currentInstanceId} onChange={(e) => setInstanceId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zapi-token">Token da Instância</Label>
            <div className="relative">
              <Input id="zapi-token" type={showToken ? "text" : "password"} placeholder="Token da instância Z-API" value={currentToken} onChange={(e) => setToken(e.target.value)} className="pr-10" />
              <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-token">Token de Segurança da Conta</Label>
            <div className="relative">
              <Input id="client-token" type={showClientToken ? "text" : "password"} placeholder="Token de segurança da conta" value={currentClientToken} onChange={(e) => setClientToken(e.target.value)} className="pr-10" />
              <button type="button" onClick={() => setShowClientToken(!showClientToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showClientToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Credenciais"}
            </Button>
            <Button variant="outline" onClick={() => fetchInstanceInfo("status")} disabled={loadingStatus || !isConfigured} className="gap-2">
              {loadingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Verificar Status
            </Button>
            <Button variant="outline" onClick={() => fetchInstanceInfo("device")} disabled={loadingDevice || !isConfigured} className="gap-2">
              {loadingDevice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              Dados do Celular
            </Button>
          </div>
        </CardContent>
      </Card>

      {statusResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Status da Instância
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!statusResult.error && (
              <div className="flex flex-wrap gap-3">
                <Badge variant={statusResult.connected ? "default" : "destructive"}>
                  {statusResult.connected ? "Conectado" : "Desconectado"}
                </Badge>
                {statusResult.smartPhoneConnected !== undefined && (
                  <Badge variant={statusResult.smartPhoneConnected ? "default" : "secondary"}>
                    Celular: {statusResult.smartPhoneConnected ? "Online" : "Offline"}
                  </Badge>
                )}
                {statusResult.session && (
                  <Badge variant="outline">Sessão: {statusResult.session}</Badge>
                )}
              </div>
            )}
            <JsonBlock data={statusResult} label="📋 Resposta completa" />
          </CardContent>
        </Card>
      )}

      {deviceResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Dados do Celular
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!deviceResult.error && (
              <div className="flex flex-wrap gap-3 items-center">
                {deviceResult.imgUrl && (
                  <img src={deviceResult.imgUrl} alt="Foto do perfil" className="h-10 w-10 rounded-full object-cover" />
                )}
                {deviceResult.phone && <Badge variant="outline">📞 {deviceResult.phone}</Badge>}
                {deviceResult.name && <Badge variant="outline">👤 {deviceResult.name}</Badge>}
                {deviceResult.device?.device_model && <Badge variant="secondary">📱 {deviceResult.device.device_model}</Badge>}
              </div>
            )}
            <JsonBlock data={deviceResult} label="📋 Resposta completa" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SendMessageTab() {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: historico = [], isLoading: loadingHistorico } = useQuery({
    queryKey: ["whatsapp-mensagens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_mensagens")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const response = await supabase.functions.invoke("send-whatsapp-message", {
        body: { tipo_mensagem: tipo || "manual", telefone: telefone.replace(/\D/g, ""), nome, mensagem, imagem_url: imagemUrl || undefined },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => { toast.success("Mensagem enviada com sucesso!"); setTelefone(""); setNome(""); setMensagem(""); setImagemUrl(""); setTipo(""); queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens"] }); },
    onError: (err: Error) => { toast.error("Erro: " + err.message); queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens"] }); },
  });

  const handleTipoChange = (value: string) => { setTipo(value); if (TEMPLATES[value]) setMensagem(TEMPLATES[value]); };

  const statusIcon = (status: string) => {
    if (status === "enviado") return <CheckCircle2 className="h-4 w-4 text-primary" />;
    if (status === "erro") return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Enviar Mensagem</CardTitle>
          <CardDescription>Envie mensagens de texto ou imagem via WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Mensagem</Label>
              <Select value={tipo} onValueChange={handleTipoChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {MESSAGE_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Telefone (com DDD)</Label>
              <Input placeholder="5521999999999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nome do Destinatário</Label>
            <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea placeholder="Digite a mensagem..." rows={6} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>URL da Imagem (opcional)</Label>
            <Input placeholder="https://exemplo.com/imagem.jpg" value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} />
          </div>
          <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || !telefone || !mensagem} className="gap-2">
            <Send className="h-4 w-4" />
            {sendMutation.isPending ? "Enviando..." : "Enviar Mensagem"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Mensagens</CardTitle>
          <CardDescription>Últimas 50 mensagens enviadas. Clique para ver detalhes.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistorico ? (
            <p className="text-muted-foreground text-center py-4">Carregando...</p>
          ) : historico.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhuma mensagem enviada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((msg: any) => (
                    <Collapsible key={msg.id} open={expandedRow === msg.id} onOpenChange={(open) => setExpandedRow(open ? msg.id : null)} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer">
                            <TableCell className="p-2">
                              {expandedRow === msg.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </TableCell>
                            <TableCell>{statusIcon(msg.status)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {MESSAGE_TYPES.find((t) => t.value === msg.tipo_mensagem)?.label || msg.tipo_mensagem}
                              </Badge>
                            </TableCell>
                            <TableCell>{msg.nome_destino || "-"}</TableCell>
                            <TableCell className="font-mono text-xs">{msg.telefone_destino}</TableCell>
                            <TableCell className="text-xs">{format(new Date(msg.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <tr>
                            <td colSpan={6} className="p-4 bg-muted/30 border-b">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <JsonBlock data={msg.payload_enviado} label="📤 Payload Enviado" />
                                <JsonBlock data={msg.resposta_recebida} label="📥 Resposta Z-API" />
                                {msg.erro_detalhes && (
                                  <div className="md:col-span-2">
                                    <JsonBlock data={msg.erro_detalhes} label="❌ Erro" />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WebhooksTab() {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ["whatsapp-webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_webhooks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Webhooks Recebidos</CardTitle>
        <CardDescription>Últimos 100 eventos recebidos da Z-API. Atualiza a cada 10s.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-4">Carregando...</p>
        ) : webhooks.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Nenhum webhook recebido ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Message ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((wh: any) => (
                  <Collapsible key={wh.id} open={expandedRow === wh.id} onOpenChange={(open) => setExpandedRow(open ? wh.id : null)} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer">
                          <TableCell className="p-2">
                            {expandedRow === wh.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="text-xs">{format(new Date(wh.created_at), "dd/MM/yyyy HH:mm:ss")}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{wh.evento}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{wh.telefone || "-"}</TableCell>
                          <TableCell className="font-mono text-xs max-w-[200px] truncate">{wh.message_id || "-"}</TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={5} className="p-4 bg-muted/30 border-b">
                            <JsonBlock data={wh.payload} label="📋 Payload Completo" />
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const FUNIL_FASES = [
  { fase: 1, label: "Boas-vindas Enviada", cor: "bg-blue-500", corBg: "bg-blue-50 dark:bg-blue-950", corTexto: "text-blue-700 dark:text-blue-300", corBorda: "border-blue-300" },
  { fase: 2, label: "Lembrete de Login", cor: "bg-orange-500", corBg: "bg-orange-50 dark:bg-orange-950", corTexto: "text-orange-700 dark:text-orange-300", corBorda: "border-orange-300" },
  { fase: 3, label: "Onboarding / Pesquisa", cor: "bg-yellow-500", corBg: "bg-yellow-50 dark:bg-yellow-950", corTexto: "text-yellow-700 dark:text-yellow-300", corBorda: "border-yellow-300" },
  { fase: 4, label: "Configuração de Escala", cor: "bg-lime-500", corBg: "bg-lime-50 dark:bg-lime-950", corTexto: "text-lime-700 dark:text-lime-300", corBorda: "border-lime-300" },
  { fase: 5, label: "Ativo / Concluído", cor: "bg-green-500", corBg: "bg-green-50 dark:bg-green-950", corTexto: "text-green-700 dark:text-green-300", corBorda: "border-green-300" },
];

function FunilTab() {
  const [selectedFase, setSelectedFase] = useState<number | null>(null);

  const { data: contagens = {}, isLoading } = useQuery({
    queryKey: ["funil-posv-contagens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funil_posv_tracking")
        .select("fase_atual, concluido");
      if (error) throw error;
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      (data || []).forEach((t: { fase_atual: number }) => {
        counts[t.fase_atual] = (counts[t.fase_atual] || 0) + 1;
      });
      return counts;
    },
    refetchInterval: 30000,
  });

  const totalClientes = Object.values(contagens).reduce((a: number, b: number) => a + b, 0);

  const { data: clientesFase = [], isLoading: loadingClientes } = useQuery({
    queryKey: ["funil-posv-clientes", selectedFase],
    queryFn: async () => {
      if (!selectedFase) return [];
      const { data: trackings, error } = await supabase
        .from("funil_posv_tracking")
        .select("cliente_id, fase_atual, fase1_enviada_em, ultima_mensagem_em, concluido")
        .eq("fase_atual", selectedFase);
      if (error) throw error;
      if (!trackings || trackings.length === 0) return [];

      const ids = trackings.map((t: { cliente_id: string }) => t.cliente_id);
      const { data: clientes } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, nome_responsavel, telefone, email_superintendente, ultimo_login")
        .in("id", ids);

      return (clientes || []).map((c: any) => {
        const tracking = trackings.find((t: { cliente_id: string }) => t.cliente_id === c.id);
        return { ...c, ...tracking };
      });
    },
    enabled: !!selectedFase,
  });

  if (isLoading) return <div className="flex items-center justify-center p-8 text-muted-foreground">Carregando funil...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Funil Primeira Compra
          </CardTitle>
          <CardDescription>
            Visualize o progresso dos clientes no funil pós-venda. Total: {totalClientes} clientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {FUNIL_FASES.map((fase, idx) => {
              const count = contagens[fase.fase] || 0;
              const pct = totalClientes > 0 ? (count / totalClientes) * 100 : 0;
              const widthPct = Math.max(20, 100 - idx * 16);
              const isSelected = selectedFase === fase.fase;

              return (
                <button
                  key={fase.fase}
                  onClick={() => setSelectedFase(isSelected ? null : fase.fase)}
                  className={`w-full text-left transition-all rounded-lg border-2 p-0.5 ${isSelected ? fase.corBorda + " shadow-md" : "border-transparent hover:border-muted"}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`${fase.cor} rounded-md flex items-center justify-center text-white font-bold text-lg py-3 transition-all`}
                      style={{ width: `${widthPct}%`, minWidth: "80px" }}
                    >
                      {count}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">Fase {fase.fase}</span>
                        <span className="text-xs text-muted-foreground">— {fase.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{pct.toFixed(0)}% do total</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedFase && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clientes na Fase {selectedFase} — {FUNIL_FASES.find(f => f.fase === selectedFase)?.label}
            </CardTitle>
            <CardDescription>{clientesFase.length} clientes nesta fase.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingClientes ? (
              <p className="text-muted-foreground text-center py-4">Carregando...</p>
            ) : clientesFase.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum cliente nesta fase.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Último Login</TableHead>
                      <TableHead>Última Msg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesFase.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome_responsavel || c.nome_igreja}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.telefone ? (
                            <a href={`https://wa.me/${c.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              <Phone className="h-3 w-3" />
                              {c.telefone}
                            </a>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-xs">{c.email_superintendente || "-"}</TableCell>
                        <TableCell className="text-xs">
                          {c.ultimo_login ? (
                            <Badge variant="default" className="text-xs">
                              {format(new Date(c.ultimo_login), "dd/MM/yy HH:mm")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Nunca</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.ultima_mensagem_em ? format(new Date(c.ultima_mensagem_em), "dd/MM/yy HH:mm") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function WhatsAppPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-muted-foreground">Envie mensagens via WhatsApp usando a Z-API.</p>
      </div>

      <Tabs defaultValue="funil" className="w-full">
        <TabsList>
          <TabsTrigger value="funil" className="gap-2">
            <Filter className="h-4 w-4" />
            Funil Primeira Compra
          </TabsTrigger>
          <TabsTrigger value="enviar" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Enviar Mensagem
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="credenciais" className="gap-2">
            <Settings className="h-4 w-4" />
            Credenciais Z-API
          </TabsTrigger>
        </TabsList>

        <TabsContent value="funil">
          <FunilTab />
        </TabsContent>

        <TabsContent value="enviar">
          <SendMessageTab />
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhooksTab />
        </TabsContent>

        <TabsContent value="credenciais">
          <CredentialsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
