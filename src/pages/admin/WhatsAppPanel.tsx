import { useState } from "react";
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
import { Send, Eye, EyeOff, Save, CheckCircle2, XCircle, Clock, MessageSquare, Settings } from "lucide-react";
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

function CredentialsTab() {
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [showClientToken, setShowClientToken] = useState(false);
  const [instanceId, setInstanceId] = useState("");
  const [token, setToken] = useState("");
  const [clientToken, setClientToken] = useState("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings-zapi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["zapi_instance_id", "zapi_token", "zapi_client_token"]);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((s) => {
        map[s.key] = s.value;
      });
      return map;
    },
  });

  // Set initial values when loaded
  useState(() => {
    if (settings) {
      setInstanceId(settings["zapi_instance_id"] || "");
      setToken(settings["zapi_token"] || "");
      setClientToken(settings["zapi_client_token"] || "");
    }
  });

  // Sync state when settings load
  const currentInstanceId = instanceId || settings?.["zapi_instance_id"] || "";
  const currentToken = token || settings?.["zapi_token"] || "";
  const currentClientToken = clientToken || settings?.["zapi_client_token"] || "";

  const isConfigured = !!(settings?.["zapi_instance_id"] && settings?.["zapi_token"] && settings?.["zapi_client_token"]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = [
        { key: "zapi_instance_id", value: currentInstanceId, description: "Z-API Instance ID" },
        { key: "zapi_token", value: currentToken, description: "Z-API Token da Instância" },
        { key: "zapi_client_token", value: currentClientToken, description: "Z-API Client Token" },
      ];

      for (const entry of entries) {
        const { error } = await supabase
          .from("system_settings")
          .upsert(
            { key: entry.key, value: entry.value, description: entry.description, updated_at: new Date().toISOString() },
            { onConflict: "key" }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings-zapi"] });
      toast.success("Credenciais salvas com sucesso!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground">Carregando...</div>;
  }

  return (
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
          <Label htmlFor="instance-id">Instance ID</Label>
          <Input
            id="instance-id"
            placeholder="Ex: 3C7A..."
            value={currentInstanceId}
            onChange={(e) => setInstanceId(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="zapi-token">Token da Instância</Label>
          <div className="relative">
            <Input
              id="zapi-token"
              type={showToken ? "text" : "password"}
              placeholder="Token da instância Z-API"
              value={currentToken}
              onChange={(e) => setToken(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-token">Client Token</Label>
          <div className="relative">
            <Input
              id="client-token"
              type={showClientToken ? "text" : "password"}
              placeholder="Token de segurança da conta"
              value={currentClientToken}
              onChange={(e) => setClientToken(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowClientToken(!showClientToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showClientToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar Credenciais"}
        </Button>
      </CardContent>
    </Card>
  );
}

function SendMessageTab() {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");

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
        body: {
          tipo_mensagem: tipo || "manual",
          telefone: telefone.replace(/\D/g, ""),
          nome,
          mensagem,
          imagem_url: imagemUrl || undefined,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Mensagem enviada com sucesso!");
      setTelefone("");
      setNome("");
      setMensagem("");
      setImagemUrl("");
      setTipo("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens"] });
    },
    onError: (err: Error) => {
      toast.error("Erro: " + err.message);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens"] });
    },
  });

  const handleTipoChange = (value: string) => {
    setTipo(value);
    if (TEMPLATES[value]) {
      setMensagem(TEMPLATES[value]);
    }
  };

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
                  {MESSAGE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Telefone (com DDD)</Label>
              <Input
                placeholder="5521999999999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nome do Destinatário</Label>
            <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              placeholder="Digite a mensagem..."
              rows={6}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>URL da Imagem (opcional)</Label>
            <Input
              placeholder="https://exemplo.com/imagem.jpg"
              value={imagemUrl}
              onChange={(e) => setImagemUrl(e.target.value)}
            />
          </div>

          <Button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !telefone || !mensagem}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {sendMutation.isPending ? "Enviando..." : "Enviar Mensagem"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Mensagens</CardTitle>
          <CardDescription>Últimas 50 mensagens enviadas.</CardDescription>
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
                    <TableHead>Status</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((msg: any) => (
                    <TableRow key={msg.id}>
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

export default function WhatsAppPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-muted-foreground">Envie mensagens via WhatsApp usando a Z-API.</p>
      </div>

      <Tabs defaultValue="enviar" className="w-full">
        <TabsList>
          <TabsTrigger value="enviar" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Enviar Mensagem
          </TabsTrigger>
          <TabsTrigger value="credenciais" className="gap-2">
            <Settings className="h-4 w-4" />
            Credenciais Z-API
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enviar">
          <SendMessageTab />
        </TabsContent>

        <TabsContent value="credenciais">
          <CredentialsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
