import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Crown, DollarSign, ShoppingCart, MousePointerClick, TrendingUp,
  Copy, LogOut, Loader2, Lock, Smartphone, Camera, Users, MapPin,
  Monitor, Clock, Share2,
} from "lucide-react";

const STORAGE_KEY = "emb_codigo";

export default function EmbaixadoraPainel() {
  const [codigo, setCodigo] = useState("");
  const [inputCodigo, setInputCodigo] = useState("");
  const [checking, setChecking] = useState(true);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setCodigo(saved);
    setChecking(false);
  }, []);

  const handleLogin = useCallback(async () => {
    if (!inputCodigo.trim()) return;
    setLoginError("");
    setChecking(true);
    const { data } = await supabase
      .from("embaixadoras")
      .select("id")
      .eq("codigo_unico", inputCodigo.trim().toUpperCase())
      .eq("status", "ativa")
      .maybeSingle();

    if (!data) {
      setLoginError("Código inválido ou embaixadora não ativa");
      setChecking(false);
      return;
    }
    localStorage.setItem(STORAGE_KEY, inputCodigo.trim().toUpperCase());
    setCodigo(inputCodigo.trim().toUpperCase());
    setChecking(false);
  }, [inputCodigo]);

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCodigo("");
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f9f6f0" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  if (!codigo) {
    return <LoginScreen inputCodigo={inputCodigo} setInputCodigo={setInputCodigo} onLogin={handleLogin} error={loginError} />;
  }

  return <Dashboard codigo={codigo} onLogout={handleLogout} />;
}

