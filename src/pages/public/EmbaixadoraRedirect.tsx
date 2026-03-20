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

      // Buscar geolocalização
      let cidade = null;
      let estado = null;
      try {
        const geo = await fetch('https://ipapi.co/json/');
        const geoData = await geo.json();
        cidade = geoData.city || null;
        estado = geoData.region || null;
      } catch(e) {}

      // Registrar clique com localização
      await supabase.from("embaixadoras_cliques").insert({
        embaixadora_id: emb.id,
        ip_hash: null,
        referrer: document.referrer || null,
        cidade,
        estado,
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
