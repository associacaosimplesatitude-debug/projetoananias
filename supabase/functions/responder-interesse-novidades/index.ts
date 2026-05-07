import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeForMeta(t: string): string {
  const d = (t || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55")) return d;
  return "55" + d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cliente_id, telefone, nome, vendedor_nome, skip_delay } = await req.json();
    if (!telefone || !cliente_id) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotente: se já tem auto_replied_em, não envia de novo
    const { data: jaRespondido } = await supabase
      .from("retencao_respostas")
      .select("id, auto_replied_em")
      .eq("cliente_id", cliente_id)
      .eq("tipo", "interesse")
      .not("auto_replied_em", "is", null)
      .limit(1)
      .maybeSingle();

    if (jaRespondido) {
      console.log(`[responder-interesse] já respondido para cliente ${cliente_id}`);
      return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders });
    }

    if (!skip_delay) {
      await new Promise((r) => setTimeout(r, 30000));
    }

    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);

    const map: Record<string, string> = {};
    (settings || []).forEach((s: any) => { map[s.key] = s.value; });
    const phoneId = map["whatsapp_phone_number_id"];
    const token = map["whatsapp_access_token"];
    if (!phoneId || !token) throw new Error("Credenciais Meta não configuradas");

    const nomeOk = nome || "irmão(a)";
    const vendedorOk = vendedor_nome || "seu consultor";

    const bodyText = `Que bênção falar com você, ${nomeOk}! 🙌

Nosso lançamento mais recente é a revista *"Cartas da Prisão"*: vamos estudar as 4 cartas que Paulo escreveu da prisão — Efésios, Filipenses, Colossenses e Filemon. Uma série densa, profunda, sobre alegria, unidade e perdão mesmo no sofrimento.

Como você é nosso parceiro de longa data, quero te dar de presente o pacote completo:

📖 *Revista Digital "Cartas da Prisão"* — Versão Professor, com as 13 lições completas
📲 Acesso pelo celular, tablet ou computador
✍️ Anotações e versículos direto na aula
🎯 Quiz de perguntas para fixar o aprendizado
🗺️ *Infográfico premium* da revista — perfeito para a sala da EBD

Tudo licenciado no seu nome, com *acesso vitalício*.

Quer que eu libere agora?`;

    const payload = {
      messaging_product: "whatsapp",
      to: normalizeForMeta(telefone),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: [
            { type: "reply", reply: { id: "presente_sim", title: "🎁 Sim, libera!" } },
            { type: "reply", reply: { id: "presente_consultor", title: "💬 Falar consultor" } },
            { type: "reply", reply: { id: "presente_depois", title: "⏰ Talvez depois" } },
          ],
        },
      },
    };

    const res = await fetch(`https://graph.facebook.com/v23.0/${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const meta = await res.json();
    if (!res.ok) {
      console.error("[responder-interesse] Meta error:", JSON.stringify(meta));
      throw new Error(meta?.error?.message || "Erro ao enviar mensagem");
    }

    // Marca auto_replied_em no registro mais recente de tipo='interesse'
    const { data: ultInt } = await supabase
      .from("retencao_respostas")
      .select("id")
      .eq("cliente_id", cliente_id)
      .eq("tipo", "interesse")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultInt) {
      await supabase.from("retencao_respostas").update({ auto_replied_em: new Date().toISOString() }).eq("id", ultInt.id);
    } else {
      // Backfill: cria registro sintético
      await supabase.from("retencao_respostas").insert({
        cliente_id,
        telefone: normalizeForMeta(telefone),
        tipo: "interesse",
        mensagem_recebida: "[backfill]",
        auto_replied_em: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[responder-interesse] error", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
