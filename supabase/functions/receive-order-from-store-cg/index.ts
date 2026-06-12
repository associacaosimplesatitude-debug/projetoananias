import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "x-webhook-secret, content-type",
};

const LOG_PREFIX = "[receive-order-from-store-cg][superintendente]";
const PAINEL_URL = "https://gestaoebd.com.br/multi-licenca";
const LOGIN_URL = "https://gestaoebd.com.br/multi-licenca/login";

function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function sendWelcomeEmail(opts: {
  to: string;
  nome: string;
  qtd: number;
  revistaAlunoNome: string | null;
  revistaProfNome: string | null;
  isNewUser: boolean;
  isRecurring: boolean;
  password?: string;
  email: string;
}): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.warn(`${LOG_PREFIX} RESEND_API_KEY ausente — pulando email`);
    return;
  }

  const revistas = [opts.revistaAlunoNome, opts.revistaProfNome]
    .filter(Boolean)
    .join(" + ") || "revista digital";

  // Decide subject + saudação + corpo
  let subject: string;
  let saudacao: string;
  let introHtml: string;
  let credenciaisHtml = "";
  let extraHtml = "";

  if (opts.isNewUser) {
    subject = "Bem-vindo ao Plano Multi-Licença — Editora Central Gospel";
    saudacao = `Bem-vindo, <strong>${opts.nome}</strong>!`;
    introHtml = `
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">
        Sua compra foi confirmada e seu acesso ao painel Multi-Licença já está ativo.
      </p>`;
    credenciaisHtml = opts.password
      ? `
      <div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:16px 20px;margin:20px 0;border-radius:6px;">
        <h3 style="margin:0 0 12px;color:#92400e;font-size:16px;">Suas credenciais de acesso</h3>
        <p style="margin:6px 0;font-size:14px;"><strong>Email:</strong> ${opts.email}</p>
        <p style="margin:6px 0;font-size:14px;"><strong>Senha temporária:</strong> <code style="background:#fff;padding:4px 8px;border-radius:4px;font-family:monospace;">${opts.password}</code></p>
        <p style="margin:12px 0 0;font-size:13px;color:#92400e;">⚠️ Por segurança, altere esta senha após o primeiro acesso.</p>
      </div>`
      : "";
  } else if (opts.isRecurring && opts.password) {
    subject = "Novo pacote Multi-Licença confirmado — Editora Central Gospel";
    saudacao = `Olá novamente, <strong>${opts.nome}</strong>!`;
    introHtml = `
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">
        Você adicionou um novo pacote ao seu Plano Multi-Licença. Por segurança,
        sua senha foi atualizada. Suas credenciais de acesso são:
      </p>`;
    credenciaisHtml = `
      <div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:16px 20px;margin:20px 0;border-radius:6px;">
        <h3 style="margin:0 0 12px;color:#92400e;font-size:16px;">Suas credenciais de acesso</h3>
        <p style="margin:6px 0;font-size:14px;"><strong>Email:</strong> ${opts.email}</p>
        <p style="margin:6px 0;font-size:14px;"><strong>Nova senha:</strong> <code style="background:#fff;padding:4px 8px;border-radius:4px;font-family:monospace;">${opts.password}</code></p>
      </div>`;
    extraHtml = `
      <p style="font-size:14px;line-height:1.6;color:#52525b;margin:16px 0 0;">
        Não está confortável digitando esta senha? Acesse
        <a href="${LOGIN_URL}" style="color:#1e40af;">${LOGIN_URL}</a>
        e clique em <strong>"Esqueci minha senha"</strong> para definir uma nova.
      </p>`;
  } else {
    // Recorrente sem nova senha (caso de erro de update)
    subject = "Novo pacote Multi-Licença confirmado — Editora Central Gospel";
    saudacao = `Olá novamente, <strong>${opts.nome}</strong>!`;
    introHtml = `
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">
        Você adicionou um novo pacote. Use suas credenciais existentes para acessar.
        Caso não lembre da senha, use <strong>"Esqueci minha senha"</strong> na tela de login:
        <a href="${LOGIN_URL}" style="color:#1e40af;">${LOGIN_URL}</a>
      </p>`;
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#27272a;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%);padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;">Plano Multi-Licença</h1>
      <p style="color:#dbeafe;margin:8px 0 0;font-size:14px;">Editora Central Gospel</p>
    </div>
    <div style="padding:32px 24px;">
      <p style="font-size:16px;margin:0 0 16px;">${saudacao}</p>
      ${introHtml}

      <div style="background:#f0f9ff;border-left:4px solid #1e40af;padding:16px 20px;margin:20px 0;border-radius:6px;">
        <h3 style="margin:0 0 8px;color:#1e3a8a;font-size:16px;">Resumo do seu pacote</h3>
        <p style="margin:6px 0;font-size:14px;line-height:1.5;">
          Você adquiriu <strong>${opts.qtd} licença${opts.qtd > 1 ? "s" : ""}</strong> da
          <strong>${revistas}</strong>.
        </p>
        <p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#1e3a8a;">
          <strong>Acesso vitalício às licenças adquiridas</strong> — você e seus leitores terão acesso à revista ${revistas} para sempre, mesmo após o fim do trimestre.
        </p>
      </div>

      ${credenciaisHtml}

      <div style="text-align:center;margin:32px 0;">
        <a href="${PAINEL_URL}" style="display:inline-block;background:#1e40af;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">Acessar Painel</a>
      </div>

      ${extraHtml}

      <p style="font-size:14px;line-height:1.6;color:#52525b;margin:20px 0 0;">
        No painel você poderá distribuir as licenças aos seus leitores
        cadastrando nome, email e WhatsApp de cada um.
      </p>
    </div>
    <div style="background:#fafafa;padding:20px 24px;text-align:center;border-top:1px solid #e4e4e7;">
      <p style="margin:0;font-size:12px;color:#71717a;">
        © ${new Date().getFullYear()} Editora Central Gospel — Todos os direitos reservados
      </p>
      <p style="margin:6px 0 0;font-size:12px;color:#a1a1aa;">
        Este é um email automático, por favor não responda.
      </p>
    </div>
  </div>
</body>
</html>`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Editora Central Gospel <painel@painel.editoracentralgospel.com.br>",
      to: [opts.to],
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend HTTP ${resp.status}: ${body}`);
  }
  console.log(`${LOG_PREFIX} email enviado para ${opts.to} (recurring=${opts.isRecurring}, newUser=${opts.isNewUser})`);
}

