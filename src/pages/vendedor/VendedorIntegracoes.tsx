import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, Save, Wifi, WifiOff, Loader2, MessageCircle, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";

export default function VendedorIntegracoes() {
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "disconnected" | "error">("idle");
  const [phoneInfo, setPhoneInfo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [showZapiLegacy, setShowZapiLegacy] = useState(false);

  // Z-API legacy fields
  const [instanceId, setInstanceId] = useState("");
  const [zapiToken, setZapiToken] = useState("");
  const [clientToken, setClientToken] = useState("");

  const webhookUrl = `https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/whatsapp-webhook/whatsapp-meta-webhook`;

  useEffect(() => {
    loadCredentials();
  }, []);

  async function loadCredentials() {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", [
          "whatsapp_phone_number_id", "whatsapp_business_account_id",
          "whatsapp_access_token", "whatsapp_verify_token",
          "zapi_instance_id", "zapi_token", "zapi_client_token",
        ]);

      if (error) throw error;

      const map: Record<string, string> = {};
      (data || []).forEach((s) => { map[s.key] = s.value; });

      setPhoneNumberId(map["whatsapp_phone_number_id"] || "");
      setBusinessAccountId(map["whatsapp_business_account_id"] || "");
      setAccessToken(map["whatsapp_access_token"] || "");
      setVerifyToken(map["whatsapp_verify_token"] || "");

      setInstanceId(map["zapi_instance_id"] || "");
      setZapiToken(map["zapi_token"] || "");
      setClientToken(map["zapi_client_token"] || "");
    } catch {
      toast.error("Erro ao carregar credenciais");
    } finally {
      setLoading(false);
    }
  }

  async function saveCredentials() {
    setSaving(true);
    try {
      const keys = [
        { key: "whatsapp_phone_number_id", value: phoneNumberId },
        { key: "whatsapp_business_account_id", value: businessAccountId },
        { key: "whatsapp_access_token", value: accessToken },
        { key: "whatsapp_verify_token", value: verifyToken },
      ];

      for (const { key, value } of keys) {
        const { error } = await supabase
          .from("system_settings")
          .upsert({ key, value }, { onConflict: "key" });
        if (error) throw error;
      }

      toast.success("Credenciais salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar credenciais");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setConnectionStatus("idle");
    setPhoneInfo(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }

      const res = await supabase.functions.invoke("whatsapp-meta-test", {
        body: { phone_number_id: phoneNumberId, access_token: accessToken },
      });

      if (res.error) throw res.error;

      const result = res.data;
      if (result?.success && result.data) {
        setConnectionStatus("connected");
        setPhoneInfo(result.data);
      } else {
        setConnectionStatus("error");
        toast.error(result?.error || "Erro ao testar conexão");
      }
    } catch {
      setConnectionStatus("error");
      toast.error("Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopiedWebhook(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-muted-foreground">Gerencie as credenciais de integração com o WhatsApp.</p>
      </div>

      {/* WhatsApp Official API Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            API Oficial do WhatsApp (Meta)
          </CardTitle>
          <CardDescription>
            Configure as credenciais da API oficial do WhatsApp via Meta Cloud API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumberId">Phone Number ID</Label>
            <Input
              id="phoneNumberId"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="Ex: 123456789012345"
            />
            <p className="text-xs text-muted-foreground">Encontrado em Meta Business &gt; WhatsApp &gt; API Setup</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessAccountId">WhatsApp Business Account ID</Label>
            <Input
              id="businessAccountId"
              value={businessAccountId}
              onChange={(e) => setBusinessAccountId(e.target.value)}
              placeholder="Ex: 123456789012345"
            />
            <p className="text-xs text-muted-foreground">ID da conta Business do WhatsApp</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessToken">Access Token (Permanente)</Label>
            <div className="relative">
              <Input
                id="accessToken"
                type={showAccessToken ? "text" : "password"}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Token de acesso permanente"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowAccessToken(!showAccessToken)}
              >
                {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Token gerado no Meta Business (System User Token)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verifyToken">Verify Token (Webhook)</Label>
            <Input
              id="verifyToken"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              placeholder="Token de verificação personalizado"
            />
            <p className="text-xs text-muted-foreground">Token que você define para validar o webhook no Meta</p>
          </div>

          {/* Webhook URL */}
          <div className="space-y-2 pt-2">
            <Label>URL do Webhook (para configurar no Meta)</Label>
            <div className="flex items-center gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="text-xs font-mono bg-muted"
              />
              <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                {copiedWebhook ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Cole esta URL no campo Callback URL do seu app Meta</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={saveCredentials} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Credenciais
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing || !phoneNumberId || !accessToken}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
              Testar Conexão
            </Button>
          </div>

          {connectionStatus !== "idle" && (
            <div className="pt-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                {connectionStatus === "connected" && (
                  <Badge className="bg-green-600 hover:bg-green-700">
                    <Wifi className="h-3 w-3 mr-1" /> Conectado
                  </Badge>
                )}
                {connectionStatus === "disconnected" && (
                  <Badge variant="destructive">
                    <WifiOff className="h-3 w-3 mr-1" /> Desconectado
                  </Badge>
                )}
                {connectionStatus === "error" && (
                  <Badge variant="destructive">Erro na verificação</Badge>
                )}
              </div>

              {phoneInfo && (
                <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                  <p><strong>Número:</strong> {String((phoneInfo as Record<string, unknown>)?.["display_phone_number"] || "N/A")}</p>
                  <p><strong>Nome:</strong> {String((phoneInfo as Record<string, unknown>)?.["verified_name"] || "N/A")}</p>
                  <p><strong>Quality:</strong> {String((phoneInfo as Record<string, unknown>)?.["quality_rating"] || "N/A")}</p>
                  <p><strong>Status:</strong> {String((phoneInfo as Record<string, unknown>)?.["code_verification_status"] || "N/A")}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Z-API Legacy (collapsed) */}
      <Card className="border-dashed opacity-70">
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowZapiLegacy(!showZapiLegacy)}
        >
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">Legado: Credenciais Z-API</span>
              <Badge variant="secondary" className="text-xs">Descontinuado</Badge>
            </span>
            {showZapiLegacy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {showZapiLegacy && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Instance ID</Label>
              <Input value={instanceId} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Token</Label>
              <Input value={zapiToken} readOnly type="password" className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Client Token</Label>
              <Input value={clientToken} readOnly type="password" className="bg-muted" />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
