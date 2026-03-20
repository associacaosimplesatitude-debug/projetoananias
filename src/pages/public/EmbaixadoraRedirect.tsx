import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const EMB_REF_KEY = "emb_ref";
const EMB_REF_EXPIRY_KEY = "emb_ref_expiry";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function EmbaixadoraRedirect() {
  const { codigo } = useParams<{ codigo: string }>();

  useEffect(() => {
    const processRedirect = async () => {
      const codigoUpper = (codigo ?? "").trim().toUpperCase();

      if (!codigoUpper) {
        window.location.href = "https://centralgospel.com.br";
        return;
      }

      // Buscar embaixadora ativa
      const { data: emb } = await supabase
        .from("embaixadoras")
        .select("id")
        .eq("codigo_unico", codigoUpper)
        .eq("status", "ativa")
        .maybeSingle();

      if (!emb) {
        window.location.href = "https://centralgospel.com.br";
        return;
      }

      // Geolocalização expandida
      let cidade = null, estado = null, pais = null, cep = null;
      let operadora = null, fuso_horario = null;
      try {
        const geo = await fetch('https://ipapi.co/json/');
        const geoData = await geo.json();
        cidade = geoData.city || null;
        estado = geoData.region || null;
        pais = geoData.country_name || null;
        cep = geoData.postal || null;
        operadora = geoData.org || null;
        fuso_horario = geoData.timezone || null;
      } catch (e) {}

      // Dados do navegador
      const ua = navigator.userAgent;

      const dispositivo = /Mobi|Android|iPhone|iPad/i.test(ua)
        ? (/iPad/i.test(ua) ? 'tablet' : 'mobile')
        : 'desktop';

      const sistema_operacional = /Android/i.test(ua) ? 'Android'
        : /iPhone|iPad/i.test(ua) ? 'iOS'
        : /Windows/i.test(ua) ? 'Windows'
        : /Mac/i.test(ua) ? 'macOS'
        : /Linux/i.test(ua) ? 'Linux'
        : 'Outro';

      const navegador = /Edg/i.test(ua) ? 'Edge'
        : /Chrome/i.test(ua) ? 'Chrome'
        : /Firefox/i.test(ua) ? 'Firefox'
        : /Safari/i.test(ua) ? 'Safari'
        : /Opera|OPR/i.test(ua) ? 'Opera'
        : 'Outro';

      const largura_tela = window.screen.width;

      const ref = document.referrer || '';
      const canal_origem = ref.includes('whatsapp') ? 'WhatsApp'
        : ref.includes('instagram') ? 'Instagram'
        : ref.includes('facebook') ? 'Facebook'
        : ref.includes('google') ? 'Google'
        : ref.includes('youtube') ? 'YouTube'
        : ref.includes('tiktok') ? 'TikTok'
        : ref ? 'Outro'
        : 'Direto';

      const hora_clique = new Date().getHours();

      // Registrar clique com todos os dados
      await supabase.from("embaixadoras_cliques").insert({
        embaixadora_id: emb.id,
        ip_hash: null,
        referrer: ref || null,
        cidade,
        estado,
        pais,
        cep,
        operadora,
        fuso_horario,
        dispositivo,
        sistema_operacional,
        navegador,
        largura_tela,
        canal_origem,
        hora_clique,
      });

      // Salvar código no localStorage com expiração de 30 dias
      localStorage.setItem(EMB_REF_KEY, codigoUpper);
      localStorage.setItem(EMB_REF_EXPIRY_KEY, String(Date.now() + THIRTY_DAYS_MS));

      // Redirecionar para a loja com o parâmetro emb
      window.location.href = `https://centralgospel.com.br?emb=${codigoUpper}`;
    };

    processRedirect();
  }, [codigo]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f172a]">
      <div className="text-center">
        <img src="/logo-central-gospel.png" alt="Central Gospel" className="mx-auto h-16" />
        <p className="text-white mt-4">Redirecionando...</p>
        <Loader2 className="animate-spin text-[#C9A84C] mx-auto mt-2 h-6 w-6" />
      </div>
    </div>
  );
}
