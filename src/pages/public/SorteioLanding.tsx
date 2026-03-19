import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Gift, Users, Clock, Trophy, Share2, Loader2 } from "lucide-react";
import { z } from "zod";

const participanteSchema = z.object({
  nome: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  whatsapp: z.string().trim().min(14, "WhatsApp inválido").max(15),
  email: z.string().trim().email("Email inválido").max(255),
  cidade: z.string().trim().max(100).optional(),
  igreja: z.string().trim().max(100).optional(),
});

const formatWhatsApp = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export default function SorteioLanding() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: "", whatsapp: "", email: "", cidade: "", igreja: "" });
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Count participants
  const { data: totalParticipantes } = useQuery({
    queryKey: ["sorteio-count"],
    queryFn: async () => {
      const { count } = await supabase.from("sorteio_participantes").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
    refetchInterval: 15000,
  });

  // Active session
  const { data: sessaoAtiva } = useQuery({
    queryKey: ["sorteio-sessao-ativa"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sorteio_sessoes")
        .select("*")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 30000,
  });

  // Current winner (aguardando)
  const { data: ganhadoresAtual } = useQuery({
    queryKey: ["sorteio-ganhador-atual"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sorteio_ganhadores")
        .select("*, sorteio_participantes(nome)")
        .eq("status", "aguardando")
        .order("sorteado_em", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
    refetchInterval: 15000,
  });

  // History
  const { data: historico } = useQuery({
    queryKey: ["sorteio-historico"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sorteio_ganhadores")
        .select("*, sorteio_participantes(nome)")
        .eq("status", "retirado")
        .order("sorteado_em", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  // Countdown
  const proximoSorteio = useMemo(() => {
    if (!sessaoAtiva) return null;
    const inicio = new Date(sessaoAtiva.data_inicio).getTime();
    const fim = new Date(sessaoAtiva.data_fim).getTime();
    const intervalo = (sessaoAtiva.intervalo_minutos ?? 60) * 60 * 1000;
    let proximo = inicio;
    while (proximo <= now && proximo < fim) proximo += intervalo;
    return proximo <= fim ? proximo : null;
  }, [sessaoAtiva, now]);

  const countdown = useMemo(() => {
    if (!proximoSorteio) return null;
    const diff = Math.max(0, proximoSorteio - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { h, m, s, total: diff };
  }, [proximoSorteio, now]);

  // Winner expiry countdown
  const tempoRetirada = useMemo(() => {
    if (!ganhadoresAtual?.sorteado_em) return null;
    const expira = new Date(ganhadoresAtual.sorteado_em).getTime() + 3 * 3600000;
    const diff = Math.max(0, expira - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { h, m, s, expirado: diff === 0 };
  }, [ganhadoresAtual, now]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = participanteSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const whatsappDigits = form.whatsapp.replace(/\D/g, "");

      // Get active session id
      let sessaoId: string | null = null;
      if (sessaoAtiva) sessaoId = sessaoAtiva.id;

      const { error } = await supabase.from("sorteio_participantes").insert({
        nome: form.nome.trim(),
        whatsapp: whatsappDigits,
        email: form.email.trim().toLowerCase(),
        cidade: form.cidade.trim() || null,
        igreja: form.igreja.trim() || null,
        sessao_id: sessaoId,
        quer_ser_embaixadora: false,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Você já está cadastrada! Use outro WhatsApp ou email.");
        } else {
          toast.error("Erro ao cadastrar. Tente novamente.");
        }
        return;
      }
      toast.success("Cadastro realizado com sucesso! 🎉");
      const primeiroNome = form.nome.trim().split(' ')[0];
      sessionStorage.setItem('sorteio_nome', primeiroNome);
      sessionStorage.setItem('sorteio_whatsapp', whatsappDigits);
      navigate("/embaixadora?cadastro=ok");
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const ganhadoresNome = (g: any) => {
    return g?.sorteio_participantes?.nome ?? "Participante";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
      {/* Hero */}
      <section className="relative overflow-hidden py-16 px-4 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(201,168,76,0.15),transparent_70%)]" />
        <div className="relative max-w-2xl mx-auto space-y-6">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
              <Gift className="w-10 h-10 text-[#C9A84C]" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            Concorra a Prêmios <span className="text-[#C9A84C]">Incríveis!</span>
          </h1>
          <p className="text-lg text-white/70">
            Cadastre-se gratuitamente e participe dos sorteios ao vivo
          </p>
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/10">
            <Users className="w-5 h-5 text-[#C9A84C]" />
            <span className="text-white font-semibold text-lg">{totalParticipantes ?? 0}</span>
            <span className="text-white/60 text-sm">inscritas</span>
          </div>
        </div>
      </section>

      {/* Formulário */}
      <section className="px-4 pb-12 -mt-4">
        <Card className="max-w-lg mx-auto border-0 shadow-2xl bg-white/95 backdrop-blur">
          <CardContent className="p-6 md:p-8">
            <h2 className="text-xl font-bold text-center mb-6 text-gray-800">
              📝 Faça sua inscrição
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  placeholder="Nome completo"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  maxLength={100}
                  required
                />
              </div>
              <div>
                <Input
                  placeholder="WhatsApp (00) 00000-0000"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: formatWhatsApp(e.target.value) })}
                  maxLength={15}
                  required
                />
              </div>
              <div>
                <Input
                  type="email"
                  placeholder="Seu melhor email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  maxLength={255}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Cidade"
                  value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  maxLength={100}
                />
                <Input
                  placeholder="Igreja"
                  value={form.igreja}
                  onChange={(e) => setForm({ ...form, igreja: e.target.value })}
                  maxLength={100}
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 text-base font-bold bg-[#C9A84C] hover:bg-[#b8963e] text-white border-0"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Quero participar! 🎁"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Sorteio ao Vivo */}
      <section className="px-4 pb-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2">
            <Trophy className="w-6 h-6 text-[#C9A84C]" />
            Sorteio ao Vivo
          </h2>

          {!sessaoAtiva ? (
            <Card className="border-0 bg-white/10 backdrop-blur text-center">
              <CardContent className="p-8">
                <Clock className="w-12 h-12 text-white/40 mx-auto mb-3" />
                <p className="text-white/60 text-lg">Aguarde o próximo sorteio</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Countdown */}
              {countdown && countdown.total > 0 && (
                <Card className="border-0 bg-gradient-to-r from-[#C9A84C]/20 to-[#C9A84C]/10 backdrop-blur border border-[#C9A84C]/30">
                  <CardContent className="p-6 text-center">
                    <p className="text-white/70 text-sm mb-3">Próximo sorteio em</p>
                    <div className="flex justify-center gap-4">
                      {[
                        { label: "Horas", value: countdown.h },
                        { label: "Min", value: countdown.m },
                        { label: "Seg", value: countdown.s },
                      ].map((item) => (
                        <div key={item.label} className="bg-white/10 rounded-lg px-4 py-3 min-w-[70px]">
                          <span className="text-3xl font-bold text-[#C9A84C] font-mono">
                            {String(item.value).padStart(2, "0")}
                          </span>
                          <p className="text-white/50 text-xs mt-1">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Current winner */}
              {ganhadoresAtual && (
                <Card className="border-0 bg-gradient-to-r from-yellow-500/20 to-amber-500/10 backdrop-blur border border-yellow-500/30 animate-pulse-slow">
                  <CardContent className="p-6 text-center space-y-3">
                    <Badge className="bg-[#C9A84C] text-white border-0 text-sm px-4">🎉 Ganhadora Atual</Badge>
                    <h3 className="text-2xl font-bold text-white">{ganhadoresNome(ganhadoresAtual)}</h3>
                    {ganhadoresAtual.premio_descricao && (
                      <p className="text-[#C9A84C] font-medium">{ganhadoresAtual.premio_descricao}</p>
                    )}
                    {tempoRetirada && !tempoRetirada.expirado && (
                      <p className="text-white/60 text-sm">
                        ⏳ Tempo para retirada: {String(tempoRetirada.h).padStart(2, "0")}:
                        {String(tempoRetirada.m).padStart(2, "0")}:{String(tempoRetirada.s).padStart(2, "0")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* History */}
              {historico && historico.length > 0 && (
                <Card className="border-0 bg-white/5 backdrop-blur">
                  <CardContent className="p-6">
                    <h3 className="text-white/80 font-semibold mb-4">🏆 Últimas Ganhadoras</h3>
                    <div className="space-y-3">
                      {historico.map((g: any) => (
                        <div key={g.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
                          <div>
                            <p className="text-white font-medium">{ganhadoresNome(g)}</p>
                            {g.premio_descricao && (
                              <p className="text-white/50 text-sm">{g.premio_descricao}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="border-green-500/50 text-green-400 text-xs">
                            ✅ Retirado
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </section>

      {/* QR Code */}
      <section className="px-4 pb-16">
        <Card className="max-w-sm mx-auto border-0 bg-white/10 backdrop-blur text-center">
          <CardContent className="p-8 space-y-4">
            <Share2 className="w-8 h-8 text-[#C9A84C] mx-auto" />
            <p className="text-white font-semibold">Compartilhe com amigas!</p>
            <div className="bg-white rounded-xl p-4 inline-block">
              <QRCodeSVG
                value="https://gestaoebd.lovable.app/sorteio"
                size={160}
                fgColor="#1a1a2e"
                bgColor="#ffffff"
              />
            </div>
            <p className="text-white/50 text-sm">Escaneie o QR Code para acessar</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
