import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Videos {
  video_celular_cg_digital: string | null;
  video_desktop_cg_digital: string | null;
  video_celular_leitor: string | null;
  video_desktop_leitor: string | null;
}

export default function EscolhaVersao() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const whatsapp = searchParams.get("w") || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [videos, setVideos] = useState<Videos>({
    video_celular_cg_digital: null,
    video_desktop_cg_digital: null,
    video_celular_leitor: null,
    video_desktop_leitor: null,
  });

  useEffect(() => {
    const load = async () => {
      const promises: Promise<void>[] = [];
      if (whatsapp) {
        promises.push(
          supabase.functions
            .invoke("buscar-preferencia-versao", { body: { whatsapp } })
            .then(({ data }) => {
              if (data?.encontrado && data.nome) setNome(data.nome);
            })
            .catch(() => {})
        );
      }
      promises.push(
        supabase.functions
          .invoke("buscar-videos-escolha", { body: {} })
          .then(({ data }) => {
            if (data) setVideos(data);
          })
          .catch(() => {})
      );
      await Promise.all(promises);
      setLoading(false);
    };
    load();
  }, [whatsapp]);

  const handleChoose = async (versao: "cg_digital" | "leitor_cg") => {
    setSaving(versao);
    try {
      if (whatsapp) {
        const { error } = await supabase.functions.invoke("salvar-preferencia-versao", {
          body: { whatsapp, versao },
        });
        if (error) console.error("[EscolhaVersao] Erro ao salvar:", error);
      }
    } catch (err) {
      console.error("[EscolhaVersao] Erro catch:", err);
    }
    navigate(versao === "cg_digital" ? "/revista/acesso" : "/leitor/acesso", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#000" }}>
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#000" }}>
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <img
            src="/icons/logo-cg.png"
            alt="Central Gospel"
            className="w-[72px] h-[72px] mx-auto"
            style={{ borderRadius: 14 }}
          />
          {nome && <h1 className="text-white text-[22px] font-bold">Olá, {nome}!</h1>}
          <p style={{ color: "#9ca3af" }} className="text-base">
            Como você prefere ler sua revista?
          </p>
        </div>

        {/* CG Digital Card */}
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "#111", border: "2px solid #FFC107" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: "rgba(255,193,7,0.15)" }}
            >
              📖
            </div>
            <div className="flex-1">
              <span className="text-white font-bold text-lg">CG Digital</span>
            </div>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "rgba(255,193,7,0.15)", color: "#FFC107" }}
            >
              Versão completa
            </span>
          </div>
          <p style={{ color: "#9ca3af" }} className="text-sm">
            Acesso completo com recursos exclusivos para enriquecer seu estudo bíblico.
          </p>
          <ul className="space-y-2.5">
            {[
              { icon: "✓", color: "#22c55e", text: "Acesso com número de celular, sem senha", textColor: "#ffffff" },
              { icon: "✓", color: "#22c55e", text: "Páginas da revista na tela, uma após a outra", textColor: "#ffffff" },
              { icon: "✓", color: "#22c55e", text: "Modo noturno para não cansar os olhos", textColor: "#ffffff" },
              { icon: "✓", color: "#22c55e", text: "Quiz ao final de cada lição com pontuação e ranking", textColor: "#ffffff" },
              { icon: "✓", color: "#22c55e", text: "Versículos bíblicos aparecem sem sair da revista", textColor: "#ffffff" },
              { icon: "✓", color: "#22c55e", text: "Anotações salvas em qualquer dispositivo", textColor: "#ffffff" },
              { icon: "✓", color: "#22c55e", text: "Continua de onde parou automaticamente", textColor: "#ffffff" },
              { icon: "✓", color: "#22c55e", text: "Não ocupa espaço no celular", textColor: "#ffffff" },
              { icon: "✗", color: "#ef4444", text: "Não funciona sem internet", textColor: "#ffffff" },
            ].map((item, i) => (
              <li key={i} className="flex items-start" style={{ gap: 10 }}>
                <span style={{ color: item.color, fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ color: item.textColor, fontSize: 15, lineHeight: 1.5 }}>{item.text}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleChoose("cg_digital")}
            disabled={saving !== null}
            className="w-full py-3 rounded-xl font-bold text-base transition-opacity"
            style={{ backgroundColor: "#FFC107", color: "#000" }}
          >
            {saving === "cg_digital" ? "Redirecionando..." : "Quero o CG Digital"}
          </button>
        </div>

        {/* Leitor CG Card */}
        <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "#111", border: "1px solid #3d3d3d" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              📱
            </div>
            <div className="flex-1">
              <span className="text-white font-bold text-lg">Leitor CG</span>
            </div>
            <span
              className="text-[10px] font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "#9ca3af" }}
            >
              Versão offline — baixa a revista no seu celular
            </span>
          </div>
          <p style={{ color: "#9ca3af" }} className="text-sm">
            Na primeira vez, a revista é baixada para o seu celular. Depois é só abrir e ler — mesmo sem internet, em qualquer lugar.
          </p>
          <ul className="space-y-2.5">
            {[
              { icon: "✓", color: "#22c55e", text: "Acesso com número de celular, sem senha", textColor: "#ffffff" },
              { icon: "✓", color: "#22c55e", text: "Páginas da revista na tela, uma após a outra", textColor: "#ffffff" },
              { icon: "✓", color: "#22c55e", text: "Funciona sem internet após o primeiro acesso", textColor: "#ffffff" },
              { icon: "✗", color: "#ef4444", text: "Sem quiz, pontuação e ranking", textColor: "#ffffff" },
              { icon: "✗", color: "#ef4444", text: "Sem versículos bíblicos integrados", textColor: "#ffffff" },
              { icon: "✗", color: "#ef4444", text: "Sem anotações por página", textColor: "#ffffff" },
              { icon: "✗", color: "#ef4444", text: "Sem modo noturno", textColor: "#ffffff" },
            ].map((item, i) => (
              <li key={i} className="flex items-start" style={{ gap: 10 }}>
                <span style={{ color: item.color, fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{item.icon}</span>
                <span style={{ color: item.textColor, fontSize: 15, lineHeight: 1.5 }}>{item.text}</span>
              </li>
            ))}
            <li className="flex items-start" style={{ gap: 10 }}>
              <span style={{ color: "#f59e0b", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>⚠</span>
              <span style={{ color: "#fbbf24", fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>Atenção: ocupa espaço no celular</span>
            </li>
          </ul>
          <button
            onClick={() => handleChoose("leitor_cg")}
            disabled={saving !== null}
            className="w-full py-3 rounded-xl font-bold text-base transition-opacity"
            style={{ backgroundColor: "#1a1a1a", border: "1.5px solid #FFC107", color: "#FFC107" }}
          >
            {saving === "leitor_cg" ? "Redirecionando..." : "Quero o Leitor CG"}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: "#374151" }}>
          Você pode mudar sua preferência a qualquer momento
        </p>
      </div>
    </div>
  );
}
