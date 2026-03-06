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
import { Send, Eye, EyeOff, Save, CheckCircle2, XCircle, Clock, MessageSquare, Settings, ChevronDown, ChevronRight, Webhook, Activity, Smartphone, Loader2, Filter, Users, Phone, MessagesSquare, FileText, Target } from "lucide-react";
import WhatsAppChat from "@/components/admin/WhatsAppChat";
import WhatsAppTemplatesList from "@/components/admin/WhatsAppTemplatesList";
import WhatsAppCampaigns from "@/components/admin/WhatsAppCampaigns";
import WhatsAppPublicos from "@/components/admin/WhatsAppPublicos";
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
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [testNumber, setTestNumber] = useState("");
  const [connectionResult, setConnectionResult] = useState<any>(null);
  const [sendResult, setSendResult] = useState<any>(null);
  const [loadingConnection, setLoadingConnection] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);

  // Auto envio toggle
  const [autoEnvio, setAutoEnvio] = useState(true);
  const [loadingAutoEnvio, setLoadingAutoEnvio] = useState(false);

  // Agente IA toggle
  const [agenteIa, setAgenteIa] = useState(false);
  const [loadingAgenteIa, setLoadingAgenteIa] = useState(false);

  const WEBHOOK_URL = "https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/whatsapp-webhook/whatsapp-meta-webhook";

  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings-whatsapp-meta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["whatsapp_phone_number_id", "whatsapp_business_account_id", "whatsapp_access_token", "whatsapp_verify_token"]);
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

  const { data: agenteIaSetting } = useQuery({
    queryKey: ["system-settings-agente-ia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "whatsapp_agente_ia_ativo")
        .maybeSingle();
      if (error) throw error;
      return data?.value === "true";
    },
  });

  useEffect(() => {
    if (settings) {
      setPhoneNumberId(settings["whatsapp_phone_number_id"] || "");
      setBusinessAccountId(settings["whatsapp_business_account_id"] || "");
      setAccessToken(settings["whatsapp_access_token"] || "");
      setVerifyToken(settings["whatsapp_verify_token"] || "");
    }
  }, [settings]);

  useEffect(() => {
    if (autoEnvioSetting !== undefined) setAutoEnvio(autoEnvioSetting);
  }, [autoEnvioSetting]);

  useEffect(() => {
    if (agenteIaSetting !== undefined) setAgenteIa(agenteIaSetting);
  }, [agenteIaSetting]);

  const isConfigured = !!(phoneNumberId && businessAccountId && accessToken);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = [
        { key: "whatsapp_phone_number_id", value: phoneNumberId, description: "Meta WhatsApp Phone Number ID" },
        { key: "whatsapp_business_account_id", value: businessAccountId, description: "Meta WhatsApp Business Account ID" },
        { key: "whatsapp_access_token", value: accessToken, description: "Meta WhatsApp Access Token" },
        { key: "whatsapp_verify_token", value: verifyToken, description: "Meta WhatsApp Verify Token" },
      ];
      for (const entry of entries) {
        const { error } = await supabase
          .from("system_settings")
          .upsert({ key: entry.key, value: entry.value, description: entry.description, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["system-settings-whatsapp-meta"] }); toast.success("Credenciais salvas com sucesso!"); },
    onError: (err: Error) => { toast.error("Erro ao salvar: " + err.message); },
  });

  const testConnection = async () => {
    setLoadingConnection(true);
    setConnectionResult(null);
    try {
      const response = await supabase.functions.invoke("whatsapp-meta-test", {
        body: { action: "test_connection", business_account_id: businessAccountId, phone_number_id: phoneNumberId, access_token: accessToken },
      });
      if (response.error) throw new Error(response.error.message);
      setConnectionResult(response.data);
    } catch (err: any) {
      toast.error("Erro ao testar conexão: " + err.message);
      setConnectionResult({ success: false, error: err.message });
    } finally {
      setLoadingConnection(false);
    }
  };

  const testSend = async () => {
    if (!testNumber) { toast.error("Informe o número de teste"); return; }
    setLoadingSend(true);
    setSendResult(null);
    try {
      const response = await supabase.functions.invoke("whatsapp-meta-test", {
        body: { action: "test_send", phone_number_id: phoneNumberId, access_token: accessToken, test_number: testNumber },
      });
      if (response.error) throw new Error(response.error.message);
      setSendResult(response.data);
    } catch (err: any) {
      toast.error("Erro ao enviar teste: " + err.message);
      setSendResult({ success: false, error: err.message });
    } finally {
      setLoadingSend(false);
    }
  };

  const toggleAgenteIa = async (checked: boolean) => {
    setLoadingAgenteIa(true);
    try {
      await supabase
        .from("system_settings")
        .upsert({ key: "whatsapp_agente_ia_ativo", value: checked ? "true" : "false", description: "Liga/desliga o Agente de IA do WhatsApp", updated_at: new Date().toISOString() }, { onConflict: "key" });
      setAgenteIa(checked);
      queryClient.invalidateQueries({ queryKey: ["system-settings-agente-ia"] });
      toast.success(checked ? "Agente de IA ativado" : "Agente de IA desativado");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoadingAgenteIa(false);
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

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("URL do Webhook copiada!");
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
              <CardTitle className="text-lg">Agente de IA</CardTitle>
              <CardDescription>Controle as respostas automáticas do Agente de IA às mensagens recebidas no WhatsApp.</CardDescription>
            </div>
            <Switch checked={agenteIa} onCheckedChange={toggleAgenteIa} disabled={loadingAgenteIa} />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Credenciais API Oficial Meta</CardTitle>
              <CardDescription>Configure as credenciais da API Oficial do WhatsApp Business (Meta Cloud API).</CardDescription>
            </div>
            <Badge variant={isConfigured ? "default" : "destructive"} className="gap-1">
              {isConfigured ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {isConfigured ? "Configurado" : "Não configurado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone-number-id">Phone Number ID</Label>
              <Input id="phone-number-id" placeholder="Ex: 1050166738160490" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-account-id">WhatsApp Business Account ID</Label>
              <Input id="business-account-id" placeholder="Ex: 925435919846260" value={businessAccountId} onChange={(e) => setBusinessAccountId(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="access-token">Access Token</Label>
            <div className="relative">
              <Input id="access-token" type={showAccessToken ? "text" : "password"} placeholder="EAAaJ7mIEXVMBQ..." value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className="pr-10 font-mono text-xs" />
              <button type="button" onClick={() => setShowAccessToken(!showAccessToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="verify-token">Verify Token (Webhook)</Label>
            <Input id="verify-token" placeholder="centralgospel123" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>URL do Webhook (copie para o Meta Developers)</Label>
            <div className="flex gap-2">
              <Input value={WEBHOOK_URL} readOnly className="font-mono text-xs bg-muted" />
              <Button variant="outline" size="sm" onClick={copyWebhookUrl}>Copiar</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Credenciais"}
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={loadingConnection || !isConfigured} className="gap-2">
              {loadingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Testar Conexão
            </Button>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="test-number">Número para Teste</Label>
              <Input id="test-number" placeholder="21999999999" value={testNumber} onChange={(e) => setTestNumber(e.target.value)} />
            </div>
            <Button variant="outline" onClick={testSend} disabled={loadingSend || !isConfigured || !testNumber} className="gap-2">
              {loadingSend ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Teste
            </Button>
          </div>
        </CardContent>
      </Card>

      {connectionResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Diagnóstico da Conexão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge variant={connectionResult.success ? "default" : "destructive"}>
              {connectionResult.success ? "✅ Conexão OK" : "❌ Falha na conexão"}
            </Badge>

            {/* Step-by-step checks */}
            {connectionResult.checks && (
              <div className="space-y-2">
                <span className="text-sm font-semibold">Verificações por etapa:</span>
                <div className="grid gap-2">
                  {[
                    { key: "token_valid", label: "Token válido", icon: "🔑" },
                    { key: "waba_access", label: "Acesso ao WABA", icon: "🏢" },
                    { key: "phone_access", label: "Acesso ao Phone Number", icon: "📞" },
                  ].map(({ key, label, icon }) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      {connectionResult.checks[key] ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span>{icon} {label}</span>
                      <Badge variant={connectionResult.checks[key] ? "default" : "destructive"} className="text-xs">
                        {connectionResult.checks[key] ? "OK" : "FALHA"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Token scopes */}
            {connectionResult.token_scopes?.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Permissões do token:</span>
                <div className="flex flex-wrap gap-1">
                  {connectionResult.token_scopes.map((s: string) => (
                    <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Probable cause */}
            {connectionResult.probable_cause && !connectionResult.success && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-2">
                <span className="text-sm font-semibold text-destructive">🔍 Causa provável:</span>
                <p className="text-sm">{connectionResult.probable_cause}</p>
              </div>
            )}

            {/* Next steps */}
            {connectionResult.next_steps?.length > 0 && !connectionResult.success && (
              <div className="bg-muted rounded-md p-3 space-y-2">
                <span className="text-sm font-semibold">📋 Próximos passos:</span>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  {connectionResult.next_steps.map((step: string, i: number) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Phone numbers (success) */}
            {connectionResult.phone_numbers && (
              <div className="space-y-2">
                <span className="text-sm font-semibold">Números encontrados:</span>
                <div className="space-y-1">
                  {connectionResult.phone_numbers.map((p: any) => (
                    <div key={p.id} className="flex flex-wrap gap-2 items-center text-sm">
                      <Badge variant="outline">📞 {p.display_phone_number}</Badge>
                      <Badge variant="secondary">👤 {p.verified_name}</Badge>
                      <Badge variant="secondary">⭐ {p.quality_rating}</Badge>
                      <span className="text-xs text-muted-foreground">ID: {p.id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw diagnostics (collapsible) */}
            {connectionResult.raw_diagnostics && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ChevronRight className="h-3 w-3" />
                  Diagnóstico técnico detalhado
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <JsonBlock data={connectionResult.raw_diagnostics} label="📋 Raw diagnostics" />
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}

      {sendResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="h-5 w-5" />
              Resultado do Envio de Teste
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant={sendResult.success ? "default" : "destructive"}>
              {sendResult.success ? "✅ Mensagem enviada" : "❌ Falha no envio"}
            </Badge>
            {sendResult.error && (
              <p className="text-sm text-destructive">{sendResult.error}</p>
            )}
            {sendResult.data && <JsonBlock data={sendResult.data} label="📋 Resposta da API" />}
            {sendResult.details && <JsonBlock data={sendResult.details} label="📋 Detalhes do erro" />}
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
        <CardDescription>Últimos 100 eventos recebidos da API Oficial Meta. Atualiza a cada 10s.</CardDescription>
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
                   <TableHead>Remetente</TableHead>
                   <TableHead>Conteúdo</TableHead>
                   <TableHead>Telefone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((wh: any) => {
                  const change = wh.payload?.entry?.[0]?.changes?.[0]?.value;
                  const contactName = change?.contacts?.[0]?.profile?.name || "-";
                  const msgText = change?.messages?.[0]?.text?.body
                    || (change?.messages?.[0]?.type ? `[${change.messages[0].type}]` : null)
                    || (change?.statuses?.[0]?.status ? `Status: ${change.statuses[0].status}` : "-");
                  return (
                   <Collapsible key={wh.id} open={expandedRow === wh.id} onOpenChange={(open) => setExpandedRow(open ? wh.id : null)} asChild>
                     <>
                       <CollapsibleTrigger asChild>
                         <TableRow className="cursor-pointer">
                           <TableCell className="p-2">
                             {expandedRow === wh.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                           </TableCell>
                           <TableCell className="text-xs">{format(new Date(wh.created_at), "dd/MM/yyyy HH:mm:ss")}</TableCell>
                           <TableCell><Badge variant="outline" className="text-xs">{wh.evento}</Badge></TableCell>
                           <TableCell className="text-xs">{contactName}</TableCell>
                           <TableCell className="text-xs max-w-[250px] truncate">{msgText}</TableCell>
                           <TableCell className="font-mono text-xs">{wh.telefone || "-"}</TableCell>
                         </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <tr>
                           <td colSpan={6} className="p-4 bg-muted/30 border-b">
                             <JsonBlock data={wh.payload} label="📋 Payload Meta" />
                           </td>
                         </tr>
                      </CollapsibleContent>
                    </>
                   </Collapsible>
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
        <p className="text-muted-foreground">Envie mensagens via WhatsApp usando a API Oficial Meta.</p>
      </div>

      <Tabs defaultValue="conversas" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="conversas" className="gap-2">
            <MessagesSquare className="h-4 w-4" />
            Conversas
          </TabsTrigger>
          <TabsTrigger value="funil" className="gap-2">
            <Filter className="h-4 w-4" />
            Funil Primeira Compra
          </TabsTrigger>
          <TabsTrigger value="enviar" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Enviar Mensagem
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="campanhas" className="gap-2">
            <Target className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="publicos" className="gap-2">
            <Users className="h-4 w-4" />
            Públicos
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="credenciais" className="gap-2">
            <Settings className="h-4 w-4" />
            Credenciais API
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversas">
          <WhatsAppChat />
        </TabsContent>

        <TabsContent value="funil">
          <FunilTab />
        </TabsContent>

        <TabsContent value="enviar">
          <SendMessageTab />
        </TabsContent>

        <TabsContent value="templates">
          <WhatsAppTemplatesList />
        </TabsContent>

        <TabsContent value="campanhas">
          <WhatsAppCampaigns />
        </TabsContent>

        <TabsContent value="publicos">
          <WhatsAppPublicos />
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
