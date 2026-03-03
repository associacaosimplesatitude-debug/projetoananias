import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BLING_API_BASE = "https://www.bling.com.br/Api/v3";
const RATE_LIMIT_MS = 350;
const MAX_PAGES_PER_CALL = 3;
const MAX_EXECUTION_MS = 15000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getValidToken(supabase: any): Promise<string> {
  const { data: config, error } = await supabase
    .from("bling_config")
    .select("*")
    .single();
  if (error || !config) throw new Error("Configuração Bling não encontrada");

  const expiresAt = config.token_expires_at ? new Date(config.token_expires_at) : new Date(0);
  const now = new Date();

  if (config.access_token && expiresAt > now) {
    return config.access_token;
  }

  if (!config.refresh_token) throw new Error("Refresh token não disponível");
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  const tokenRes = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refresh_token,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || tokenData.error) throw new Error(tokenData.error_description || "Erro ao renovar token");

  const newExpiry = new Date();
  newExpiry.setSeconds(newExpiry.getSeconds() + (tokenData.expires_in || 21600));

  await supabase.from("bling_config").update({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: newExpiry.toISOString(),
  }).eq("id", config.id);

  return tokenData.access_token;
}

interface Contact {
  nome: string;
  telefone: string;
  email: string;
  tipo_documento: string;
  documento: string;
}

function normalizePhone(phone: string): string {
  return (phone || "").replace(/[\s\-\(\)\+]/g, "").replace(/^55/, "");
}

async function fetchContactDetails(accessToken: string, contactId: number): Promise<{ telefone: string; celular: string; email: string } | null> {
  const url = `${BLING_API_BASE}/contatos/${contactId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 429) return null; // will be retried
    console.error(`Erro ao buscar contato ${contactId}: ${res.status}`);
    return null;
  }
  const json = await res.json();
  const data = json.data;
  return {
    telefone: data?.telefone || "",
    celular: data?.celular || "",
    email: data?.email || "",
  };
}

async function searchOrdersPaginated(
  accessToken: string,
  loja_id: string | null,
  data_inicial: string,
  data_final: string,
  start_page: number,
  seen_phones: string[],
  start_contact_index: number = 0,
) {
  const startTime = Date.now();
  const seenPhones = new Set<string>(seen_phones);
  const contacts: Contact[] = [];
  let page = start_page;
  let pagesProcessed = 0;
  let done = false;
  let currentContactIndex = 0;

  console.log("Token usado:", accessToken.substring(0, 10) + "...");
  console.log(`Cursor inicial: page=${page}, contact_index=${start_contact_index}`);

  while (pagesProcessed < MAX_PAGES_PER_CALL) {
    if (Date.now() - startTime > MAX_EXECUTION_MS) {
      console.log(`Timeout defensivo atingido na página ${page}, contact_index=${currentContactIndex}`);
      return { contacts, next_page: page, next_contact_index: currentContactIndex, done: false, partial: true, seen_phones: Array.from(seenPhones) };
    }

    console.log("Buscando pedidos com parâmetros:", { loja_id, data_inicial, data_final, page });

    const params = new URLSearchParams({
      dataInicial: data_inicial,
      dataFinal: data_final,
      limite: "100",
      pagina: String(page),
    });
    if (loja_id) params.set("idLoja", loja_id);

    const url = `${BLING_API_BASE}/pedidos/vendas?${params}`;
    console.log(`Página ${page}: ${url}`);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      if (res.status === 429) {
        await sleep(2000);
        continue;
      }
      const errorBody = await res.text().catch(() => "");
      console.error("===== ERRO BLING =====");
      console.error("Status:", res.status);
      console.error("URL:", url);
      console.error("Resposta:", errorBody);
      console.error("======================");
      throw new Error(`Erro Bling ${res.status}: ${errorBody}`);
    }

    const json = await res.json();
    const pedidos = json.data || [];

    if (pedidos.length > 0 && page <= 2) {
      console.log("=== AMOSTRA PEDIDO (página " + page + ") ===");
      console.log(JSON.stringify(pedidos[0], null, 2));
      console.log("=== FIM AMOSTRA ===");
    }

    if (pedidos.length === 0) {
      done = true;
      break;
    }

    // Collect unique contact IDs from this page
    const contactIdsToFetch: { contactId: number; nome: string; tipoPessoa: string; numeroDocumento: string }[] = [];
    for (const pedido of pedidos) {
      const contato = pedido.contato;
      if (!contato || !contato.id) continue;
      contactIdsToFetch.push({
        contactId: contato.id,
        nome: contato.nome || "",
        tipoPessoa: contato.tipoPessoa || "F",
        numeroDocumento: contato.numeroDocumento || "",
      });
    }

    // Deduplicate contact IDs preserving order
    const uniqueContacts: typeof contactIdsToFetch = [];
    const seenContactIds = new Set<number>();
    for (const item of contactIdsToFetch) {
      if (!seenContactIds.has(item.contactId)) {
        seenContactIds.add(item.contactId);
        uniqueContacts.push(item);
      }
    }

    // Determine starting index (only applies to first page if resuming)
    const startIdx = (pagesProcessed === 0 && start_contact_index > 0) ? start_contact_index : 0;

    // Fetch contact details (with rate limiting), starting from cursor
    for (let i = startIdx; i < uniqueContacts.length; i++) {
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        currentContactIndex = i;
        console.log(`Timeout durante contatos: page=${page}, contact_index=${i}/${uniqueContacts.length}`);
        return { contacts, next_page: page, next_contact_index: currentContactIndex, done: false, partial: true, seen_phones: Array.from(seenPhones) };
      }

      const item = uniqueContacts[i];
      await sleep(RATE_LIMIT_MS);
      const details = await fetchContactDetails(accessToken, item.contactId);
      if (!details) continue;

      const telefone = details.celular || details.telefone || "";
      const normalizedPhone = normalizePhone(telefone);
      if (normalizedPhone && !seenPhones.has(normalizedPhone)) {
        seenPhones.add(normalizedPhone);
        contacts.push({
          nome: item.nome,
          telefone,
          email: details.email,
          tipo_documento: item.tipoPessoa === "J" ? "cnpj" : "cpf",
          documento: item.numeroDocumento,
        });
      }
    }

    if (pedidos.length < 100) {
      done = true;
      break;
    }

    page++;
    pagesProcessed++;
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`Contatos extraídos nesta chamada: ${contacts.length}`);

  return {
    contacts,
    next_page: done ? null : page + 1,
    next_contact_index: 0,
    done,
    partial: !done,
    seen_phones: Array.from(seenPhones),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    const accessToken = await getValidToken(supabase);

    // Action: list stores (kept for backwards compat)
    if (action === "listar_lojas") {
      return new Response(JSON.stringify({ lojas: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: search orders with pagination
    const { loja_id, data_inicial, data_final, start_page, seen_phones, start_contact_index } = body;
    if (!data_inicial || !data_final) {
      return new Response(JSON.stringify({ error: "data_inicial e data_final são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await searchOrdersPaginated(
      accessToken,
      loja_id,
      data_inicial,
      data_final,
      start_page || 1,
      seen_phones || [],
      start_contact_index || 0,
    );

    console.log(`Contatos nesta chamada: ${result.contacts.length}, done: ${result.done}, next_page: ${result.next_page}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
