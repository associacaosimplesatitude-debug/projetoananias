import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const nowMs = now.getTime();

    // 1. Buscar sessão ativa
    const { data: sessao, error: sessaoErr } = await supabase
      .from("sorteio_sessoes")
      .select("*")
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    if (sessaoErr) throw sessaoErr;
    if (!sessao) {
      return new Response(
        JSON.stringify({ sorteado: false, motivo: "Nenhuma sessão ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Verificar se está dentro do horário
    const inicio = new Date(sessao.data_inicio).getTime();
    const fim = new Date(sessao.data_fim).getTime();

    if (nowMs < inicio || nowMs > fim) {
      return new Response(
        JSON.stringify({ sorteado: false, motivo: "Fora do horário da sessão" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Calcular se é hora de sortear
    const intervaloMs = (sessao.intervalo_minutos ?? 60) * 60 * 1000;
    let proximoSlot = inicio;
    while (proximoSlot < nowMs) {
      proximoSlot += intervaloMs;
    }
    // O slot mais recente que já passou
    const slotAtual = proximoSlot - intervaloMs;
    const diffSlot = Math.abs(nowMs - slotAtual);

    // Tolerância de 5 minutos
    if (diffSlot > 5 * 60 * 1000) {
      return new Response(
        JSON.stringify({ sorteado: false, motivo: "Não é hora de sortear ainda" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Verificar se já sorteou neste slot
    const slotInicio = new Date(slotAtual - 5 * 60 * 1000).toISOString();
    const slotFim = new Date(slotAtual + 5 * 60 * 1000).toISOString();

    const { data: jaExiste } = await supabase
      .from("sorteio_ganhadores")
      .select("id")
      .eq("sessao_id", sessao.id)
      .gte("sorteado_em", slotInicio)
      .lte("sorteado_em", slotFim)
      .limit(1);

    if (jaExiste && jaExiste.length > 0) {
      return new Response(
        JSON.stringify({ sorteado: false, motivo: "Já sorteou neste slot" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Buscar participantes elegíveis
    const { data: participantes } = await supabase
      .from("sorteio_participantes")
      .select("id, nome")
      .eq("sessao_id", sessao.id);

    if (!participantes || participantes.length === 0) {
      return new Response(
        JSON.stringify({ sorteado: false, motivo: "Nenhum participante na sessão" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Excluir quem já ganhou (status != expirado)
    const { data: jaGanharam } = await supabase
      .from("sorteio_ganhadores")
      .select("participante_id")
      .neq("status", "expirado");

    const idsGanharam = new Set((jaGanharam ?? []).map((g: any) => g.participante_id));
    const elegiveis = participantes.filter((p: any) => !idsGanharam.has(p.id));

    if (elegiveis.length === 0) {
      return new Response(
        JSON.stringify({ sorteado: false, motivo: "Todos já ganharam" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Sortear aleatoriamente
    const winnerIdx = Math.floor(Math.random() * elegiveis.length);
    const winner = elegiveis[winnerIdx];

    const expiraEm = new Date(nowMs + 3 * 3600000).toISOString();

    const { error: insertErr } = await supabase.from("sorteio_ganhadores").insert({
      participante_id: winner.id,
      sessao_id: sessao.id,
      status: "aguardando",
      premio_descricao: sessao.premio_padrao || null,
      expira_em: expiraEm,
    });

    if (insertErr) throw insertErr;

    console.log(`🎉 Sorteio automático: ${winner.nome} ganhou!`);

    return new Response(
      JSON.stringify({ sorteado: true, ganhadora: winner.nome }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro no sorteio automático:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
