import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Crown, DollarSign, Smartphone, Gift, CheckCircle, Loader2, Star, Copy, ExternalLink } from "lucide-react";

const gerarCodigoUnico = (nome: string): string => {
  const prefixo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase();
  const numeros = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefixo || "EMB"}${numeros}`;
};

export default function EmbaixadoraLanding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const cadastroOk = searchParams.get("cadastro") === "ok";

  const nome = sessionStorage.getItem("sorteio_nome") || "Você";
  const savedWhatsapp = sessionStorage.getItem("sorteio_whatsapp") || "";

  const [confirmado, setConfirmado] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cadastroFeito, setCadastroFeito] = useState(false);
  const [embaixadoraData, setEmbaixadoraData] = useState<{ codigo: string; nome: string } | null>(null);

  const { data: tiers } = useQuery({
    queryKey: ["embaixadoras-tiers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("embaixadoras_tiers")
        .select("*")
        .order("volume_minimo", { ascending: true });
      return data ?? [];
    },
  });

  const handleSubmit = async () => {
    if (!confirmado) {
      toast.error("Confirme que seus dados estão corretos.");
      return;
    }
    setSubmitting(true);
    try {
      // Buscar participante recém-cadastrado
      let participante: { nome: string; email: string; whatsapp: string } | null = null;

      if (savedWhatsapp) {
        const { data } = await supabase
          .from("sorteio_participantes")
          .select("nome, email, whatsapp")
          .eq("whatsapp", savedWhatsapp)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        participante = data;
      }

      if (!participante) {
        const { data } = await supabase
          .from("sorteio_participantes")
          .select("nome, email, whatsapp")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        participante = data;
      }

      if (!participante) {
        toast.error("Não encontramos seu cadastro. Volte e cadastre-se primeiro.");
        return;
      }

      const codigo = gerarCodigoUnico(participante.nome);
      const tierIniciante = tiers?.find((t) => t.nome === "Iniciante");

      const { data: insertedData, error } = await supabase.from("embaixadoras").insert({
        nome: participante.nome,
        email: participante.email,
        whatsapp: participante.whatsapp,
        codigo_unico: codigo,
        status: "ativa",
        tier_id: tierIniciante?.id ?? null,
      }).select("id").single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Você já está cadastrada como embaixadora.");
        } else {
          toast.error("Erro ao cadastrar. Tente novamente.");
        }
        return;
      }

      await supabase.functions.invoke("embaixadora-email-sequence", {
        body: { embaixadora_id: insertedData.id },
      });

      setEmbaixadoraData({ codigo, nome: participante.nome.split(" ")[0] });
      setCadastroFeito(true);
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const copiarTexto = (texto: string, label: string) => {
    navigator.clipboard.writeText(texto);
    toast.success(`${label} copiado!`);
  };

  const tierConfig = [
    { icon: "🥉", color: "from-amber-100 to-amber-50", border: "border-amber-300", badge: "bg-amber-700", textColor: "text-amber-900", subText: "text-amber-700" },
    { icon: "🥈", color: "from-gray-100 to-gray-50", border: "border-gray-300", badge: "bg-gray-500", textColor: "text-gray-800", subText: "text-gray-600" },
    { icon: "🥇", color: "from-yellow-100 to-yellow-50", border: "border-yellow-300", badge: "bg-[#C9A84C]", textColor: "text-yellow-900", subText: "text-yellow-700" },
  ];

  // Tela de confirmação pós-cadastro
  if (cadastroFeito && embaixadoraData) {
    const link = `centralgospel.com.br?emb=${embaixadoraData.codigo}`;
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full space-y-6">
          {/* Header dourado */}
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-full bg-[#C9A84C]/20 flex items-center justify-center mx-auto">
              <Crown className="w-10 h-10 text-[#C9A84C]" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Bem-vinda ao time, <span className="text-[#C9A84C]">{embaixadoraData.nome}!</span> 🎉
            </h1>
          </div>

          {/* Card com código e link */}
          <Card className="border-0 bg-white/10 backdrop-blur border border-[#C9A84C]/30">
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="text-center space-y-2">
                <p className="text-white/60 text-sm">Seu código exclusivo:</p>
                <p className="text-4xl font-bold text-[#C9A84C] font-mono tracking-wider">
                  {embaixadoraData.codigo}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copiarTexto(embaixadoraData.codigo, "Código")}
                  className="border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10"
                >
                  <Copy className="w-4 h-4 mr-2" /> Copiar código
                </Button>
              </div>

              <div className="border-t border-white/10 pt-4 text-center space-y-2">
                <p className="text-white/60 text-sm">Seu link personalizado:</p>
                <p className="text-white font-medium text-sm break-all">{link}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copiarTexto(link, "Link")}
                  className="border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10"
                >
                  <Copy className="w-4 h-4 mr-2" /> Copiar link
                </Button>
              </div>

              <div className="bg-white/5 rounded-lg p-4 text-center">
                <p className="text-white/70 text-sm">
                  📧 Enviamos todos os detalhes para seu email
                </p>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={() => navigate("/embaixadora/painel")}
            className="w-full h-14 text-lg font-bold bg-[#C9A84C] hover:bg-[#b8963e] text-white border-0"
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Acessar meu Painel de Embaixadora 👑
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
      {/* Confirmation Banner */}
      {cadastroOk && (
        <div className="bg-emerald-500 text-white text-center py-4 px-4">
          <div className="flex items-center justify-center gap-2 font-semibold">
            <CheckCircle className="w-5 h-5" />
            Parabéns, {nome}! Você está concorrendo aos prêmios 🎉
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden py-16 px-4 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(201,168,76,0.15),transparent_70%)]" />
        <div className="relative max-w-2xl mx-auto space-y-6">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
              <Crown className="w-10 h-10 text-[#C9A84C]" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            {nome}, enquanto aguarda o sorteio, <span className="text-[#C9A84C]">que tal ganhar dinheiro todo mês?</span>
          </h1>
          <p className="text-lg text-white/70">
            Seja uma Embaixadora Central Gospel — indique, venda e ganhe comissões
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 pb-12">
        <h2 className="text-xl text-white/80 text-center mb-6 font-medium">
          {nome}, imagine receber comissão toda vez que uma amiga comprar...
        </h2>
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-4">
          {[
            {
              icon: <DollarSign className="w-8 h-8" />,
              title: "Ganhe comissões",
              desc: "Até 12% em cada venda realizada através do seu link",
            },
            {
              icon: <Smartphone className="w-8 h-8" />,
              title: "Painel exclusivo",
              desc: "Acompanhe cliques, vendas e ganhos em tempo real",
            },
            {
              icon: <Gift className="w-8 h-8" />,
              title: "Material pronto",
              desc: "Imagens e textos para divulgar no WhatsApp e Instagram",
            },
          ].map((benefit) => (
            <Card key={benefit.title} className="border-0 bg-white/10 backdrop-blur border border-white/10 hover:border-[#C9A84C]/30 transition-colors">
              <CardContent className="p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-[#C9A84C]/20 flex items-center justify-center mx-auto text-[#C9A84C]">
                  {benefit.icon}
                </div>
                <h3 className="text-white font-bold text-lg">{benefit.title}</h3>
                <p className="text-gray-200 text-sm">{benefit.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section className="px-4 pb-12">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8 flex items-center justify-center gap-2">
            <Star className="w-6 h-6 text-[#C9A84C]" />
            Tiers de Comissão
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {tiers?.map((tier, i) => {
              const config = tierConfig[i] ?? tierConfig[0];
              return (
                <Card key={tier.id} className={`border-0 bg-gradient-to-b ${config.color} backdrop-blur border ${config.border}`}>
                  <CardContent className="p-6 text-center space-y-3">
                    <span className="text-4xl">{config.icon}</span>
                    <Badge className={`${config.badge} text-white border-0 text-sm px-3`}>
                      {tier.nome}
                    </Badge>
                    <p className="text-4xl font-bold text-white">{Number(tier.percentual_comissao)}%</p>
                    <p className="text-gray-100 text-sm font-medium">
                      {tier.volume_maximo
                        ? `R$${Number(tier.volume_minimo).toFixed(0)} a R$${Number(tier.volume_maximo).toFixed(0)}`
                        : `Acima de R$${Number(tier.volume_minimo).toFixed(0)}`}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Form - simplified */}
      <section className="px-4 pb-16">
        <Card className="max-w-lg mx-auto border-0 shadow-2xl bg-white/95 backdrop-blur">
          <CardContent className="p-6 md:p-8">
            <h2 className="text-xl font-bold text-center mb-2 text-gray-800">
              👑 Sim, {nome}, eu quero ser Embaixadora!
            </h2>
            <p className="text-gray-500 text-sm text-center mb-6">
              Usaremos os dados que você já cadastrou no sorteio.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
                <Checkbox
                  id="confirmar"
                  checked={confirmado}
                  onCheckedChange={(checked) => setConfirmado(checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor="confirmar" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                  Confirmo que meus dados estão corretos e quero me cadastrar como Embaixadora
                </label>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !confirmado}
                className="w-full h-12 text-base font-bold bg-[#C9A84C] hover:bg-[#b8963e] text-white border-0 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : `Sim! Quero ser Embaixadora 👑`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
