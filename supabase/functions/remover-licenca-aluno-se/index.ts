import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOG = "[remover-licenca-aluno-se]";

interface Body {
  aluno_licenca_id: string;
  modo: "devolver" | "desativar";
}

function jsonResp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp(401, { error: "Não autorizado" });
    }
    const token = authHeader.replace("Bearer ", "");
    if (token === SERVICE_KEY) return jsonResp(401, { error: "Token inválido" });

    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResp(401, { error: "Não autorizado" });
    }
    const userId = userData.user.id;

    // Body
    let body: Body;
    try {
      body = await req.json();
    } catch {
      return jsonResp(400, { error: "JSON inválido" });
    }
    const aluno_licenca_id = (body.aluno_licenca_id || "").trim();
    const modo = body.modo;
    if (!aluno_licenca_id) return jsonResp(400, { error: "aluno_licenca_id obrigatório" });
    if (modo !== "devolver" && modo !== "desativar") {
      return jsonResp(400, { error: "modo inválido (devolver|desativar)" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Buscar aluno + ownership
    const { data: aluno, error: alunoErr } = await admin
      .from("revista_licenca_alunos")
      .select(
        `id, licenca_id, superintendente_id, aluno_telefone, aluno_email, aluno_nome,
         revista_licencas:revista_licencas!revista_licenca_alunos_licenca_id_fkey(revista_aluno_id, revista_id),
         ebd_clientes:ebd_clientes!revista_licenca_alunos_superintendente_id_fkey(superintendente_user_id)`
      )
      .eq("id", aluno_licenca_id)
      .maybeSingle();

    if (alunoErr) {
      console.error(LOG, "query aluno error", alunoErr);
      return jsonResp(500, { error: "Erro ao consultar aluno" });
    }
    if (!aluno) return jsonResp(404, { error: "Aluno não encontrado" });

    const cliente = (aluno as any).ebd_clientes;
    if (!cliente || cliente.superintendente_user_id !== userId) {
      console.warn(LOG, `ownership fail user=${userId} aluno=${aluno_licenca_id}`);
      return jsonResp(403, { error: "Você não tem permissão sobre este aluno" });
    }

    // 2. Buscar shopify license correspondente (chave SE-{aluno_licenca_id})
    const fakeOrderId = `SE-${aluno_licenca_id}`;
    const { data: shopRow } = await admin
      .from("revista_licencas_shopify")
      .select("id, primeiro_acesso_em, ativo")
      .eq("shopify_order_id", fakeOrderId)
      .maybeSingle();

    const jaAcessou = !!shopRow?.primeiro_acesso_em;

    // 3. Validar consistência
    if (modo === "devolver" && jaAcessou) {
      return jsonResp(409, {
        error: "Aluno já acessou a revista — use modo 'desativar'",
      });
    }

    // 4. Executar
    if (modo === "devolver") {
      // DELETE shopify primeiro (se existir), depois aluno (trigger decrementa pool)
      if (shopRow?.id) {
        const { error: delShopErr } = await admin
          .from("revista_licencas_shopify")
          .delete()
          .eq("id", shopRow.id);
        if (delShopErr) {
          console.error(LOG, "delete shopify failed", delShopErr);
          return jsonResp(500, {
            error: "Falha ao remover licença shopify",
            detail: delShopErr.message,
          });
        }
      }
      const { error: delAlunoErr } = await admin
        .from("revista_licenca_alunos")
        .delete()
        .eq("id", aluno_licenca_id);
      if (delAlunoErr) {
        console.error(LOG, "delete aluno failed", delAlunoErr);
        return jsonResp(500, {
          error: "Falha ao remover aluno (shopify já removido)",
          detail: delAlunoErr.message,
        });
      }
      console.log(LOG, `devolver OK aluno=${aluno_licenca_id}`);
      return jsonResp(200, { ok: true, modo, aluno_licenca_id });
    }

    // modo === "desativar"
    if (shopRow?.id) {
      const { error: updShopErr } = await admin
        .from("revista_licencas_shopify")
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq("id", shopRow.id);
      if (updShopErr) {
        console.error(LOG, "update shopify ativo=false failed", updShopErr);
        return jsonResp(500, {
          error: "Falha ao desativar licença shopify",
          detail: updShopErr.message,
        });
      }
    }
    const { error: updAlunoErr } = await admin
      .from("revista_licenca_alunos")
      .update({ status: "desativado", updated_at: new Date().toISOString() })
      .eq("id", aluno_licenca_id);
    if (updAlunoErr) {
      console.error(LOG, "update aluno status=desativado failed", updAlunoErr);
      return jsonResp(500, {
        error: "Falha ao marcar aluno como desativado",
        detail: updAlunoErr.message,
      });
    }
    console.log(LOG, `desativar OK aluno=${aluno_licenca_id}`);
    return jsonResp(200, { ok: true, modo, aluno_licenca_id });
  } catch (err: any) {
    console.error(LOG, "uncaught", err);
    return jsonResp(500, { error: err?.message || "Erro interno" });
  }
});
