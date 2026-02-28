import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, Save, Wifi, WifiOff, Loader2, MessageCircle, Copy, Check, ChevronDown, ChevronUp, Send, AlertTriangle } from "lucide-react";

interface PhoneNumberInfo {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
}

export default function VendedorIntegracoes() {
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "error">("idle");
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberInfo[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [showZapiLegacy, setShowZapiLegacy] = useState(false);

  // Z-API legacy fields
  const [instanceId, setInstanceId] = useState("");
  const [zapiToken, setZapiToken] = useState("");
  const [clientToken, setClientToken] = useState("");

  const webhookUrl = `https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/whatsapp-webhook/whatsapp-meta-webhook`;

  // Validation
  const validation = useMemo(() => {
    const isPhoneNumeric = /^\d+$/.test(phoneNumberId);
    const isWabaNumeric = /^\d+$/.test(businessAccountId);
    const isTokenValid = accessToken.startsWith("EAA");
    const allFilled = phoneNumberId.trim() !== "" && businessAccountId.trim() !== "" && accessToken.trim() !== "";
    return {
      phoneNumberId: !phoneNumberId || isPhoneNumeric,
      businessAccountId: !businessAccountId || isWabaNumeric,
      accessToken: !accessToken || isTokenValid,
      canSave: allFilled && isPhoneNumeric && isWabaNumeric && isTokenValid,
    };
  }, [phoneNumberId, businessAccountId, accessToken]);

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
    setPhoneNumbers([]);
    setConnectionError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }

      console.log("[Integrações] Testando conexão com WABA ID:", businessAccountId);

      const res = await supabase.functions.invoke("whatsapp-meta-test", {
        body: {
          action: "test_connection",
          business_account_id: businessAccountId,
          access_token: accessToken,
        },
      });

      console.log("[Integrações] Resposta test_connection:", res.data);

      if (res.error) throw res.error;

      const result = res.data;
      if (result?.success && result.phone_numbers?.length > 0) {
        setConnectionStatus("connected");
        setPhoneNumbers(result.phone_numbers);
        toast.success(`Conexão OK! ${result.phone_numbers.length} número(s) encontrado(s).`);
      } else if (result?.success && result.phone_numbers?.length === 0) {
        setConnectionStatus("error");
        setConnectionError("Nenhum número de telefone encontrado nesta conta Business.");
      } else {
        setConnectionStatus("error");
        setConnectionError(result?.error || "Erro ao testar conexão");
      }
    } catch (err) {
      setConnectionStatus("error");
      setConnectionError("Erro ao testar conexão. Verifique as credenciais.");
      console.error("[Integrações] Erro test_connection:", err);
    } finally {
      setTesting(false);
    }
  }

  async function testSend() {
    setSendingTest(true);
    setSendResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }

      console.log("[Integrações] Enviando teste para:", testNumber, "via Phone Number ID:", phoneNumberId);

      const res = await supabase.functions.invoke("whatsapp-meta-test", {
        body: {
          action: "test_send",
          phone_number_id: phoneNumberId,
          access_token: accessToken,
          test_number: testNumber,
        },
      });

      console.log("[Integrações] Resposta test_send:", res.data);

      if (res.error) throw res.error;

      const result = res.data;
      if (result?.success) {
        setSendResult({ success: true, message: "Mensagem de teste enviada com sucesso! Verifique o WhatsApp do número informado." });
        toast.success("Mensagem de teste enviada!");
      } else {
        setSendResult({ success: false, message: result?.error || "Erro ao enviar mensagem de teste" });
      }
    } catch (err) {
      setSendResult({ success: false, message: "Erro ao enviar mensagem de teste. Verifique as credenciais." });
      console.error("[Integrações] Erro test_send:", err);
    } finally {
      setSendingTest(false);
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
              className={!validation.phoneNumberId ? "border-destructive" : ""}
            />
            {!validation.phoneNumberId && (
              <p className="text-xs text-destructive">Phone Number ID deve conter apenas números</p>
            )}
            <p className="text-xs text-muted-foreground">Encontrado em Meta Business &gt; WhatsApp &gt; API Setup</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessAccountId">WhatsApp Business Account ID</Label>
            <Input
              id="businessAccountId"
              value={businessAccountId}
              onChange={(e) => setBusinessAccountId(e.target.value)}
              placeholder="Ex: 123456789012345"
              className={!validation.businessAccountId ? "border-destructive" : ""}
            />
            {!validation.businessAccountId && (
              <p className="text-xs text-destructive">Business Account ID deve conter apenas números</p>
            )}
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
                placeholder="Token de acesso permanente (inicia com EAA)"
                className={!validation.accessToken ? "border-destructive" : ""}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowAccessToken(!showAccessToken)}
              >
                {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!validation.accessToken && (
              <p className="text-xs text-destructive">Access Token deve iniciar com "EAA"</p>
            )}
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
            <Button onClick={saveCredentials} disabled={saving || !validation.canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Credenciais
            </Button>
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={testing || !businessAccountId || !accessToken}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
              Testar Conexão
            </Button>
          </div>

          {/* Connection Status */}
          {connectionStatus !== "idle" && (
            <div className="pt-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                {connectionStatus === "connected" && (
                  <Badge className="bg-green-600 hover:bg-green-700">
                    <Wifi className="h-3 w-3 mr-1" /> Conectado
                  </Badge>
                )}
                {connectionStatus === "error" && (
                  <Badge variant="destructive">
                    <WifiOff className="h-3 w-3 mr-1" /> Erro
                  </Badge>
                )}
              </div>

              {connectionError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <span className="text-destructive">{connectionError}</span>
                </div>
              )}

              {phoneNumbers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Números encontrados:</p>
                  {phoneNumbers.map((phone) => (
                    <div key={phone.id} className="bg-muted rounded-lg p-3 text-sm space-y-1">
                      <p><strong>ID:</strong> {phone.id}</p>
                      <p><strong>Número:</strong> {phone.display_phone_number}</p>
                      <p><strong>Nome Verificado:</strong> {phone.verified_name}</p>
                      <p><strong>Quality Rating:</strong> {phone.quality_rating}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Test Send Section */}
          <div className="border-t pt-4 mt-4 space-y-3">
            <Label className="text-sm font-medium">Testar Envio de Mensagem</Label>
            <div className="flex gap-2">
              <Input
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
                placeholder="Número com DDD (ex: 11999998888)"
                className="max-w-xs"
              />
              <Button
                variant="outline"
                onClick={testSend}
                disabled={sendingTest || !phoneNumberId || !accessToken || !testNumber}
              >
                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Testar Envio
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Envia uma mensagem de teste para o número informado via API oficial.
            </p>

            {sendResult && (
              <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
                sendResult.success
                  ? "bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
                  : "bg-destructive/10 border border-destructive/20 text-destructive"
              }`}>
                {sendResult.success ? (
                  <Check className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <span>{sendResult.message}</span>
              </div>
            )}
          </div>
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
