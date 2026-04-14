import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import confetti from "canvas-confetti";

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

const NOMES_FICTICIOS = [
  "Maria Silva", "Ana Oliveira", "Juliana Santos", "Priscila Costa",
  "Fernanda Lima", "Débora Souza", "Raquel Almeida", "Patrícia Ribeiro",
  "Camila Martins", "Beatriz Ferreira", "Larissa Pereira", "Gabriela Rocha",
  "Luciana Gomes", "Cristina Araújo", "Vanessa Barbosa", "Renata Cardoso",
];

function RouletteOverlay({ nome, onDone }: { nome: string; onDone: () => void }) {
  const [displayName, setDisplayName] = useState(NOMES_FICTICIOS[0]);
  const [revealed, setRevealed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let step = 0;
    const totalSteps = 30;
    let delay = 60;

    const tick = () => {
      step++;
      if (step >= totalSteps) {
        setDisplayName(nome);
        setRevealed(true);
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.5 },
          colors: ["#045f74", "#61c0d0", "#2c3061", "#FFFFFF"],
        });
        setTimeout(onDone, 4000);
        return;
      }
      const idx = Math.floor(Math.random() * NOMES_FICTICIOS.length);
      setDisplayName(NOMES_FICTICIOS[idx]);
      delay += step * 4;
      intervalRef.current = setTimeout(tick, delay);
    };

    intervalRef.current = setTimeout(tick, delay);
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [nome, onDone]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-fade-in">
      <div className="text-center space-y-6 px-4">
        <p className="text-white/60 text-lg uppercase tracking-widest">
          {revealed ? "🎉 Ganhador(a)!" : "Sorteando..."}
        </p>
        <p
          className={`font-bold transition-all duration-500 ${
            revealed
              ? "text-5xl md:text-7xl text-[#61c0d0] scale-110"
              : "text-3xl md:text-5xl text-white animate-pulse"
          }`}
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {displayName}
        </p>
        {revealed && (
          <div className="animate-fade-in">
            <Trophy className="w-16 h-16 text-[#61c0d0] mx-auto mt-4" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function SorteioAge26Landing() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: "", whatsapp: "", email: "", cidade: "", igreja: "" });
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [mostrandoRoleta, setMostrandoRoleta] = useState(false);
  const [nomeRoleta, setNomeRoleta] = useState("");
  const ultimoGanhadorRef = useRef<string | null>(null);
  const [fotoModal, setFotoModal] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    supabase
      .from("sorteio_page_views")
      .insert({
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
      } as any)
      .then(() => {});
  }, []);

  const { data: sessaoAtiva } = useQuery({
    queryKey: ["sorteio-age26-sessao-ativa"],
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

  const sessaoId = sessaoAtiva?.id;

  const { data: totalParticipantes } = useQuery({
    queryKey: ["sorteio-age26-count", sessaoId],
    queryFn: async () => {
      if (!sessaoId) return 0;
      const { count } = await supabase
        .from("sorteio_participantes")
        .select("*", { count: "exact", head: true })
        .eq("sessao_id", sessaoId);
      return count ?? 0;
    },
    refetchInterval: 15000,
  });

  const { data: ganhadoresAtuais } = useQuery({
    queryKey: ["sorteio-age26-ganhadores-atuais", sessaoId],
    queryFn: async () => {
      if (!sessaoId) return [];
      const { data } = await supabase
        .from("sorteio_ganhadores")
        .select("*, sorteio_participantes(nome)")
        .eq("sessao_id", sessaoId)
        .eq("status", "aguardando")
        .order("sorteado_em", { ascending: false });
      return (data ?? []) as any[];
    },
    refetchInterval: 5000,
  });

  const { data: historico } = useQuery({
    queryKey: ["sorteio-age26-historico", sessaoId],
    queryFn: async () => {
      if (!sessaoId) return [];
      const { data } = await supabase
        .from("sorteio_ganhadores")
        .select("*, sorteio_participantes(nome)")
        .eq("sessao_id", sessaoId)
        .eq("status", "retirado")
        .order("sorteado_em", { ascending: false })
        .limit(5);
      return (data ?? []) as any[];
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    const latest = ganhadoresAtuais?.[0];
    if (!latest?.id) return;
    if (ultimoGanhadorRef.current === null) {
      ultimoGanhadorRef.current = latest.id;
      return;
    }
    if (latest.id !== ultimoGanhadorRef.current) {
      const nome = latest?.sorteio_participantes?.nome ?? "Ganhador(a)";
      setNomeRoleta(nome);
      setMostrandoRoleta(true);
      ultimoGanhadorRef.current = latest.id;
    }
  }, [ganhadoresAtuais]);

  const handleRouletteEnd = useCallback(() => {
    setMostrandoRoleta(false);
  }, []);

  const proximoSorteio = useMemo(() => {
    if (!sessaoAtiva) return null;
    const inicio = new Date(sessaoAtiva.data_inicio).getTime();
    const fim = new Date(sessaoAtiva.data_fim).getTime();
    const intervalo = (sessaoAtiva.intervalo_minutos ?? 60) * 60 * 1000;
    let proximo = inicio + intervalo;
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

  const calcTempoRetirada = (sorteadoEm: string) => {
    const expira = new Date(sorteadoEm).getTime() + 3 * 3600000;
    const diff = Math.max(0, expira - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { h, m, s, expirado: diff === 0 };
  };

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
          toast.error("Você já está cadastrado! Use outro WhatsApp ou email.");
        } else {
          toast.error("Erro ao cadastrar. Tente novamente.");
        }
        return;
      }
      toast.success("Cadastro realizado com sucesso! 🎉");
      navigate("/age26/obrigado");
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const ganhadoresNome = (g: any) => g?.sorteio_participantes?.nome ?? "Participante";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f6f5f8" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {mostrandoRoleta && <RouletteOverlay nome={nomeRoleta} onDone={handleRouletteEnd} />}

      {/* Header */}
      <section className="relative w-full" style={{ background: "linear-gradient(135deg, #045f74 0%, #2c3061 100%)" }}>
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
          <p className="text-[#61c0d0] text-sm md:text-base uppercase tracking-[0.3em] mb-4 font-medium" style={{ fontFamily: "Inter, sans-serif" }}>
            Assembleia Geral Evangélica 2026
          </p>
          <h1
            className="text-4xl md:text-6xl font-bold text-white leading-tight mb-4"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Sorteio <span className="text-[#61c0d0]">AGE26</span>
          </h1>
          <p className="text-white/70 text-lg md:text-xl mb-6" style={{ fontFamily: "Inter, sans-serif" }}>
            João Pessoa, PB
          </p>
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
            <Users className="w-5 h-5 text-[#61c0d0]" />
            <span className="text-white font-semibold text-lg">{totalParticipantes ?? 0}</span>
            <span className="text-white/60 text-sm">inscritos</span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16" style={{ background: "linear-gradient(to bottom, transparent, #f6f5f8)" }} />
      </section>

      {/* Form + Prize */}
      <section className="px-4 pb-12 -mt-8 relative z-10">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-start">
          {/* Prize */}
          <div className="flex flex-col items-center text-center space-y-5 order-1">
            <div
              className="w-48 h-48 md:w-56 md:h-56 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #045f74, #2c3061)", boxShadow: "0 20px 60px -15px rgba(4,95,116,0.4)" }}
            >
              <Gift className="w-24 h-24 text-[#61c0d0]" />
            </div>
            <h3 className="text-xl font-bold text-[#2c3061]" style={{ fontFamily: "'Playfair Display', serif" }}>
              🎁 Prêmio
            </h3>
            <p className="text-[#045f74] font-semibold text-lg">Produtos da Editora</p>
            <p className="text-[#2c3061]/60 text-sm max-w-xs leading-relaxed" style={{ fontFamily: "Inter, sans-serif" }}>
              Concorra a produtos exclusivos da Eco Editora durante o evento AGE26!
            </p>
            <Badge
              className="text-sm px-4 py-1.5 border"
              style={{
                backgroundColor: "rgba(4,95,116,0.1)",
                color: "#045f74",
                borderColor: "rgba(4,95,116,0.3)",
              }}
            >
              ⏱ Sorteios durante o evento
            </Badge>
          </div>

          {/* Form */}
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur order-2">
            <CardContent className="p-6 md:p-8">
              <h2
                className="text-xl font-bold text-center mb-6 text-[#2c3061]"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                📝 Faça sua inscrição
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input placeholder="Nome completo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={100} required />
                <Input placeholder="WhatsApp (00) 00000-0000" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: formatWhatsApp(e.target.value) })} maxLength={15} required />
                <Input type="email" placeholder="Seu melhor email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} required />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} maxLength={100} />
                  <Input placeholder="Igreja" value={form.igreja} onChange={(e) => setForm({ ...form, igreja: e.target.value })} maxLength={100} />
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 text-base font-bold text-white border-0"
                  style={{ backgroundColor: "#045f74" }}
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Quero participar! 🎁"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Live Draw */}
      <section className="px-4 pb-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2
            className="text-2xl font-bold text-[#2c3061] text-center flex items-center justify-center gap-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            <Trophy className="w-6 h-6 text-[#045f74]" />
            Sorteio ao Vivo
          </h2>

          {!sessaoAtiva ? (
            <Card className="border-0 bg-[#045f74]/10 text-center">
              <CardContent className="p-8">
                <Clock className="w-12 h-12 text-[#045f74]/40 mx-auto mb-3" />
                <p className="text-[#2c3061]/60 text-lg">Aguarde o próximo sorteio</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {countdown && countdown.total > 0 && (
                <Card className="border border-[#045f74]/30 bg-white/80 backdrop-blur">
                  <CardContent className="p-6 text-center">
                    <p className="text-[#2c3061]/70 text-sm mb-3">Próximo sorteio em</p>
                    <div className="flex justify-center gap-4">
                      {[
                        { label: "Horas", value: countdown.h },
                        { label: "Min", value: countdown.m },
                        { label: "Seg", value: countdown.s },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg px-4 py-3 min-w-[70px] border" style={{ backgroundColor: "rgba(4,95,116,0.08)", borderColor: "rgba(4,95,116,0.2)" }}>
                          <span className="text-3xl font-bold font-mono" style={{ color: "#045f74" }}>
                            {String(item.value).padStart(2, "0")}
                          </span>
                          <p className="text-[#2c3061]/60 text-xs mt-1">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {ganhadoresAtuais && ganhadoresAtuais.length > 0 && ganhadoresAtuais.map((ganhador: any) => {
                const tempo = ganhador.sorteado_em ? calcTempoRetirada(ganhador.sorteado_em) : null;
                return (
                  <Card key={ganhador.id} className="border-0 backdrop-blur border" style={{ background: "linear-gradient(135deg, rgba(4,95,116,0.12), rgba(97,192,208,0.1))", borderColor: "rgba(4,95,116,0.3)" }}>
                    <CardContent className="p-6 text-center space-y-3">
                      <Badge className="text-white border-0 text-sm px-4" style={{ backgroundColor: "#045f74" }}>🎉 Ganhador(a)</Badge>
                      <h3 className="text-2xl font-bold text-[#2c3061]" style={{ fontFamily: "'Playfair Display', serif" }}>{ganhadoresNome(ganhador)}</h3>
                      {ganhador.sorteado_em && (
                        <p className="text-[#2c3061]/60 text-sm">
                          Sorteado em: {new Date(ganhador.sorteado_em).toLocaleDateString("pt-BR")} às{" "}
                          {new Date(ganhador.sorteado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                      {ganhador.premio_descricao && (
                        <p className="text-[#045f74] font-medium">{ganhador.premio_descricao}</p>
                      )}
                      {tempo && !tempo.expirado && (
                        <p className="text-[#2c3061]/60 text-sm">
                          ⏳ Tempo para retirada: {String(tempo.h).padStart(2, "0")}:
                          {String(tempo.m).padStart(2, "0")}:{String(tempo.s).padStart(2, "0")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {historico && historico.length > 0 && (
                <Card className="border bg-white/60 backdrop-blur" style={{ borderColor: "rgba(4,95,116,0.2)" }}>
                  <CardContent className="p-6">
                    <h3 className="text-[#2c3061] font-semibold mb-4">🏆 Últimos Ganhadores</h3>
                    <div className="space-y-3">
                      {historico.map((g: any) => (
                        <div key={g.id} className="flex items-center gap-4 rounded-lg px-4 py-3 border" style={{ backgroundColor: "rgba(4,95,116,0.04)", borderColor: "rgba(4,95,116,0.1)" }}>
                          {g.foto_url ? (
                            <img
                              src={g.foto_url}
                              alt={ganhadoresNome(g)}
                              className="w-12 h-12 rounded-full object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              style={{ borderWidth: 2, borderStyle: "solid", borderColor: "#045f74" }}
                              onClick={() => setFotoModal(g.foto_url)}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(4,95,116,0.15)" }}>
                              <Trophy className="w-6 h-6 text-[#045f74]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[#2c3061] font-medium">{ganhadoresNome(g)}</p>
                            {g.premio_descricao && <p className="text-[#2c3061]/50 text-sm">{g.premio_descricao}</p>}
                            {g.sorteado_em && (
                              <p className="text-[#2c3061]/40 text-xs">
                                {new Date(g.sorteado_em).toLocaleDateString("pt-BR")} às{" "}
                                {new Date(g.sorteado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs flex-shrink-0" style={{ borderColor: "rgba(4,95,116,0.4)", color: "#045f74" }}>
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
        <Card className="max-w-sm mx-auto border-0 text-center" style={{ backgroundColor: "rgba(4,95,116,0.08)" }}>
          <CardContent className="p-8 space-y-4">
            <Share2 className="w-8 h-8 text-[#045f74] mx-auto" />
            <p className="text-[#2c3061] font-semibold">Compartilhe!</p>
            <div className="bg-white rounded-xl p-4 inline-block">
              <QRCodeSVG value="https://gestaoebd.lovable.app/sorteio/age26" size={160} fgColor="#045f74" bgColor="#ffffff" />
            </div>
            <p className="text-[#2c3061]/50 text-sm">Escaneie o QR Code para acessar</p>
          </CardContent>
        </Card>
      </section>

      {/* Photo modal */}
      <Dialog open={!!fotoModal} onOpenChange={() => setFotoModal(null)}>
        <DialogContent className="sm:max-w-lg p-2 bg-black/90 border-0">
          {fotoModal && (
            <img src={fotoModal} alt="Foto do ganhador" className="w-full h-auto rounded-lg object-contain max-h-[80vh]" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
