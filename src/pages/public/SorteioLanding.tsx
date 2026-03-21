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

const BANNER_URL = "https://nccyrvfnvjngfyfvgnww.supabase.co/storage/v1/object/public/ebd-assets/sorteio-banner.jpg";
const PREMIO_URL = "https://nccyrvfnvjngfyfvgnww.supabase.co/storage/v1/object/public/ebd-assets/sorteio-premio.webp";

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
          colors: ["#C9A84C", "#FFD700", "#FFA500", "#FFFFFF"],
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
          {revealed ? "🎉 Ganhadora!" : "Sorteando..."}
        </p>
        <p
          className={`text-white font-bold transition-all duration-500 ${
            revealed
              ? "text-5xl md:text-7xl text-[#C9A84C] scale-110"
              : "text-3xl md:text-5xl animate-pulse"
          }`}
        >
          {displayName}
        </p>
        {revealed && (
          <div className="animate-fade-in">
            <Trophy className="w-16 h-16 text-[#C9A84C] mx-auto mt-4" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function SorteioLanding() {
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

  // Track page view (fire-and-forget)
  useEffect(() => {
    supabase
      .from("sorteio_page_views")
      .insert({
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
      } as any)
      .then(() => {});
  }, []);

  const { data: totalParticipantes } = useQuery({
    queryKey: ["sorteio-count"],
    queryFn: async () => {
      const { count } = await supabase.from("sorteio_participantes").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
    refetchInterval: 15000,
  });

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

  const { data: ganhadoresAtuais } = useQuery({
    queryKey: ["sorteio-ganhadores-atuais"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sorteio_ganhadores")
        .select("*, sorteio_participantes(nome)")
        .eq("status", "aguardando")
        .order("sorteado_em", { ascending: false });
      return (data ?? []) as any[];
    },
    refetchInterval: 5000,
  });

  const { data: historico } = useQuery({
    queryKey: ["sorteio-historico"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sorteio_ganhadores")
        .select("*, sorteio_participantes(nome)")
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
      const nome = latest?.sorteio_participantes?.nome ?? "Ganhadora";
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
      sessionStorage.setItem('sorteio_email', form.email.trim().toLowerCase());
      navigate("/embaixadora?cadastro=ok");
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const ganhadoresNome = (g: any) => g?.sorteio_participantes?.nome ?? "Participante";

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {mostrandoRoleta && <RouletteOverlay nome={nomeRoleta} onDone={handleRouletteEnd} />}

      {/* Banner do Evento */}
      <section className="relative w-full">
        <img
          src={BANNER_URL}
          alt="Vitoriosas Conference — 21 e 22 de Março"
          className="w-full h-[340px] md:h-[480px] object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f172a]" />
      </section>

      {/* Título + Contador */}
      <section className="relative -mt-20 z-10 text-center px-4 pb-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-3">
          Concorra a Prêmios <span className="text-[#C9A84C]">Incríveis!</span>
        </h1>
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/10">
          <Users className="w-5 h-5 text-[#C9A84C]" />
          <span className="text-white font-semibold text-lg">{totalParticipantes ?? 0}</span>
          <span className="text-white/60 text-sm">inscritas</span>
        </div>
      </section>

      {/* Credibilidade do evento */}
      <section className="text-center px-4 pb-8">
        <p className="text-[#C9A84C]/80 text-sm md:text-base tracking-wide">
          Vitoriosas Conference • 21 e 22 de Março • Rua Montevidéu, 900 — Penha, Rio de Janeiro
        </p>
      </section>

      {/* Formulário + Prêmio — 2 colunas */}
      <section className="px-4 pb-12">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-start">
          {/* Coluna esquerda — Prêmio */}
          <div className="flex flex-col items-center text-center space-y-5 order-1 md:order-1">
            <img
              src={PREMIO_URL}
              alt="Kit Gotas de Consolo — Eyshila Santos"
              className="w-64 md:w-80 rounded-2xl"
              style={{
                boxShadow: "0 20px 60px -15px rgba(201,168,76,0.35), 0 0 0 1px rgba(201,168,76,0.15)",
              }}
            />
            <h3 className="text-xl font-bold text-white">🎁 Prêmio deste Sorteio</h3>
            <p className="text-[#C9A84C] font-semibold text-lg">Kit Gotas de Consolo — Eyshila Santos</p>
            <p className="text-white/60 text-sm max-w-xs leading-relaxed">
              Box exclusivo com devocional, caderno espiral, marcador de página, caneta e cartela de adesivos
            </p>
            <Badge className="bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40 text-sm px-4 py-1.5 hover:bg-[#C9A84C]/30">
              ⏱ Sorteado a cada 1 hora
            </Badge>
          </div>

          {/* Coluna direita — Formulário */}
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur order-2 md:order-2">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-xl font-bold text-center mb-6 text-gray-800">
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
                <Button type="submit" disabled={submitting} className="w-full h-12 text-base font-bold bg-[#C9A84C] hover:bg-[#b8963e] text-white border-0">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Quero participar! 🎁"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
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
                <Card className="border border-[#FF6B35]/40 bg-[#0f172a]/90 backdrop-blur">
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-200 text-sm mb-3">Próximo sorteio em</p>
                    <div className="flex justify-center gap-4">
                      {[
                        { label: "Horas", value: countdown.h },
                        { label: "Min", value: countdown.m },
                        { label: "Seg", value: countdown.s },
                      ].map((item) => (
                        <div key={item.label} className="bg-white/10 rounded-lg px-4 py-3 min-w-[70px] border border-[#FF6B35]/20">
                          <span className="text-3xl font-bold text-[#C9A84C] font-mono">
                            {String(item.value).padStart(2, "0")}
                          </span>
                          <p className="text-gray-300 text-xs mt-1">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Current winner */}
              {ganhadoresAtuais && ganhadoresAtuais.length > 0 && ganhadoresAtuais.map((ganhador: any) => {
                const tempo = ganhador.sorteado_em ? calcTempoRetirada(ganhador.sorteado_em) : null;
                return (
                  <Card key={ganhador.id} className="border-0 bg-gradient-to-r from-yellow-500/20 to-amber-500/10 backdrop-blur border border-yellow-500/30">
                    <CardContent className="p-6 text-center space-y-3">
                      <Badge className="bg-[#C9A84C] text-white border-0 text-sm px-4">🎉 Ganhadora</Badge>
                      <h3 className="text-2xl font-bold text-black">{ganhadoresNome(ganhador)}</h3>
                      {ganhador.sorteado_em && (
                        <p className="text-black/60 text-sm">
                          Sorteada em: {new Date(ganhador.sorteado_em).toLocaleDateString("pt-BR")} às{" "}
                          {new Date(ganhador.sorteado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                      {ganhador.premio_descricao && (
                        <p className="text-[#C9A84C] font-medium">{ganhador.premio_descricao}</p>
                      )}
                      {tempo && !tempo.expirado && (
                        <p className="text-black/60 text-sm">
                          ⏳ Tempo para retirada: {String(tempo.h).padStart(2, "0")}:
                          {String(tempo.m).padStart(2, "0")}:{String(tempo.s).padStart(2, "0")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {/* History */}
              {historico && historico.length > 0 && (
                <Card className="border border-[#FF6B35]/30 bg-white/5 backdrop-blur">
                  <CardContent className="p-6">
                    <h3 className="text-white/80 font-semibold mb-4">🏆 Últimas Ganhadoras</h3>
                    <div className="space-y-3">
                      {historico.map((g: any) => (
                        <div key={g.id} className="flex items-center gap-4 bg-white/5 rounded-lg px-4 py-3 border border-[#FF6B35]/15">
                          {g.foto_url ? (
                            <img
                              src={g.foto_url}
                              alt={ganhadoresNome(g)}
                              className="w-12 h-12 rounded-full object-cover border-2 border-[#C9A84C] flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setFotoModal(g.foto_url)}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                              <Trophy className="w-6 h-6 text-[#C9A84C]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium">{ganhadoresNome(g)}</p>
                            {g.premio_descricao && <p className="text-white/50 text-sm">{g.premio_descricao}</p>}
                            {g.sorteado_em && (
                              <p className="text-white/40 text-xs">
                                {new Date(g.sorteado_em).toLocaleDateString("pt-BR")} às{" "}
                                {new Date(g.sorteado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="border-green-500/50 text-green-400 text-xs flex-shrink-0">
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
              <QRCodeSVG value="https://gestaoebd.lovable.app/sorteio" size={160} fgColor="#0f172a" bgColor="#ffffff" />
            </div>
            <p className="text-white/50 text-sm">Escaneie o QR Code para acessar</p>
          </CardContent>
        </Card>
      </section>

      {/* Modal de foto ampliada */}
      <Dialog open={!!fotoModal} onOpenChange={() => setFotoModal(null)}>
        <DialogContent className="sm:max-w-lg p-2 bg-black/90 border-0">
          {fotoModal && (
            <img src={fotoModal} alt="Foto da ganhadora" className="w-full h-auto rounded-lg object-contain max-h-[80vh]" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
