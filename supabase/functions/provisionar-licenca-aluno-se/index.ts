import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOG = "[provisionar-licenca-aluno-se]";

interface Body {
  licenca_id: string;
  aluno_nome: string;
  aluno_email: string;
  aluno_whatsapp: string;
}

function jsonResp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Normaliza para 11 dígitos (DDD + número), sem +55.
 * Padrão do projeto (memória core).
 */
function normalizePhoneBR(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return null;
  let d = digits;
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length < 10 || d.length > 11) return null;
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp(401, { error: "Não autorizado" });
    }
    const token = authHeader.replace("Bearer ", "");

    // Política do projeto: nunca aceitar service role como Bearer
    if (token === SERVICE_KEY) {
      return jsonResp(401, { error: "Token inválido" });
    }

    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      console.warn(LOG, "auth fail", userErr?.message);
      return jsonResp(401, { error: "Não autorizado" });
    }
    const userId = userData.user.id;

    // 2. Body validation
    let body: Body;
    try {
      body = await req.json();
    } catch {
      return jsonResp(400, { error: "JSON inválido" });
    }

    const licenca_id = (body.licenca_id || "").trim();
    const aluno_nome = (body.aluno_nome || "").trim();
    const aluno_email = (body.aluno_email || "").toLowerCase().trim();
    const aluno_whatsapp_raw = (body.aluno_whatsapp || "").trim();

    if (!licenca_id || aluno_nome.length < 3) {
      return jsonResp(400, { error: "licenca_id e aluno_nome (>=3 chars) são obrigatórios" });
    }
    if (!aluno_email.includes("@")) {
      return jsonResp(400, { error: "aluno_email inválido" });
    }
    const aluno_telefone = normalizePhoneBR(aluno_whatsapp_raw);
    if (!aluno_telefone) {
      return jsonResp(400, { error: "aluno_whatsapp inválido (esperado DDD+número, 10 ou 11 dígitos)" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 3. Ownership: licenca pertence a este SE?
    const { data: licenca, error: licErr } = await admin
      .from("revista_licencas")
      .select(`
        id, superintendente_id, quantidade_total, quantidade_usada, status,
        revista_aluno_id, revista_id,
        ebd_clientes:ebd_clientes!revista_licencas_superintendente_id_fkey(id, superintendente_user_id, nome_igreja)
      `)
      .eq("id", licenca_id)
      .maybeSingle();

    if (licErr) {
      console.error(LOG, "licenca query error", licErr);
      return jsonResp(500, { error: "Erro ao consultar licença" });
    }
    if (!licenca) {
      return jsonResp(404, { error: "Licença não encontrada" });
    }

    const cliente = (licenca as any).ebd_clientes;
    if (!cliente || cliente.superintendente_user_id !== userId) {
      console.warn(LOG, `ownership fail user=${userId} licenca=${licenca_id}`);
      return jsonResp(403, { error: "Você não tem permissão sobre esta licença" });
    }

    if (licenca.status !== "ativa") {
      return jsonResp(409, { error: `Licença não está ativa (status=${licenca.status})` });
    }

    // 4. Pool
    if (licenca.quantidade_usada >= licenca.quantidade_total) {
      return jsonResp(409, { error: "Pool esgotado: todas as licenças já foram distribuídas" });
    }

    // 5. Duplicidade no mesmo pacote
    const { data: dups, error: dupErr } = await admin
      .from("revista_licenca_alunos")
      .select("id, aluno_email, aluno_telefone")
      .eq("licenca_id", licenca_id)
      .or(`aluno_email.eq.${aluno_email},aluno_telefone.eq.${aluno_telefone}`);

    if (dupErr) {
      console.error(LOG, "dup query error", dupErr);
      return jsonResp(500, { error: "Erro ao verificar duplicidade" });
    }
    if (dups && dups.length > 0) {
      return jsonResp(409, { error: "Aluno já cadastrado neste pacote" });
    }

    // 6. INSERT revista_licenca_alunos (trigger incrementa pool)
    const superintendenteId = licenca.superintendente_id;
    const revistaIdParaAluno = licenca.revista_aluno_id || licenca.revista_id;

    const { data: alunoRow, error: insAlunoErr } = await admin
      .from("revista_licenca_alunos")
      .insert({
        licenca_id,
        superintendente_id: superintendenteId,
        aluno_nome,
        aluno_email,
        aluno_telefone,
        tipo_revista: "aluno",
        status: "pendente",
      })
      .select("id")
      .single();

    if (insAlunoErr || !alunoRow) {
      console.error(LOG, "insert revista_licenca_alunos failed", insAlunoErr);
      return jsonResp(500, { error: "Falha ao cadastrar aluno", detail: insAlunoErr?.message });
    }
    const licencaAlunoId = alunoRow.id;
    console.log(LOG, `aluno criado id=${licencaAlunoId} licenca=${licenca_id}`);

    // 7. INSERT revista_licencas_shopify (Modelo A — chave para o leitor)
    const fakeOrderId = `SE-${licencaAlunoId}`;
    const { error: insShopErr } = await admin
      .from("revista_licencas_shopify")
      .insert({
        revista_id: revistaIdParaAluno,
        shopify_order_id: fakeOrderId,
        shopify_order_number: fakeOrderId,
        nome_comprador: aluno_nome,
        whatsapp: aluno_telefone,
        email: aluno_email,
        ativo: true,
        expira_em: null, // vitalício, alinhado com Plano Superintendente
      });

    if (insShopErr) {
      console.error(LOG, "insert revista_licencas_shopify failed, rolling back aluno", insShopErr);
      // Compensação: remover aluno (trigger decrementa pool)
      await admin.from("revista_licenca_alunos").delete().eq("id", licencaAlunoId);
      return jsonResp(500, {
        error: "Falha ao registrar acesso da licença",
        detail: insShopErr.message,
      });
    }

    // 8. Buscar título da revista para comunicação
    let tituloRevista = "Revista Digital";
    if (revistaIdParaAluno) {
      const { data: rev } = await admin
        .from("revistas_digitais")
        .select("titulo")
        .eq("id", revistaIdParaAluno)
        .maybeSingle();
      if (rev?.titulo) tituloRevista = rev.titulo;
    }

    // 9. Comunicação — falhas NÃO revertem inserts
    let whatsapp_enviado = false;
    let email_enviado = false;

    // 9a. WhatsApp template revista_acesso_liberado_v2 (Meta)
    try {
      const { data: settings } = await admin
        .from("system_settings")
        .select("key, value")
        .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);

      const map: Record<string, string> = {};
      (settings || []).forEach((s: any) => { map[s.key] = s.value; });

      const phoneNumberId = map["whatsapp_phone_number_id"];
      const accessToken = map["whatsapp_access_token"];

      if (phoneNumberId && accessToken) {
        const metaPhone = aluno_telefone.startsWith("55")
          ? aluno_telefone
          : `55${aluno_telefone}`;

        const waRes = await fetch(
          `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: metaPhone,
              type: "template",
              template: {
                name: "revista_acesso_liberado_v2",
                language: { code: "pt_BR" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: aluno_nome },
                      { type: "text", text: tituloRevista },
                    ],
                  },
                ],
              },
            }),
          }
        );

        const waData = await waRes.json();
        whatsapp_enviado = waRes.ok;

        await admin.from("whatsapp_mensagens").insert({
          tipo_mensagem: "revista_acesso_liberado",
          telefone_destino: aluno_telefone,
          nome_destino: aluno_nome,
          mensagem: `Template revista_acesso_liberado_v2 enviado para ${aluno_nome} - ${tituloRevista}`,
          status: whatsapp_enviado ? "enviado" : "erro",
          erro_detalhes: whatsapp_enviado ? null : JSON.stringify(waData),
          payload_enviado: {
            licenca_aluno_id: licencaAlunoId,
            sku: null,
            source: "portal_superintendente",
            revista: tituloRevista,
          },
          resposta_recebida: waData,
        });

        if (!whatsapp_enviado) {
          console.warn(LOG, "WhatsApp Meta error", JSON.stringify(waData));
        } else {
          console.log(LOG, `WhatsApp enviado para ${aluno_telefone}`);
        }
      } else {
        console.warn(LOG, "credenciais Meta WhatsApp ausentes em system_settings");
      }
    } catch (waErr) {
      console.error(LOG, "WhatsApp dispatch exception", waErr);
    }

    // 9b. Email Resend
    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey && aluno_email) {
        const urlAcessoEmail = "https://gestaoebd.com.br/revista/acesso";
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Central Gospel <relatorios@painel.editoracentralgospel.com.br>",
            to: [aluno_email],
            subject: `Sua ${tituloRevista} está pronta!`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
                <h2 style="color:#1B3A5C">Olá, ${aluno_nome}!</h2>
                <p style="font-size:16px">Sua <strong>${tituloRevista}</strong> foi liberada com sucesso!</p>
                <p style="font-size:16px">Para acessar, clique no botão abaixo:</p>
                <p style="text-align:center;margin:24px 0">
                  <a href="${urlAcessoEmail}" style="display:inline-block;padding:14px 32px;background:#1B3A5C;color:#fff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold">
                    Acessar minha revista
                  </a>
                </p>
                <p style="font-size:14px;color:#666">
                  Você vai precisar do seu número de WhatsApp para entrar.<br>
                  Enviaremos um código de 4 números para confirmar sua identidade.
                </p>
                <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:13px;color:#999">
                  Ou acesse diretamente:<br>
                  <a href="${urlAcessoEmail}" style="color:#1B3A5C">${urlAcessoEmail}</a>
                </p>
                <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
                <p style="font-size:12px;color:#999">Liberado por: ${cliente.nome_igreja || "Superintendente"}</p>
              </div>
            `,
          }),
        });
        const emailData = await emailRes.json();
        email_enviado = emailRes.ok;
        if (!email_enviado) {
          console.warn(LOG, "Resend error", JSON.stringify(emailData));
        } else {
          console.log(LOG, `Email enviado para ${aluno_email}`);
        }
      } else if (!resendApiKey) {
        console.warn(LOG, "RESEND_API_KEY ausente");
      }
    } catch (emailErr) {
      console.error(LOG, "Email dispatch exception", emailErr);
    }

    return jsonResp(200, {
      ok: true,
      licenca_aluno_id: licencaAlunoId,
      whatsapp_enviado,
      email_enviado,
    });
  } catch (err: any) {
    console.error(LOG, "uncaught", err);
    return jsonResp(500, { error: err?.message || "Erro interno" });
  }
});
