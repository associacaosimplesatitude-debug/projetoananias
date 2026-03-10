import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(null, { status: 405, headers: corsHeaders });
  }

  try {
    const { token, event_type, event_data } = await req.json();

    if (!token || !event_type) {
      return new Response(
        JSON.stringify({ error: "token e event_type obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find the link by token
    const { data: link, error: linkError } = await supabase
      .from("campaign_links")
      .select("id, campaign_id")
      .eq("token", token)
      .single();

    if (linkError || !link) {
      return new Response(
        JSON.stringify({ error: "Token não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract IP and User-Agent
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;

    // Insert event
    await supabase.from("campaign_events").insert({
      link_id: link.id,
      campaign_id: link.campaign_id,
      event_type,
      event_data: event_data || null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // Update campaign counters
    if (link.campaign_id) {
      const counterMap: Record<string, string> = {
        page_viewed: "total_page_views",
        panel_accessed: "total_panel_accesses",
        purchase_completed: "total_purchases",
      };

      const column = counterMap[event_type];
      if (column) {
        // Fetch current value and increment
        const { data: campaign } = await supabase
          .from("whatsapp_campanhas")
          .select(column)
          .eq("id", link.campaign_id)
          .single();

        if (campaign) {
          const currentVal = (campaign as Record<string, number>)[column] || 0;
          await supabase
            .from("whatsapp_campanhas")
            .update({ [column]: currentVal + 1 })
            .eq("id", link.campaign_id);
        }
      }

      // Track revenue for purchases
      if (event_type === "purchase_completed" && event_data?.valor) {
        const { data: campaign } = await supabase
          .from("whatsapp_campanhas")
          .select("total_revenue")
          .eq("id", link.campaign_id)
          .single();

        if (campaign) {
          await supabase
            .from("whatsapp_campanhas")
            .update({ total_revenue: ((campaign as any).total_revenue || 0) + Number(event_data.valor) })
            .eq("id", link.campaign_id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no campaign-track-event:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