function LoginScreen({
  inputCodigo, setInputCodigo, onLogin, error,
}: {
  inputCodigo: string; setInputCodigo: (v: string) => void; onLogin: () => void; error: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#f9f6f0" }}>
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2" style={{ background: "#1a1a2e", borderRadius: "8px 8px 0 0" }}>
          <Crown className="mx-auto h-10 w-10 mb-2" style={{ color: "#C9A84C" }} />
          <CardTitle className="text-xl" style={{ color: "#C9A84C" }}>Painel da Embaixadora</CardTitle>
          <p className="text-sm text-gray-300">Central Gospel</p>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Digite seu código de embaixadora</label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: ANA4821"
                value={inputCodigo}
                onChange={(e) => setInputCodigo(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && onLogin()}
                className="text-center text-lg tracking-widest font-bold uppercase"
              />
              <Button onClick={onLogin} style={{ background: "#C9A84C", color: "#1a1a2e" }} className="hover:opacity-90">
                <Lock className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Dashboard({ codigo, onLogout }: { codigo: string; onLogout: () => void }) {
  const { data: emb, isLoading } = useQuery({
    queryKey: ["emb-profile", codigo],
    queryFn: async () => {
      const { data } = await supabase
        .from("embaixadoras")
        .select("*, embaixadoras_tiers(*)")
        .eq("codigo_unico", codigo)
        .eq("status", "ativa")
        .single();
      return data;
    },
  });

  const { data: vendas } = useQuery({
    queryKey: ["emb-vendas", emb?.id],
    enabled: !!emb?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("embaixadoras_vendas")
        .select("*")
        .eq("embaixadora_id", emb!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: cliquesCount } = useQuery({
    queryKey: ["emb-cliques", emb?.id],
    enabled: !!emb?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("embaixadoras_cliques")
        .select("*", { count: "exact", head: true })
        .eq("embaixadora_id", emb!.id);
      return count ?? 0;
    },
  });

  const { data: topEstados } = useQuery({
    queryKey: ["emb-top-estados", emb?.id],
    enabled: !!emb?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("embaixadoras_cliques")
        .select("estado")
        .eq("embaixadora_id", emb!.id)
        .not("estado", "is", null);
      if (!data || data.length === 0) return [];
      const counts: Record<string, number> = {};
      data.forEach((r) => { counts[r.estado!] = (counts[r.estado!] || 0) + 1; });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([estado, total]) => ({ estado, total }));
    },
  });

  const { data: topDispositivos } = useQuery({
    queryKey: ["emb-top-dispositivos", emb?.id],
    enabled: !!emb?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("embaixadoras_cliques")
        .select("dispositivo")
        .eq("embaixadora_id", emb!.id)
        .not("dispositivo", "is", null);
      if (!data || data.length === 0) return [];
      const counts: Record<string, number> = {};
      data.forEach((r) => { counts[r.dispositivo!] = (counts[r.dispositivo!] || 0) + 1; });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([dispositivo, total]) => ({ dispositivo, total }));
    },
  });

  const { data: topCanais } = useQuery({
    queryKey: ["emb-top-canais", emb?.id],
    enabled: !!emb?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("embaixadoras_cliques")
        .select("canal_origem")
        .eq("embaixadora_id", emb!.id)
        .not("canal_origem", "is", null);
      if (!data || data.length === 0) return [];
      const counts: Record<string, number> = {};
      data.forEach((r) => { counts[r.canal_origem!] = (counts[r.canal_origem!] || 0) + 1; });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([canal, total]) => ({ canal, total }));
    },
  });

  const { data: melhorHorario } = useQuery({
    queryKey: ["emb-melhor-horario", emb?.id],
    enabled: !!emb?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("embaixadoras_cliques")
        .select("hora_clique")
        .eq("embaixadora_id", emb!.id)
        .not("hora_clique", "is", null);
      if (!data || data.length === 0) return null;
      const counts: Record<number, number> = {};
      data.forEach((r) => { counts[r.hora_clique!] = (counts[r.hora_clique!] || 0) + 1; });
      const sorted = Object.entries(counts).sort((a, b) => Number(b[1]) - Number(a[1]));
      return sorted.length > 0 ? { hora: Number(sorted[0][0]), total: sorted[0][1] } : null;
    },
  });

  const { data: tiers } = useQuery({
    queryKey: ["emb-tiers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("embaixadoras_tiers")
        .select("*")
        .order("volume_minimo", { ascending: true });
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f9f6f0" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  if (!emb) {
    onLogout();
    return null;
  }

  const totalComissao = vendas?.reduce((s, v) => s + (v.valor_comissao ?? 0), 0) ?? 0;
  const totalVendas = vendas?.length ?? 0;
  const cliques = cliquesCount ?? 0;
  const conversao = cliques > 0 ? ((totalVendas / cliques) * 100).toFixed(1) : "0.0";
  const totalVendasValor = vendas?.reduce((s, v) => s + (v.valor_venda ?? 0), 0) ?? 0;

  const tierAtual = emb.embaixadoras_tiers;
  const proximoTier = tiers?.find((t) => t.volume_minimo > (tierAtual?.volume_minimo ?? 0));

  const link = `gestaoebd.com.br/r/${codigo}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const msgWhatsApp = `Oi! Conhece a Central Gospel? Materiais incríveis para EBD e escola bíblica. Dá uma olhada: ${link} 📚`;
  const msgInstagram = `📖 Materiais de qualidade para EBD e escola bíblica!\n🛒 Confira: ${link}\n#CentralGospel #EBD #EscolaBiblica #Igreja #MaterialCristao`;
  const msgIgreja = `Prezados irmãos, gostaria de compartilhar a Central Gospel, que oferece materiais completos para EBD e escola bíblica dominical. Acessem: ${link}`;

  return (
    <div className="min-h-screen" style={{ background: "#f9f6f0" }}>
      {/* Header */}
      <div style={{ background: "#1a1a2e" }} className="px-4 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6" style={{ color: "#C9A84C" }} />
            <div>
              <h1 className="text-lg font-bold text-white">Olá, {emb.nome}! 👑</h1>
              <Badge className="mt-1 text-xs" style={{ background: "#C9A84C", color: "#1a1a2e" }}>
                {tierAtual?.nome ?? "Iniciante"} — {tierAtual?.percentual_comissao ?? 5}%
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-gray-300 hover:text-white">
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard icon={<DollarSign className="h-5 w-5" />} label="Total Comissões" value={`R$ ${totalComissao.toFixed(2)}`} />
          <MetricCard icon={<ShoppingCart className="h-5 w-5" />} label="Total Vendas" value={String(totalVendas)} />
          <MetricCard icon={<MousePointerClick className="h-5 w-5" />} label="Total Cliques" value={String(cliques)} />
          <MetricCard icon={<TrendingUp className="h-5 w-5" />} label="Conversão" value={`${conversao}%`} />
        </div>

        {/* Top Estados */}
        {topEstados && topEstados.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" style={{ color: "#C9A84C" }} />
                Top Estados (Cliques)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 flex-wrap">
                {topEstados.map((e, i) => (
                  <div key={e.estado} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>{i + 1}º</span>
                    <span className="text-sm font-medium text-gray-800">{e.estado}</span>
                    <span className="text-xs text-gray-500">({e.total})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Insights de Cliques */}
        {((topDispositivos && topDispositivos.length > 0) || (topCanais && topCanais.length > 0) || melhorHorario) && (
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="h-4 w-4" style={{ color: "#C9A84C" }} />
                Insights dos Cliques
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dispositivos */}
              {topDispositivos && topDispositivos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> Dispositivos
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {topDispositivos.map((d) => (
                      <div key={d.dispositivo} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-1.5">
                        <span className="text-sm font-medium text-gray-800 capitalize">{d.dispositivo}</span>
                        <span className="text-xs text-gray-500">({d.total})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Canais */}
              {topCanais && topCanais.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Share2 className="h-3 w-3" /> Canais de Origem
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {topCanais.map((c, i) => (
                      <div key={c.canal} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-1.5">
                        <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>{i + 1}º</span>
                        <span className="text-sm font-medium text-gray-800">{c.canal}</span>
                        <span className="text-xs text-gray-500">({c.total})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Melhor Horário */}
              {melhorHorario && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Melhor Horário
                  </p>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 w-fit">
                    <span className="text-sm font-medium text-gray-800">
                      {String(melhorHorario.hora).padStart(2, '0')}:00 — {String(melhorHorario.hora).padStart(2, '0')}:59
                    </span>
                    <span className="text-xs text-gray-500">({melhorHorario.total} cliques)</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* My Link */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">🔗 Meu Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input value={link} readOnly className="font-mono text-sm bg-gray-50" />
              <Button size="sm" onClick={() => copyToClipboard(link, "Link")} style={{ background: "#C9A84C", color: "#1a1a2e" }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Next Tier */}
        {proximoTier && (
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">🏆 Próximo Tier</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Você vendeu <strong>R$ {totalVendasValor.toFixed(2)}</strong> de{" "}
                <strong>R$ {proximoTier.volume_minimo.toFixed(2)}</strong> para ser{" "}
                <strong>{proximoTier.nome} ({proximoTier.percentual_comissao}%)</strong>
              </p>
              <Progress
                value={Math.min((totalVendasValor / proximoTier.volume_minimo) * 100, 100)}
                className="h-3"
              />
            </CardContent>
          </Card>
        )}

        {/* Sales Table */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">🛒 Minhas Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            {vendas && vendas.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-gray-500">Data</th>
                      <th className="pb-2 font-medium text-gray-500">Canal</th>
                      <th className="pb-2 font-medium text-gray-500">Valor</th>
                      <th className="pb-2 font-medium text-gray-500">%</th>
                      <th className="pb-2 font-medium text-gray-500">Comissão</th>
                      <th className="pb-2 font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendas.map((v) => (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="py-2">{new Date(v.created_at).toLocaleDateString("pt-BR")}</td>
                        <td className="py-2">{v.canal ?? "—"}</td>
                        <td className="py-2">R$ {(v.valor_venda ?? 0).toFixed(2)}</td>
                        <td className="py-2">{v.percentual_comissao ?? 0}%</td>
                        <td className="py-2 font-medium" style={{ color: "#C9A84C" }}>
                          R$ {(v.valor_comissao ?? 0).toFixed(2)}
                        </td>
                        <td className="py-2">
                          <StatusBadge status={v.status ?? "pendente"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-lg">Compartilhe seu link para começar a ganhar! 🚀</p>
                <p className="text-gray-400 text-sm mt-1">Suas vendas aparecerão aqui</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sharing Materials */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📣 Material de Divulgação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ShareCard icon={<Smartphone className="h-5 w-5" />} title="WhatsApp" msg={msgWhatsApp} onCopy={() => copyToClipboard(msgWhatsApp, "Mensagem WhatsApp")} />
            <ShareCard icon={<Camera className="h-5 w-5" />} title="Instagram" msg={msgInstagram} onCopy={() => copyToClipboard(msgInstagram, "Legenda Instagram")} />
            <ShareCard icon={<Users className="h-5 w-5" />} title="Grupo de Igreja" msg={msgIgreja} onCopy={() => copyToClipboard(msgIgreja, "Mensagem para grupo")} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1" style={{ color: "#C9A84C" }}>{icon}<span className="text-xs text-gray-500">{label}</span></div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string }> = {
    pago: { bg: "#dcfce7", text: "#166534" },
    pendente: { bg: "#fef9c3", text: "#854d0e" },
    cancelado: { bg: "#fee2e2", text: "#991b1b" },
  };
  const s = styles[status] ?? styles.pendente;
  return <Badge style={{ background: s.bg, color: s.text }} className="text-xs font-medium">{status}</Badge>;
}

function ShareCard({ icon, title, msg, onCopy }: { icon: React.ReactNode; title: string; msg: string; onCopy: () => void }) {
  return (
    <div className="border rounded-lg p-3 flex items-start gap-3">
      <div className="mt-0.5" style={{ color: "#C9A84C" }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 mt-1 whitespace-pre-line line-clamp-3">{msg}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onCopy} className="shrink-0">
        <Copy className="h-3 w-3 mr-1" /> Copiar
      </Button>
    </div>
  );
}
