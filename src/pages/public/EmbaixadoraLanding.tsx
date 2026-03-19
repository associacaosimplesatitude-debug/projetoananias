import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Crown, DollarSign, Smartphone, Gift, CheckCircle, Loader2, Star } from "lucide-react";
import { z } from "zod";

const embaixadoraSchema = z.object({
  nome: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  whatsapp: z.string().trim().min(10, "WhatsApp inválido").max(15),
});

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
  const cadastroOk = searchParams.get("cadastro") === "ok";

  const [form, setForm] = useState({ nome: "", email: "", whatsapp: "" });
  const [submitting, setSubmitting] = useState(false);
  const [cadastroFeito, setCadastroFeito] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = embaixadoraSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const whatsappDigits = form.whatsapp.replace(/\D/g, "");
      const codigo = gerarCodigoUnico(form.nome);

      // Get tier Iniciante
      const tierIniciante = tiers?.find((t) => t.nome === "Iniciante");

      const { data: insertedData, error } = await supabase.from("embaixadoras").insert({
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        whatsapp: whatsappDigits,
        codigo_unico: codigo,
        status: "pendente",
        tier_id: tierIniciante?.id ?? null,
      }).select("id").single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Este email já está cadastrado como embaixadora.");
        } else {
          toast.error("Erro ao cadastrar. Tente novamente.");
        }
        return;
      }

      // Trigger email sequence
      await supabase.functions.invoke("embaixadora-email-sequence", {
        body: { embaixadora_id: insertedData.id },
      });

      setCadastroFeito(true);
      toast.success("Cadastro realizado! 🎉");
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const tierConfig = [
    { icon: "🥉", color: "from-amber-700/20 to-amber-800/10", border: "border-amber-700/30", badge: "bg-amber-700" },
    { icon: "🥈", color: "from-gray-300/20 to-gray-400/10", border: "border-gray-400/30", badge: "bg-gray-500" },
    { icon: "🥇", color: "from-yellow-400/20 to-yellow-500/10", border: "border-yellow-400/30", badge: "bg-[#C9A84C]" },
  ];

  const formatWhatsApp = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
      {/* Confirmation Banner */}
      {cadastroOk && (
        <div className="bg-emerald-500 text-white text-center py-4 px-4">
          <div className="flex items-center justify-center gap-2 font-semibold">
            <CheckCircle className="w-5 h-5" />
            Cadastro realizado! Você está concorrendo aos prêmios 🎉
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
            Seja uma <span className="text-[#C9A84C]">Embaixadora</span> Central Gospel
          </h1>
          <p className="text-lg text-white/70">
            Indique, venda e ganhe comissões todo mês
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 pb-12">
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
                <p className="text-white/60 text-sm">{benefit.desc}</p>
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
                    <p className="text-white/50 text-sm">
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

      {/* Form */}
      <section className="px-4 pb-16">
        <Card className="max-w-lg mx-auto border-0 shadow-2xl bg-white/95 backdrop-blur">
          <CardContent className="p-6 md:p-8">
            {cadastroFeito ? (
              <div className="text-center space-y-4 py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Cadastro realizado!</h3>
                <p className="text-gray-600">
                  Em breve você receberá seu link personalizado por email.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-center mb-6 text-gray-800">
                  👑 Quero ser Embaixadora
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    placeholder="Nome completo"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    maxLength={100}
                    required
                  />
                  <Input
                    type="email"
                    placeholder="Seu melhor email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    maxLength={255}
                    required
                  />
                  <Input
                    placeholder="WhatsApp (00) 00000-0000"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: formatWhatsApp(e.target.value) })}
                    maxLength={15}
                    required
                  />
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 text-base font-bold bg-[#C9A84C] hover:bg-[#b8963e] text-white border-0"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cadastrar como Embaixadora 👑"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
