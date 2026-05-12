// One-shot backfill: cria/atualiza ebd_leads_reativacao a partir de pedidos pagos
// já gravados em ebd_loja_pedidos_cg pela edge function receive-order-from-store-cg.
// Replica EXATAMENTE o mesmo bloco de upsert de lead daquela função (não importa nada).
//
// Auth: exige JWT válido E role admin/superadmin. Sem caminho service-role.
// Idempotente: rodar duas vezes seguidas não cria duplicatas.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOG = "[backfill-leads]";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isPaidStatus(s: string | null | undefined): boolean {
  if (!s) return false;
  const v = s.toLowerCase().trim();
  return v === "paid" || v === "pago";
}

function buildPhoneVariants(telefone: string | null): string[] {
  const phoneDigits = (telefone || "").replace(/\D/g, "");
  const phoneVariants: string[] = [];
  if (!phoneDigits) return phoneVariants;
  phoneVariants.push(phoneDigits, "+" + phoneDigits);
  if (phoneDigits.startsWith("55") && phoneDigits.length >= 12) {
    const local = phoneDigits.slice(2);
    phoneVariants.push(local, "+" + local);
    if (local.length === 11 && local[2] === "9") {
      const w = local.slice(0, 2) + local.slice(3);
      phoneVariants.push(w, "+" + w, "55" + w, "+55" + w);
    }
  }
  if (phoneDigits.startsWith("1") && phoneDigits.length === 11) {
    const local = phoneDigits.slice(1);
    phoneVariants.push(local, "+" + local);
  }
  if (phoneDigits.startsWith("351") && phoneDigits.length === 12) {
    const local = phoneDigits.slice(3);
    phoneVariants.push(local, "+" + local);
  }
  return phoneVariants;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ─── Auth: JWT do usuário admin/superadmin ───
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Não autorizado" }, 401);
    if (token === SERVICE_KEY) {
      return json({ error: "service_role_key não permitido como Bearer" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autorizado" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = ["admin", "superadmin"];
    if (!(roles || []).some((r: any) => allowed.includes(r.role))) {
      return json({ error: "Permissão negada (admin necessário)" }, 403);
    }

    // ─── Parâmetros ───
    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
    }
    const url = new URL(req.url);
    const qp = (k: string) => body?.[k] ?? url.searchParams.get(k);

    const days = Math.min(365, Math.max(1, Number(qp("days") ?? 60) || 60));
    const limit = Math.min(2000, Math.max(1, Number(qp("limit") ?? 500) || 500));
    const dryRun = String(qp("dryRun") ?? "false").toLowerCase() === "true" || qp("dryRun") === true;

    console.log(`${LOG} start days=${days} limit=${limit} dryRun=${dryRun} user=${userData.user.id}`);

    const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();

    // ─── Buscar pedidos pagos ───
    const { data: pedidos, error: pedErr } = await supabase
      .from("ebd_loja_pedidos_cg")
      .select("id, loja_order_number, customer_name, customer_email, customer_phone, customer_document, status_pagamento, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (pedErr) throw pedErr;

    const pedidosPagos = (pedidos || []).filter((p: any) => isPaidStatus(p.status_pagamento));
    console.log(`${LOG} pedidos brutos=${pedidos?.length ?? 0} pagos=${pedidosPagos.length}`);

    let leadsCriados = 0;
    let leadsAtualizados = 0;
    let pulados = 0;
    let erros = 0;
    const errosDetalhe: Array<{ pedido: string; motivo: string }> = [];

    for (const p of pedidosPagos) {
      try {
        // Mesmas variáveis nominais usadas no webhook original
        const telefone = (p.customer_phone || "").trim() || null;
        const email = (p.customer_email || "").trim().toLowerCase() || null;
        const nome = (p.customer_name || "").trim();
        const cpfDoc = (p.customer_document || "").replace(/\D/g, "") || "";

        if (!nome) {
          pulados++;
          continue;
        }

        // ─── Bloco IDÊNTICO ao receive-order-from-store-cg ───
        const phoneVariants = buildPhoneVariants(telefone);

        let existingLead: { id: string } | null = null;
        if (phoneVariants.length > 0) {
          const { data: byPhone } = await supabase
            .from("ebd_leads_reativacao")
            .select("id")
            .in("telefone", phoneVariants)
            .limit(1)
            .maybeSingle();
          if (byPhone) existingLead = byPhone as { id: string };
        }
        if (!existingLead && email) {
          const { data: byEmail } = await supabase
            .from("ebd_leads_reativacao")
            .select("id")
            .eq("email", email)
            .limit(1)
            .maybeSingle();
          if (byEmail) existingLead = byEmail as { id: string };
        }

        const docDigits = cpfDoc;
        const isCnpj = docDigits.length === 14;
        const cnpjValue = isCnpj ? cpfDoc : null;

        if (!existingLead) {
          if (dryRun) {
            leadsCriados++;
          } else {
            const { error: insErr } = await supabase.from("ebd_leads_reativacao").insert({
              nome_igreja: nome,
              email: email || null,
              telefone: telefone || null,
              cnpj: cnpjValue,
              tipo_lead: null,
              origem_lead: "E-commerce",
              created_via: "backfill-leads-from-orders",
              status_lead: "Não Contatado",
              status_kanban: "Cadastrou",
            });
            if (insErr) throw insErr;
            leadsCriados++;
          }
        } else {
          const { data: current } = await supabase
            .from("ebd_leads_reativacao")
            .select("email, telefone, cnpj")
            .eq("id", existingLead.id)
            .maybeSingle();

          const updates: Record<string, any> = {};
          if (current && !current.email && email) updates.email = email;
          if (current && !current.telefone && telefone) updates.telefone = telefone;
          if (current && !current.cnpj && cnpjValue) updates.cnpj = cnpjValue;

          if (Object.keys(updates).length > 0) {
            if (dryRun) {
              leadsAtualizados++;
            } else {
              const { error: updErr } = await supabase
                .from("ebd_leads_reativacao")
                .update(updates)
                .eq("id", existingLead.id);
              if (updErr) throw updErr;
              leadsAtualizados++;
            }
          } else {
            pulados++;
          }
        }
      } catch (e) {
        erros++;
        const motivo = (e as Error).message ?? String(e);
        errosDetalhe.push({ pedido: String(p.loja_order_number ?? p.id), motivo: motivo.slice(0, 300) });
        console.error(`${LOG} erro pedido ${p.loja_order_number}:`, motivo);
      }
    }

    const duracaoMs = Date.now() - t0;
    console.log(`${LOG} done criados=${leadsCriados} atualizados=${leadsAtualizados} pulados=${pulados} erros=${erros} ${duracaoMs}ms`);

    return json({
      ok: true,
      dryRun,
      rangeDays: days,
      totalPedidos: pedidosPagos.length,
      leadsCriados,
      leadsAtualizados,
      pulados,
      erros,
      errosDetalhe,
      duracaoMs,
    });
  } catch (err) {
    console.error(`${LOG} fatal:`, err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});