async function provisionSuperintendente(
  supabase: ReturnType<typeof createClient>,
  payload: any,
  lojaOrderRowId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const items: any[] = Array.isArray(payload.items) ? payload.items : [];
    const seItems = items.filter(
      (it) => it?.via_superintendente === true && it?.is_digital === true,
    );

    if (seItems.length === 0) {
      console.log(`${LOG_PREFIX} pedido sem itens SE digitais — nao_aplicavel`);
      await supabase
        .from("ebd_loja_pedidos_cg")
        .update({ provisionamento_status: "nao_aplicavel" })
        .eq("id", lojaOrderRowId);
      return { ok: true };
    }

    const customer = payload.customer ?? {};
    const email = (customer.email ?? "").trim().toLowerCase();
    const nome = (customer.name ?? "").trim();
    const telefone = (customer.phone ?? "").replace(/\D/g, "");
    const cpfDoc = (customer.document ?? "").replace(/\D/g, "");

    if (!email) throw new Error("customer.email ausente no payload");
    if (!nome) throw new Error("customer.name ausente no payload");

    // Plan duration
    const inicioEm = new Date().toISOString().slice(0, 10);

    // ─── Find or create superintendente in ebd_clientes ───
    console.log(`${LOG_PREFIX} buscando ebd_cliente por email=${email}`);
    let { data: existingCliente } = await supabase
      .from("ebd_clientes")
      .select("id, superintendente_user_id, nome_igreja")
      .eq("email_superintendente", email)
      .maybeSingle();

    let userId: string | null = existingCliente?.superintendente_user_id ?? null;
    let clienteId: string | null = existingCliente?.id ?? null;
    let isNewUser = false;
    let tempPassword: string | undefined;

    // ─── Find or create auth user ───
    if (!userId) {
      // Look up auth user by email via listUsers pagination
      let foundUser: any = null;
      let page = 1;
      while (!foundUser) {
        const { data: usersPage, error } = await supabase.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (error) throw error;
        foundUser = usersPage?.users?.find(
          (u: any) => u.email?.toLowerCase() === email,
        );
        if (foundUser || !usersPage?.users?.length || usersPage.users.length < 1000) break;
        page++;
      }

      if (foundUser) {
        userId = foundUser.id;
        console.log(`${LOG_PREFIX} auth user já existe: ${userId}, gerando nova senha temporária para cliente recorrente`);

        tempPassword = generatePassword(12);
        isNewUser = false;

        const { error: updateErr } = await supabase.auth.admin.updateUserById(
          userId,
          { password: tempPassword },
        );

        if (updateErr) {
          console.error(`${LOG_PREFIX} falha ao resetar senha de cliente recorrente: ${updateErr.message}`);
          tempPassword = undefined;
        }
      } else {
        tempPassword = generatePassword(12);
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: nome },
        });
        if (createErr) throw new Error(`Erro ao criar auth.user: ${createErr.message}`);
        userId = newUser.user!.id;
        isNewUser = true;
        console.log(`${LOG_PREFIX} auth user criado: ${userId}`);

        // Profile (best-effort)
        await supabase.from("profiles").upsert(
          { id: userId, email, full_name: nome },
          { onConflict: "id" },
        );
      }
    }

    // ─── Upsert ebd_clientes ───
    const nowIso = new Date().toISOString();
    if (!clienteId) {
      const insertData: any = {
        nome_igreja: nome,
        nome_superintendente: nome,
        email_superintendente: email,
        superintendente_user_id: userId,
        status_ativacao_ebd: true,
        tipo_cliente: null, // pedidos da Nova Loja entram como indefinido para qualificação manual pelo vendedor
        senha_provisoria_enviada_em: tempPassword ? nowIso : null,
        deve_trocar_senha: !!tempPassword,
      };
      if (telefone) insertData.telefone = telefone;
      if (cpfDoc) insertData.cpf = cpfDoc;

      const { data: novoCliente, error: insErr } = await supabase
        .from("ebd_clientes")
        .insert(insertData)
        .select("id")
        .single();
      if (insErr) throw new Error(`Erro ao criar ebd_cliente: ${insErr.message}`);
      clienteId = novoCliente.id;
      console.log(`${LOG_PREFIX} ebd_cliente criado: ${clienteId}`);
    } else {
      const updateData: any = {
        status_ativacao_ebd: true,
        superintendente_user_id: userId,
      };
      if (tempPassword) {
        updateData.senha_provisoria_enviada_em = nowIso;
        updateData.deve_trocar_senha = true;
      }
      await supabase.from("ebd_clientes").update(updateData).eq("id", clienteId);
      console.log(`${LOG_PREFIX} ebd_cliente reaproveitado: ${clienteId}`);
    }

    // ─── Resolve SKUs → revista_aluno_id / revista_professor_id ───
    const skus = [...new Set(seItems.map((it) => String(it.sku ?? "")).filter(Boolean))];
    let mappingBySku: Record<string, { revista_digital_id: string | null; product_title: string | null }> = {};
    if (skus.length > 0) {
      const { data: mappings } = await supabase
        .from("ebd_produto_revista_mapping")
        .select("sku, revista_digital_id, product_title")
        .in("sku", skus);
      for (const m of mappings ?? []) {
        if (m.sku) mappingBySku[m.sku] = { revista_digital_id: m.revista_digital_id, product_title: m.product_title };
      }
    }

    // ─── Group items: aluno vs professor ───
    let revistaAlunoId: string | null = null;
    let revistaProfId: string | null = null;
    let qtdTotal = 0;
    let nomeAluno: string | null = null;
    let nomeProf: string | null = null;

    for (const it of seItems) {
      const qty = Number(it.quantity ?? 1) || 1;
      qtdTotal += qty;
      const map = mappingBySku[String(it.sku ?? "")];
      const matType = String(it.material_type ?? "aluno").toLowerCase();
      if (matType === "professor") {
        if (map?.revista_digital_id) revistaProfId = map.revista_digital_id;
        if (map?.product_title) nomeProf = map.product_title;
      } else {
        if (map?.revista_digital_id) revistaAlunoId = map.revista_digital_id;
        if (map?.product_title) nomeAluno = map.product_title;
      }
    }

    // ─── Resolve pacote_id (find or create) ───
    let pacoteId: string | null = null;
    const { data: planoExistente } = await supabase
      .from("revista_planos")
      .select("id")
      .eq("quantidade_licencas", qtdTotal)
      .eq("ativo", true)
      .maybeSingle();
    if (planoExistente) {
      pacoteId = planoExistente.id;
    } else {
      const { data: novoPlano, error: planoErr } = await supabase
        .from("revista_planos")
        .insert({
          nome: `Pacote ${qtdTotal} (vitalicio)`,
          quantidade_licencas: qtdTotal,
          preco_trimestral: 0,
          preco_semestral: 0,
          preco_anual: 0,
          ativo: true,
        })
        .select("id")
        .single();
      if (planoErr) console.warn(`${LOG_PREFIX} falha criando plano dinâmico: ${planoErr.message}`);
      else pacoteId = novoPlano.id;
    }

    // ─── Idempotent upsert into revista_licencas via loja_order_id ───
    const lojaOrderUuid = payload.order_id as string;
    const { data: existingLic } = await supabase
      .from("revista_licencas")
      .select("id, quantidade_total")
      .eq("loja_order_id", lojaOrderUuid)
      .maybeSingle();

    if (existingLic) {
      if (existingLic.quantidade_total !== qtdTotal) {
        await supabase
          .from("revista_licencas")
          .update({ quantidade_total: qtdTotal, updated_at: new Date().toISOString() })
          .eq("id", existingLic.id);
        console.log(`${LOG_PREFIX} licença existente atualizada (qtd ${existingLic.quantidade_total}→${qtdTotal})`);
      } else {
        console.log(`${LOG_PREFIX} licença já existente, idempotente — sem alterações`);
      }
    } else {
      const licInsert: any = {
        superintendente_id: clienteId,
        revista_aluno_id: revistaAlunoId,
        revista_professor_id: revistaProfId,
        pacote_id: pacoteId,
        plano: "vitalicio",
        quantidade_total: qtdTotal,
        quantidade_usada: 0,
        status: "ativa",
        inicio_em: inicioEm,
        expira_em: null,
        loja_order_id: lojaOrderUuid,
        origem: "nova_loja_cg",
      };
      const { error: licErr } = await supabase.from("revista_licencas").insert(licInsert);
      if (licErr) throw new Error(`Erro ao criar revista_licenca: ${licErr.message}`);
      console.log(`${LOG_PREFIX} licença criada — qtd=${qtdTotal} plano=vitalicio`);
    }

    // ─── Email de boas-vindas ───
    const isRecurring = !isNewUser && !!tempPassword;
    try {
      await sendWelcomeEmail({
        to: email,
        email,
        nome,
        qtd: qtdTotal,
        revistaAlunoNome: nomeAluno,
        revistaProfNome: nomeProf,
        isNewUser,
        isRecurring,
        password: tempPassword,
      });
    } catch (emailErr) {
      console.warn(`${LOG_PREFIX} falha enviando email (não bloqueia): ${(emailErr as Error).message}`);
    }

    // ─── WhatsApp template multi_licenca_pacote_confirmado ───
    try {
      const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);

      const map: Record<string, string> = {};
      (settings || []).forEach((s: any) => { map[s.key] = s.value; });

      const phoneNumberId = map["whatsapp_phone_number_id"];
      const accessToken = map["whatsapp_access_token"];
      const compradorPhone = (customer.phone ?? "").replace(/\D/g, "");

      if (phoneNumberId && accessToken && compradorPhone) {
        const metaPhone = compradorPhone.startsWith("55") ? compradorPhone : `55${compradorPhone}`;

        const tituloPacote = nomeAluno
          ? (nomeProf ? `${nomeAluno} + ${nomeProf}` : nomeAluno)
          : (nomeProf || "Revista Digital");

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
                name: "multi_licenca_pacote_confirmado",
                language: { code: "pt_BR" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: nome },                // {{1}} Nome
                      { type: "text", text: String(qtdTotal) },    // {{2}} Quantidade
                      { type: "text", text: tituloPacote },        // {{3}} Título
                      { type: "text", text: email },               // {{4}} Email
                    ],
                  },
                ],
              },
            }),
          },
        );

        const waData = await waRes.json();

        await supabase.from("whatsapp_mensagens").insert({
          tipo_mensagem: "multi_licenca_pacote_confirmado",
          telefone_destino: compradorPhone,
          nome_destino: nome,
          mensagem: `Template multi_licenca_pacote_confirmado enviado para ${nome}`,
          status: waRes.ok ? "enviado" : "erro",
          erro_detalhes: waRes.ok ? null : JSON.stringify(waData),
          payload_enviado: {
            loja_order_id: lojaOrderUuid,
            is_new_user: isNewUser,
            source: "receive-order-from-store-cg",
          },
          resposta_recebida: waData,
        });

        if (waRes.ok) {
          console.log(`${LOG_PREFIX} WhatsApp comprador enviado para ${compradorPhone}`);
        } else {
          console.warn(`${LOG_PREFIX} WhatsApp comprador falhou: ${JSON.stringify(waData)}`);
        }
      } else {
        console.warn(`${LOG_PREFIX} WhatsApp comprador pulado: credenciais ou telefone ausentes`);
      }
    } catch (waErr) {
      console.error(`${LOG_PREFIX} WhatsApp comprador exception:`, waErr);
    }

    // ─── Upsert ebd_leads_reativacao ───
    try {
      const phoneDigits = (telefone || "").replace(/\D/g, "");
      const phoneVariants: string[] = [];
      if (phoneDigits) {
        phoneVariants.push(phoneDigits, "+" + phoneDigits);
        // BR
        if (phoneDigits.startsWith("55") && phoneDigits.length >= 12) {
          const local = phoneDigits.slice(2);
          phoneVariants.push(local, "+" + local);
          if (local.length === 11 && local[2] === "9") {
            const w = local.slice(0, 2) + local.slice(3);
            phoneVariants.push(w, "+" + w, "55" + w, "+55" + w);
          }
        }
        // US/CA
        if (phoneDigits.startsWith("1") && phoneDigits.length === 11) {
          const local = phoneDigits.slice(1);
          phoneVariants.push(local, "+" + local);
        }
        // PT
        if (phoneDigits.startsWith("351") && phoneDigits.length === 12) {
          const local = phoneDigits.slice(3);
          phoneVariants.push(local, "+" + local);
        }
      }

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

      const docDigits = (cpfDoc || "").replace(/\D/g, "");
      const isCnpj = docDigits.length === 14;
      const cnpjValue = isCnpj ? cpfDoc : null;

      if (!existingLead) {
        await supabase.from("ebd_leads_reativacao").insert({
          nome_igreja: nome,
          email: email || null,
          telefone: telefone || null,
          cnpj: cnpjValue,
          tipo_lead: null,
          origem_lead: "E-commerce",
          created_via: "receive-order-from-store-cg",
          status_lead: "Não Contatado",
          status_kanban: "Cadastrou",
        });
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
          await supabase
            .from("ebd_leads_reativacao")
            .update(updates)
            .eq("id", existingLead.id);
        }
      }
    } catch (leadErr) {
      console.error(`${LOG_PREFIX} Erro ao upsertar lead:`, leadErr);
    }

    await supabase
      .from("ebd_loja_pedidos_cg")
      .update({
        provisionamento_status: "ok",
        provisionamento_erro: null,
        cliente_id: clienteId,
      })
      .eq("id", lojaOrderRowId);

    console.log(`${LOG_PREFIX} provisionamento concluído com sucesso`);
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message ?? "erro desconhecido";
    console.error(`${LOG_PREFIX} ERRO no provisionamento: ${msg}`, err);
    await supabase
      .from("ebd_loja_pedidos_cg")
      .update({
        provisionamento_status: "erro",
        provisionamento_erro: msg.slice(0, 1000),
      })
      .eq("id", lojaOrderRowId);
    return { ok: false, error: msg };
  }
}

