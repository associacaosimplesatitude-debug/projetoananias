import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, Save, Wifi, WifiOff, Loader2, Smartphone } from "lucide-react";

export default function VendedorIntegracoes() {
  const [instanceId, setInstanceId] = useState("");
  const [token, setToken] = useState("");
  const [clientToken, setClientToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showClientToken, setShowClientToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "disconnected" | "error">("idle");
  const [deviceInfo, setDeviceInfo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCredentials();
  }, []);

  async function loadCredentials() {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["zapi_instance_id", "zapi_token", "zapi_client_token"]);

      if (error) throw error;

      const map: Record<string, string> = {};
      (data || []).forEach((s) => { map[s.key] = s.value; });

      setInstanceId(map["zapi_instance_id"] || "");
      setToken(map["zapi_token"] || "");
      setClientToken(map["zapi_client_token"] || "");
    } catch (err: unknown) {
      toast.error("Erro ao carregar credenciais");
    } finally {
      setLoading(false);
    }
  }

  async function saveCredentials() {
    setSaving(true);
    try {
      const keys = [
        { key: "zapi_instance_id", value: instanceId },
        { key: "zapi_token", value: token },
        { key: "zapi_client_token", value: clientToken },
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
    setDeviceInfo(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }

      const res = await supabase.functions.invoke("zapi-instance-info", {
        body: { action: "status" },
      });

      if (res.error) throw res.error;

      const result = res.data;
      if (result?.success && result.data) {
        const connected = result.data.connected === true || result.data.status === "CONNECTED";
        setConnectionStatus(connected ? "connected" : "disconnected");

        // Also fetch device info
        const deviceRes = await supabase.functions.invoke("zapi-instance-info", {
          body: { action: "device" },
        });
        if (deviceRes.data?.success) {
          setDeviceInfo(deviceRes.data.data);
        }
      } else {
        setConnectionStatus("error");
      }
    } catch {
      setConnectionStatus("error");
      toast.error("Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
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
        <p className="text-muted-foreground">Gerencie as credenciais de integração com a Z-API (WhatsApp).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Credenciais Z-API
          </CardTitle>
          <CardDescription>
            Configure o Instance ID, Token e Client Token da sua instância Z-API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instanceId">Instance ID</Label>
            <Input
              id="instanceId"
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              placeholder="Ex: 3C1A2B3C4D5E6F..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <div className="relative">
              <Input
                id="token"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Token da instância"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientToken">Client Token</Label>
            <div className="relative">
              <Input
                id="clientToken"
                type={showClientToken ? "text" : "password"}
                value={clientToken}
                onChange={(e) => setClientToken(e.target.value)}
                placeholder="Client Token da conta"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowClientToken(!showClientToken)}
              >
                {showClientToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={saveCredentials} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Credenciais
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing || !instanceId || !token || !clientToken}>
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

              {deviceInfo && (
                <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                  <p><strong>Aparelho:</strong> {String((deviceInfo as Record<string, unknown>)?.["model"] || "N/A")}</p>
                  <p><strong>Número:</strong> {String((deviceInfo as Record<string, unknown>)?.["wa_id"] || "N/A")}</p>
                  <p><strong>Nome:</strong> {String((deviceInfo as Record<string, unknown>)?.["pushName"] || "N/A")}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
