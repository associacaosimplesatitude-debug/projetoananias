import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TRACKER_BASE_URL = "https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/whatsapp-link-tracker";
const PANEL_URL = "https://gestaoebd.lovable.app";

interface ClienteTracking {
  id: string;
  cliente_id: string;
  fase_atual: number;
  fase1_enviada_em: string | null;
  fase2_enviada_em: string | null;
  fase3a_enviada_em: string | null;
  fase3b_enviada_em: string | null;
  fase4a_enviada_em: string | null;
  fase4b_enviada_em: string | null;
  fase5_enviada_em: string | null;
  ultima_mensagem_em: string | null;
  concluido: boolean;
}

interface ClienteInfo {
  id: string;
  nome_igreja: string;
  nome_responsavel: string | null;
  email_superintendente: string | null;
  senha_temporaria: string | null;
  telefone: string | null;
  ultimo_login: string | null;
  onboarding_concluido: boolean | null;
  desconto_onboarding: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar credenciais Z-API
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["zapi_instance_id", "zapi_token", "zapi_client_token"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });

    const instanceId = settingsMap["zapi_instance_id"];
    const zapiToken = settingsMap["zapi_token"];
    const clientToken = settingsMap["zapi_client_token"];

    if (!instanceId || !zapiToken || !clientToken) {
      return new Response(
        JSON.stringify({ error: "Credenciais Z-API não configuradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar todos os trackings não concluídos
    const { data: trackings, error: trackingError } = await supabase
      .from("funil_posv_tracking")
      .select("*")
      .eq("concluido", false);

    if (trackingError) throw trackingError;
    if (!trackings || trackings.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum cliente pendente no funil", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clienteIds = trackings.map((t: ClienteTracking) => t.cliente_id);

    // Buscar dados dos clientes
    const { data: clientes } = await supabase
      .from("ebd_clientes")
      .select("id, nome_igreja, nome_responsavel, email_superintendente, senha_temporaria, telefone, ultimo_login, onboarding_concluido, desconto_onboarding")
      .in("id", clienteIds);

    const clienteMap: Record<string, ClienteInfo> = {};
    (clientes || []).forEach((c: ClienteInfo) => {
      clienteMap[c.id] = c;
    });

    // Verificar quais clientes têm escala criada
    const { data: escalas } = await supabase
      .from("ebd_escalas")
      .select("church_id")
      .in("church_id", clienteIds);

    const clientesComEscala = new Set((escalas || []).map((e: { church_id: string }) => e.church_id));

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    let processed = 0;
    const results: { cliente: string; action: string; success: boolean }[] = [];

    for (const tracking of trackings as ClienteTracking[]) {
      const cliente = clienteMap[tracking.cliente_id];
      if (!cliente || !cliente.telefone) continue;

      // Regra: nunca enviar duas mensagens no mesmo dia
      if (tracking.ultima_mensagem_em) {
        const lastMsgDate = tracking.ultima_mensagem_em.split("T")[0];
        if (lastMsgDate === today) continue;
      }

      const nome = cliente.nome_responsavel || cliente.nome_igreja;
      const email = cliente.email_superintendente || "";
      const senha = cliente.senha_temporaria || "";
      const desconto = cliente.desconto_onboarding || 30;
      const telefone = cliente.telefone;

      let mensagem: string | null = null;
      let faseUpdate: Record<string, unknown> = {};
      let novaFase = tracking.fase_atual;

      // === FASE 1 → FASE 2: 48h sem login ===
      if (tracking.fase_atual === 1 && tracking.fase1_enviada_em && !tracking.fase2_enviada_em) {
        const fase1Date = new Date(tracking.fase1_enviada_em);
        const hoursElapsed = (now.getTime() - fase1Date.getTime()) / (1000 * 60 * 60);
        
        if (hoursElapsed >= 48 && !cliente.ultimo_login) {
          const trackLink = `${TRACKER_BASE_URL}?c=${cliente.id}&f=2&r=/ebd/painel`;
          mensagem = `Olá ${nome}! Seu pedido já está sendo preparado.\n\nVocê sabia que pode acompanhar tudo em tempo real pelo painel? Ainda não vimos seu acesso.\n\nEntre agora com:\nEmail: ${email}\nSenha: ${senha}\n\n${trackLink}\n\nGanhe até ${desconto}% de desconto na próxima compra respondendo apenas 3 perguntas rápidas após o login!`;
          faseUpdate = { fase2_enviada_em: now.toISOString(), fase_atual: 2, ultima_mensagem_em: now.toISOString() };
          novaFase = 2;
        }
      }

      // === Detectar login → FASE 3A ===
      if ((tracking.fase_atual === 1 || tracking.fase_atual === 2) && cliente.ultimo_login && !tracking.fase3a_enviada_em) {
        const trackLink = `${TRACKER_BASE_URL}?c=${cliente.id}&f=3&r=/ebd/painel`;
        mensagem = `Parabéns ${nome}! Você acessou o painel com sucesso!\n\nAgora complete 3 perguntas rápidas e ganhe até ${desconto}% de desconto na sua próxima compra. Leva menos de 2 minutos!\n\n${trackLink}`;
        faseUpdate = { fase3a_enviada_em: now.toISOString(), fase_atual: 3, ultima_mensagem_em: now.toISOString() };
        novaFase = 3;
      }

      // === FASE 3A → 3B: 3 dias sem onboarding ===
      if (tracking.fase_atual === 3 && tracking.fase3a_enviada_em && !tracking.fase3b_enviada_em && !cliente.onboarding_concluido) {
        const fase3aDate = new Date(tracking.fase3a_enviada_em);
        const daysElapsed = (now.getTime() - fase3aDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysElapsed >= 3) {
          const trackLink = `${TRACKER_BASE_URL}?c=${cliente.id}&f=3&r=/ebd/painel`;
          mensagem = `${nome}, falta pouco para garantir seu desconto de até ${desconto}%!\n\nVocê só precisa responder 3 perguntinhas rápidas. Não perca essa oportunidade!\n\n${trackLink}`;
          faseUpdate = { fase3b_enviada_em: now.toISOString(), ultima_mensagem_em: now.toISOString() };
        }
      }

      // === Detectar onboarding concluído → FASE 4A ===
      if (tracking.fase_atual === 3 && cliente.onboarding_concluido && !tracking.fase4a_enviada_em) {
        const trackLink = `${TRACKER_BASE_URL}?c=${cliente.id}&f=4&r=/ebd/escala`;
        mensagem = `Fantástico ${nome}! Seu desconto de ${desconto}% já está garantido!\n\nAgora configure a escala de professores da sua EBD e tenha tudo organizado automaticamente. É rápido e fácil!\n\n${trackLink}`;
        faseUpdate = { fase4a_enviada_em: now.toISOString(), fase_atual: 4, ultima_mensagem_em: now.toISOString() };
        novaFase = 4;
      }

      // === FASE 4A → 4B: 5 dias sem escala ===
      if (tracking.fase_atual === 4 && tracking.fase4a_enviada_em && !tracking.fase4b_enviada_em && !clientesComEscala.has(tracking.cliente_id)) {
        const fase4aDate = new Date(tracking.fase4a_enviada_em);
        const daysElapsed = (now.getTime() - fase4aDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysElapsed >= 5) {
          const trackLink = `${TRACKER_BASE_URL}?c=${cliente.id}&f=4&r=/ebd/escala`;
          mensagem = `${nome}, você já garantiu seu desconto! Que tal dar o próximo passo?\n\nConfigure a escala da sua EBD e deixe tudo organizado para o trimestre. Seus professores vão agradecer!\n\n${trackLink}`;
          faseUpdate = { fase4b_enviada_em: now.toISOString(), ultima_mensagem_em: now.toISOString() };
        }
      }

      // === Detectar escala criada → FASE 5 ===
      if (tracking.fase_atual === 4 && clientesComEscala.has(tracking.cliente_id) && !tracking.fase5_enviada_em) {
        mensagem = `Parabéns ${nome}! Sua EBD está 100% configurada no sistema!\n\nAgora você pode acompanhar frequência, devocionais, ranking de alunos e muito mais. Tudo automático!\n\nSeu desconto de ${desconto}% está disponível para a próxima compra. Aproveite!\n\nhttps://gestaoebd.lovable.app/ebd/painel`;
        faseUpdate = { fase5_enviada_em: now.toISOString(), fase_atual: 5, concluido: true, ultima_mensagem_em: now.toISOString() };
        novaFase = 5;
      }

      // Enviar mensagem se houver
      if (mensagem) {
        const success = await sendWhatsAppMessage(
          instanceId, zapiToken, clientToken,
          telefone, mensagem, nome,
          `funil_fase${novaFase}`,
          supabase
        );

        if (success) {
          await supabase
            .from("funil_posv_tracking")
            .update(faseUpdate)
            .eq("id", tracking.id);
        }

        results.push({ cliente: nome, action: `fase_${novaFase}`, success });
        processed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no funil cron:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendWhatsAppMessage(
  instanceId: string,
  zapiToken: string,
  clientToken: string,
  telefone: string,
  mensagem: string,
  nome: string,
  tipoMensagem: string,
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  try {
    const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}`;
    const zapiEndpoint = `${baseUrl}/send-text`;
    const zapiPayload = { phone: telefone, message: mensagem };

    const zapiResponse = await fetch(zapiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(zapiPayload),
    });

    const zapiResult = await zapiResponse.json();
    const isSuccess = zapiResponse.ok;

    // Registrar na tabela de mensagens
    await supabase.from("whatsapp_mensagens").insert({
      tipo_mensagem: tipoMensagem,
      telefone_destino: telefone,
      nome_destino: nome,
      mensagem,
      status: isSuccess ? "enviado" : "erro",
      erro_detalhes: isSuccess ? null : JSON.stringify(zapiResult),
      payload_enviado: zapiPayload,
      resposta_recebida: zapiResult,
    });

    return isSuccess;
  } catch (error) {
    console.error(`Erro ao enviar WhatsApp para ${telefone}:`, error);
    return false;
  }
}