// ============================================================
// Provisionamento de produtos DIGITAIS DIRETOS (ex.: infográficos)
// — Cria revista_licencas_shopify quando o pedido tem itens cujo SKU
//   mapeia para uma revistas_digitais com tipo_conteudo='infografico'.
// — Idempotente: respeita UNIQUE(shopify_order_id, whatsapp, revista_id).
// — Dispara WhatsApp (revista_acesso_liberado_v2) e email Resend por revista.
// — Só atualiza provisionamento_status='ok' se realmente criar licença
//   (não sobrescreve 'ok' nem 'erro' do fluxo superintendente).
// ============================================================
const LOG_DIGITAL = "[receive-order-from-store-cg][digital-direto]";

function normalizeBrPhone11(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits.slice(2);
  return digits;
}

async function persistOrderItems(
  supabase: ReturnType<typeof createClient>,
  payload: any,
  lojaOrderRowId: string,
): Promise<void> {
  try {
    const items: any[] = Array.isArray(payload.items) ? payload.items : [];
    if (items.length === 0) return;
    const rows = items.map((it) => ({
      pedido_id: lojaOrderRowId,
      shopify_line_item_id: it?.line_item_id ? String(it.line_item_id) : null,
      product_title: it?.product_title ?? it?.title ?? null,
      variant_title: it?.variant_title ?? null,
      sku: it?.sku ? String(it.sku) : null,
      quantity: Number(it?.quantity ?? 1) || 1,
      price: it?.price ?? null,
      total_discount: it?.total_discount ?? null,
    }));
    // Idempotência: deleta itens prévios deste pedido antes de inserir
    await supabase.from("ebd_shopify_pedidos_cg_itens").delete().eq("pedido_id", lojaOrderRowId);
    const { error } = await supabase.from("ebd_shopify_pedidos_cg_itens").insert(rows);
    if (error) console.warn(`${LOG_DIGITAL} falha gravando itens: ${error.message}`);
    else console.log(`${LOG_DIGITAL} ${rows.length} itens gravados`);
  } catch (e) {
    console.warn(`${LOG_DIGITAL} exception gravando itens:`, e);
  }
}

