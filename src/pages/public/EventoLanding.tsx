import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { pushInscricaoEvento } from "@/lib/gtm";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

type CampoExtra = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

type Evento = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  banner_url: string | null;
  cor_primaria: string | null;
  texto_botao_cta: string | null;
  campos_extra: CampoExtra[] | null;
  conteudo_liberado_url: string | null;
  conteudo_liberado_ate: string | null;
  conteudo_liberado_label: string | null;
};

const getSessaoId = () => {
  const key = "evento_sessao_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
};

export default function EventoLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({ nome: "", whatsapp: "", email: "", cidade: "" });
  const [extras, setExtras] = useState<Record<string, string>>({});

  const utms = useMemo(
    () => ({
      utm_source: searchParams.get("utm_source"),
      utm_medium: searchParams.get("utm_medium"),
      utm_campaign: searchParams.get("utm_campaign"),
    }),
    [searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("eventos")
        .select("id,nome,slug,descricao,banner_url,cor_primaria,texto_botao_cta,campos_extra,conteudo_liberado_url,conteudo_liberado_ate,conteudo_liberado_label")
        .eq("slug", slug ?? "")
        .eq("ativo", true)
        .maybeSingle();
      if (cancelled) return;
      setEvento((data as any) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!evento?.id) return;
    const sessaoId = getSessaoId();
    const viewKey = `evento_view_${evento.id}`;
    if (sessionStorage.getItem(viewKey)) return;
    sessionStorage.setItem(viewKey, "1");
    supabase
      .from("eventos_page_views")
      .insert({
        evento_id: evento.id,
        sessao_id: sessaoId,
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
      } as any)
      .then(() => {});
  }, [evento?.id]);

  const camposExtra: CampoExtra[] = Array.isArray(evento?.campos_extra) ? (evento!.campos_extra as CampoExtra[]) : [];
  const cor = evento?.cor_primaria || "#1d4ed8";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evento) return;
    if (!form.nome.trim()) {
      toast.error("Informe seu nome");
      return;
    }
    for (const campo of camposExtra) {
      if (campo.required && !String(extras[campo.key] ?? "").trim()) {
        toast.error(`Preencha o campo "${campo.label}"`);
        return;
      }
    }
    setSubmitting(true);
    const { error } = await supabase.from("eventos_inscritos").insert({
      evento_id: evento.id,
      nome: form.nome.trim(),
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      cidade: form.cidade.trim() || null,
      respostas_extra: extras,
      utm_source: utms.utm_source,
      utm_medium: utms.utm_medium,
      utm_campaign: utms.utm_campaign,
      user_agent: navigator.userAgent,
      referrer: document.referrer || null,
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível concluir sua inscrição. Tente novamente.");
      return;
    }
    pushInscricaoEvento(evento.id, evento.nome, evento.slug);
    if (typeof window.fbq === "function") {
      window.fbq("track", "Lead", { content_name: evento.nome });
    }
    toast.success("Inscrição confirmada!");
    setDone(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Evento não encontrado ou encerrado</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            O link que você acessou não está mais disponível.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {evento.banner_url && (
        <img src={evento.banner_url} alt={`Banner do evento ${evento.nome}`} className="w-full max-h-[420px] object-cover" />
      )}
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <header className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold">{evento.nome}</h1>
          {evento.descricao && <p className="text-neutral-300 whitespace-pre-line">{evento.descricao}</p>}
        </header>

        <Card className="bg-white text-neutral-900">
          <CardContent className="p-6">
            {done ? (
              <div className="text-center space-y-3 py-6">
                <CheckCircle2 className="h-12 w-12 mx-auto" style={{ color: cor }} />
                <h2 className="text-2xl font-semibold">Inscrição confirmada!</h2>
                <p className="text-neutral-600">Recebemos seus dados. Em breve entraremos em contato.</p>
                {evento.conteudo_liberado_url &&
                  (evento.conteudo_liberado_ate && new Date() > new Date(evento.conteudo_liberado_ate) ? (
                    <p className="text-sm text-neutral-500 italic">
                      O período de degustação/acesso a este conteúdo encerrou.
                    </p>
                  ) : (
                    <a
                      href={evento.conteudo_liberado_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-full rounded-md px-4 py-3 text-white font-medium hover:opacity-90"
                      style={{ backgroundColor: cor }}
                    >
                      {evento.conteudo_liberado_label || "Baixar conteúdo"}
                    </a>
                  ))}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input id="whatsapp" inputMode="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                </div>

                {camposExtra.map((campo) => (
                  <div key={campo.key} className="space-y-2">
                    <Label htmlFor={`extra-${campo.key}`}>
                      {campo.label}
                      {campo.required ? " *" : ""}
                    </Label>
                    {campo.type === "selecao" || campo.type === "select" ? (
                      <Select
                        value={extras[campo.key] ?? ""}
                        onValueChange={(v) => setExtras((p) => ({ ...p, [campo.key]: v }))}
                      >
                        <SelectTrigger id={`extra-${campo.key}`}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {(campo.options ?? []).map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={`extra-${campo.key}`}
                        type={campo.type === "numero" ? "number" : campo.type === "email" ? "email" : campo.type === "telefone" ? "tel" : "text"}
                        value={extras[campo.key] ?? ""}
                        onChange={(e) => setExtras((p) => ({ ...p, [campo.key]: e.target.value }))}
                        required={!!campo.required}
                      />
                    )}
                  </div>
                ))}

                <Button type="submit" className="w-full text-white hover:opacity-90" style={{ backgroundColor: cor }} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : evento.texto_botao_cta || "Quero me inscrever"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
