import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, Save, Loader2, Wifi } from "lucide-react";

const FIELDS = [
  { key: "google_ads_developer_token", label: "Developer Token", sensitive: true },
  { key: "google_ads_client_id", label: "Client ID", sensitive: false },
  { key: "google_ads_client_secret", label: "Client Secret", sensitive: true },
  { key: "google_ads_refresh_token", label: "Refresh Token", sensitive: true },
  { key: "google_ads_customer_id", label: "Customer ID (Conta Anunciante)", sensitive: false, placeholder: "Ex: 6403318992" },
  { key: "google_ads_login_customer_id", label: "Login Customer ID (MCC - Opcional)", sensitive: false, placeholder: "Ex: 1234567890" },
];

type ConnectionStatus = "idle" | "connected" | "error" | "invalid_token";

export default function GoogleAdsIntegracoes() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showField, setShowField] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadCredentials();
  }, []);

  async function loadCredentials() {
    const { data } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", FIELDS.map(f => f.key));

    const loaded: Record<string, string> = {};
    (data || []).forEach((row: any) => { loaded[row.key] = row.value || ""; });
    setValues(loaded);
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const field of FIELDS) {
        const val = values[field.key] || "";
        if (!val && field.key === "google_ads_login_customer_id") continue;

        const { data: existing } = await supabase
          .from("system_settings")
          .select("id")
          .eq("key", field.key)
          .maybeSingle();

        if (existing) {
          await supabase.from("system_settings").update({ value: val }).eq("key", field.key);
        } else {
          await supabase.from("system_settings").insert({ key: field.key, value: val });
        }
      }
      toast.success("Credenciais salvas com sucesso!");
      // Auto-test after save
      await handleTest();
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      toast.error(`Erro ao salvar credenciais: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setStatus("idle");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("google-ads-dashboard", {
        body: { action: "validate" },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      setStatus("connected");
      setStatusMessage(res.data.customerName || "Conectado");
      toast.success("Conexão estabelecida com sucesso!");
    } catch (err: any) {
      const msg = err.message || "Erro desconhecido";
      if (msg.includes("Developer Token")) {
        setStatus("invalid_token");
        setStatusMessage("Developer Token inválido ou não aprovado");
      } else {
        setStatus("error");
        setStatusMessage(msg);
      }
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  }

  const statusBadge = () => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-500 text-white">🟢 Conectado — {statusMessage}</Badge>;
      case "error":
        return <Badge variant="destructive">🔴 Erro — {statusMessage}</Badge>;
      case "invalid_token":
        return <Badge className="bg-yellow-500 text-white">🟡 Developer Token inválido</Badge>;
      default:
        return <Badge variant="secondary">Não testado</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrações Google Ads</h1>
        <p className="text-muted-foreground">Configure as credenciais para conectar com o Google Ads</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">🔐 Credenciais Google Ads</CardTitle>
              <CardDescription>Insira as credenciais da API do Google Ads</CardDescription>
            </div>
            {statusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={field.key}>{field.label}</Label>
              <div className="relative">
                <Input
                  id={field.key}
                  type={field.sensitive && !showField[field.key] ? "password" : "text"}
                  value={values[field.key] || ""}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  placeholder={field.placeholder || `Insira o ${field.label}`}
                />
                {field.sensitive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowField({ ...showField, [field.key]: !showField[field.key] })}
                  >
                    {showField[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          ))}

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Credenciais
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