async function sendDigitalWhatsApp(
  supabase: ReturnType<typeof createClient>,
  phoneBr11: string,
  nome: string,
  tituloRevista: string,
  ctx: { loja_order_id: string; revista_id: string },
): Promise<void> {
  try {
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);
    const map: Record<string, string> = {};
    (settings || []).forEach((s: any) => { map[s.key] = s.value; });
    const phoneNumberId = map["whatsapp_phone_number_id"];
    const accessToken = map["whatsapp_access_token"];
    if (!phoneNumberId || !accessToken || !phoneBr11) {
      console.warn(`${LOG_DIGITAL} WhatsApp pulado (credenciais/telefone ausentes)`);
      return;
    }
    const metaPhone = `55${phoneBr11}`;
    const waRes = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
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
                  { type: "text", text: nome || "Leitor" },
                  { type: "text", text: tituloRevista },
                ],
              },
            ],
          },
        }),
      },
    );
    const waData = await waRes.json();
    await supabase.from("whatsapp_mensagens").insert({
      tipo_mensagem: "revista_acesso_liberado",
      telefone_destino: phoneBr11,
      nome_destino: nome,
      mensagem: `Template revista_acesso_liberado_v2 (digital direto) — ${tituloRevista}`,
      status: waRes.ok ? "enviado" : "erro",
      erro_detalhes: waRes.ok ? null : JSON.stringify(waData),
      payload_enviado: { ...ctx, source: "receive-order-from-store-cg:digital-direto" },
      resposta_recebida: waData,
    });
    if (!waRes.ok) console.warn(`${LOG_DIGITAL} WhatsApp falhou:`, JSON.stringify(waData));
  } catch (e) {
    console.error(`${LOG_DIGITAL} WhatsApp exception:`, e);
  }
}

