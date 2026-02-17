import { createClient } from "npm:@supabase/supabase-js@2";

const PANEL_URL = "https://gestaoebd.com.br";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const clienteId = url.searchParams.get("c");
    const fase = url.searchParams.get("f");
    const redirect = url.searchParams.get("r") || "/confirmacao-whatsapp";

    if (!clienteId) {
      return new Response("Parâmetro inválido", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Registrar o clique no tracking
    const updateData: Record<string, unknown> = {};
    if (fase === "1") {
      updateData.fase1_link_clicado = true;
      updateData.fase1_link_clicado_em = new Date().toISOString();
    } else if (fase === "2") {
      updateData.fase2_link_clicado = true;
      updateData.fase2_link_clicado_em = new Date().toISOString();
    }

    // Para fase 1: verificar se já foi clicado antes (para enviar Mensagem 2 apenas na primeira vez)
    let shouldSendMsg2 = false;
    if (fase === "1") {
      const { data: trackingData } = await supabase
        .from("funil_posv_tracking")
        .select("fase1_link_clicado, email_acesso, senha_temp, cliente_id")
        .eq("cliente_id", clienteId)
        .single();

      if (trackingData && !trackingData.fase1_link_clicado) {
        shouldSendMsg2 = true;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from("funil_posv_tracking")
        .update(updateData)
        .eq("cliente_id", clienteId);
    }

    // Disparar Mensagem 2 (credenciais) automaticamente no primeiro clique da fase 1
    if (shouldSendMsg2) {
      try {
        // Buscar dados do cliente
        const { data: cliente } = await supabase
          .from("ebd_clientes")
          .select("nome_responsavel, nome_igreja, telefone, email_superintendente")
          .eq("id", clienteId)
          .single();

        // Buscar credenciais salvas no tracking
        const { data: tracking } = await supabase
          .from("funil_posv_tracking")
          .select("email_acesso, senha_temp")
          .eq("cliente_id", clienteId)
          .single();

        if (cliente && tracking?.email_acesso && tracking?.senha_temp) {
          const telefone = cliente.telefone;
          const nomeCliente = cliente.nome_responsavel || cliente.nome_igreja || "cliente";

          if (telefone) {
            // Buscar credenciais Z-API
            const { data: zapiSettings } = await supabase
              .from("system_settings")
              .select("key, value")
              .in("key", ["zapi_instance_id", "zapi_token", "zapi_client_token"]);

            const zapiMap: Record<string, string> = {};
            (zapiSettings || []).forEach((s: { key: string; value: string }) => {
              zapiMap[s.key] = s.value;
            });

            const instanceId = zapiMap["zapi_instance_id"];
            const zapiToken = zapiMap["zapi_token"];
            const clientToken = zapiMap["zapi_client_token"];

            if (instanceId && zapiToken && clientToken) {
              const msg2 = `Excelente! 🎉\n\nPara facilitar, criamos um painel exclusivo para você acompanhar sua entrega e já começar a organizar suas aulas.\n\nSeus dados de acesso:\n📧 E-mail: ${tracking.email_acesso}\n🔑 Senha: ${tracking.senha_temp}\n\nAcesse aqui: ${PANEL_URL}/login/ebd\n\nAlém do rastreio, você acaba de ganhar acesso ao sistema Gestão EBD para gerenciar suas turmas!`;

              const zapiBaseUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}`;
              const msg2Payload = {
                phone: telefone,
                message: msg2,
              };

              const zapiResp = await fetch(`${zapiBaseUrl}/send-text`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Client-Token": clientToken,
                },
                body: JSON.stringify(msg2Payload),
              });

              const zapiResult = await zapiResp.json();
              const whatsappOk = zapiResp.ok;

              // Registrar mensagem 2
              await supabase.from("whatsapp_mensagens").insert({
                tipo_mensagem: "funil_fase1_credenciais",
                telefone_destino: telefone,
                nome_destino: nomeCliente,
                mensagem: msg2,
                status: whatsappOk ? "enviado" : "erro",
                erro_detalhes: whatsappOk ? null : JSON.stringify(zapiResult),
                payload_enviado: msg2Payload,
                resposta_recebida: zapiResult,
              });

              console.log(`Mensagem 2 ${whatsappOk ? "enviada" : "falhou"} para ${telefone}`);
            }
          }
        }
      } catch (msg2Error) {
        console.error("Erro ao enviar Mensagem 2:", msg2Error);
      }
    }

    // Redirecionar para o painel
    const finalUrl = `${PANEL_URL}${redirect}`;
    return new Response(null, {
      status: 302,
      headers: { Location: finalUrl },
    });
  } catch (error) {
    console.error("Erro no link tracker:", error);
    return new Response(null, {
      status: 302,
      headers: { Location: PANEL_URL },
    });
  }
});