async function sendDigitalEmail(
  email: string,
  nome: string,
  tituloRevista: string,
): Promise<void> {
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY || !email) return;
    const urlAcessoEmail = "https://gestaoebd.com.br/revista/acesso";
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Central Gospel <relatorios@painel.editoracentralgospel.com.br>",
        to: [email],
        subject: `Seu acesso ao ${tituloRevista} está liberado!`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1B3A5C">Olá, ${nome || "Leitor"}!</h2>
            <p style="font-size:16px">Seu acesso ao <strong>${tituloRevista}</strong> foi liberado com sucesso!</p>
            <p style="text-align:center;margin:24px 0">
              <a href="${urlAcessoEmail}" style="display:inline-block;padding:14px 32px;background:#1B3A5C;color:#fff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold">
                Acessar agora
              </a>
            </p>
            <p style="font-size:14px;color:#666">
              Você vai precisar do seu WhatsApp para entrar — enviaremos um código de confirmação.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
            <p style="font-size:13px;color:#999">Ou acesse: <a href="${urlAcessoEmail}" style="color:#1B3A5C">${urlAcessoEmail}</a></p>
          </div>
        `,
      }),
    });
    if (!resp.ok) console.warn(`${LOG_DIGITAL} Resend falhou:`, await resp.text());
  } catch (e) {
    console.error(`${LOG_DIGITAL} email exception:`, e);
  }
}

async function provisionDigitalDireto(
  supabase: ReturnType<typeof createClient>,
  payload: any,
  lojaOrderRowId: string,
): Promise<{ created: number; total_digital_items: number; error?: string }> {
  try {
    const items: any[] = Array.isArray(payload.items) ? payload.items : [];
    if (items.length === 0) return { created: 0, total_digital_items: 0 };

    const customer = payload.customer ?? {};
    const email = (customer.email ?? "").trim().toLowerCase() || null;
    const nome = (customer.name ?? "").trim() || "Leitor";
    const phoneBr11 = normalizeBrPhone11(customer.phone ?? "");
    const orderId = String(payload.order_id);
    const orderNumber = payload.order_number !== undefined && payload.order_number !== null
      ? String(payload.order_number)
      : null;

    if (!phoneBr11 && !email) {
      console.warn(`${LOG_DIGITAL} sem telefone nem email — pulando`);
      return { created: 0, total_digital_items: 0 };
    }

    const skus = [...new Set(items.map((it) => String(it?.sku ?? "")).filter(Boolean))];
    if (skus.length === 0) return { created: 0, total_digital_items: 0 };

    // SKU → revista_digital_id
    const { data: mappings } = await supabase
      .from("ebd_produto_revista_mapping")
      .select("sku, revista_digital_id")
      .in("sku", skus);

    const revistaIds = [...new Set((mappings ?? [])
      .map((m: any) => m.revista_digital_id)
      .filter(Boolean))];
    if (revistaIds.length === 0) return { created: 0, total_digital_items: 0 };

    // Filtrar SOMENTE infográficos (digital direto)
    const { data: revistas } = await supabase
      .from("revistas_digitais")
      .select("id, titulo, tipo_conteudo")
      .in("id", revistaIds);

    const infograficos = new Map<string, { titulo: string }>();
    for (const r of revistas ?? []) {
      if (r.tipo_conteudo === "infografico") {
        infograficos.set(r.id, { titulo: r.titulo ?? "Infográfico" });
      }
    }
    if (infograficos.size === 0) return { created: 0, total_digital_items: 0 };

    // Conjunto único (revista_id) a provisionar — qty>=1 já basta
    const revistasParaProvisionar = new Set<string>();
    for (const m of mappings ?? []) {
      if (m.revista_digital_id && infograficos.has(m.revista_digital_id)) {
        revistasParaProvisionar.add(m.revista_digital_id);
      }
    }

    let created = 0;
    const whatsappKey = phoneBr11 || (email ?? "");

    for (const revistaId of revistasParaProvisionar) {
      const titulo = infograficos.get(revistaId)!.titulo;

      // Idempotência: verifica se já existe licença para este pedido+revista (ou cliente+revista)
      const { data: jaExiste } = await supabase
        .from("revista_licencas_shopify")
        .select("id")
        .eq("revista_id", revistaId)
        .or(
          phoneBr11
            ? `whatsapp.eq.${phoneBr11}${email ? `,email.eq.${email}` : ""}`
            : `email.eq.${email}`,
        )
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (jaExiste) {
        console.log(`${LOG_DIGITAL} licença já existe para revista=${revistaId} — skip`);
        continue;
      }

      const { error: insErr } = await supabase
        .from("revista_licencas_shopify")
        .insert({
          revista_id: revistaId,
          shopify_order_id: orderId,
          shopify_order_number: orderNumber,
          nome_comprador: nome,
          whatsapp: whatsappKey,
          email,
          ativo: true,
          expira_em: null,
          origem: "nova_loja_cg:digital_direto",
        });

      if (insErr) {
        console.error(`${LOG_DIGITAL} erro insert licença revista=${revistaId}:`, insErr.message);
        continue;
      }

      created++;
      console.log(`${LOG_DIGITAL} licença criada revista=${revistaId} (${titulo})`);

      // Notificar (best-effort)
      if (phoneBr11) {
        await sendDigitalWhatsApp(supabase, phoneBr11, nome, titulo, {
          loja_order_id: orderId,
          revista_id: revistaId,
        });
      }
      if (email) {
        await sendDigitalEmail(email, nome, titulo);
      }
    }

    if (created > 0) {
      await supabase
        .from("ebd_loja_pedidos_cg")
        .update({ provisionamento_status: "ok", provisionamento_erro: null })
        .eq("id", lojaOrderRowId);
    }

    return { created, total_digital_items: revistasParaProvisionar.size };
  } catch (err) {
    const msg = (err as Error).message ?? "erro desconhecido";
    console.error(`${LOG_DIGITAL} ERRO:`, msg, err);
    return { created: 0, total_digital_items: 0, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const expectedSecretRaw = Deno.env.get("STORE_CG_WEBHOOK_SECRET");
    const providedSecretRaw = req.headers.get("x-webhook-secret");

    const expectedSecret = expectedSecretRaw?.trim() ?? "";
    const providedSecret = providedSecretRaw?.trim() ?? "";

    if (providedSecretRaw === null) {
      return new Response(
        JSON.stringify({ error: "missing x-webhook-secret header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "invalid webhook secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const {
      order_id,
      order_number,
      status,
      payment_status,
      payment_method,
      customer = {},
      totals = {},
      tracking_code,
      tracking_url,
      shipping_address = {},
      stripe_payment_id,
      mp_payment_id,
      order_date,
      paid_at,
    } = payload || {};

    if (!order_id || order_number === undefined || order_number === null) {
      return new Response(
        JSON.stringify({ error: "order_id and order_number are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const row = {
      loja_order_id: order_id,
      loja_order_number: order_number,
      status_pagamento: payment_status ?? "pending",
      status_pedido: status ?? "pending",
      payment_method: payment_method ?? null,
      customer_email: customer.email ?? null,
      customer_name: customer.name ?? null,
      customer_phone: customer.phone ?? null,
      customer_document: customer.document ?? null,
      valor_total: totals.total ?? 0,
      valor_subtotal: totals.subtotal ?? 0,
      valor_frete: totals.shipping ?? 0,
      valor_desconto: totals.discount ?? 0,
      codigo_rastreio: tracking_code ?? null,
      url_rastreio: tracking_url ?? null,
      endereco_rua: shipping_address.street ?? null,
      endereco_numero: shipping_address.number ?? null,
      endereco_complemento: shipping_address.complement ?? null,
      endereco_bairro: shipping_address.neighborhood ?? null,
      endereco_cidade: shipping_address.city ?? null,
      endereco_estado: shipping_address.state ?? null,
      endereco_cep: shipping_address.zip ?? null,
      endereco_nome: shipping_address.name ?? null,
      endereco_telefone: shipping_address.phone ?? null,
      stripe_payment_id: stripe_payment_id ?? null,
      mp_payment_id: mp_payment_id ?? null,
      order_date: order_date ?? null,
      paid_at: paid_at ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("ebd_loja_pedidos_cg")
      .upsert(row, { onConflict: "loja_order_id" })
      .select("id")
      .single();

    if (error) throw error;

    // ─── Persistir itens do pedido (idempotente) ───
    await persistOrderItems(supabase, payload, data.id);

    // ─── Provisionamento Superintendente (pacotes multi-licença) ───
    const provisionamentoResult = await provisionSuperintendente(supabase, payload, data.id);
    const provisionamentoOk = !provisionamentoResult || provisionamentoResult.ok !== false;

    // ─── Provisionamento Digital Direto (infográficos) ───
    // Roda independente do SE; pedido pode ter ambos.
    const digitalResult = await provisionDigitalDireto(supabase, payload, data.id);

    return new Response(
      JSON.stringify({
        ok: provisionamentoOk,
        loja_order_id: payload.order_id,
        provisionamento_status: provisionamentoOk ? "ok" : "erro",
        digital_direto: digitalResult,
        error: provisionamentoOk ? undefined : provisionamentoResult?.error,
      }),
      {
        status: provisionamentoOk ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("receive-order-from-store-cg error:", err, (err as Error)?.stack);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
