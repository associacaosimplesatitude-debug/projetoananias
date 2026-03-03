import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLING_API_BASE = "https://www.bling.com.br/Api/v3";
const RATE_LIMIT_MS = 350;

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

  // Refresh token
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { loja_id, data_inicial, data_final } = await req.json();
    if (!data_inicial || !data_final) {
      return new Response(JSON.stringify({ error: "data_inicial e data_final são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getValidToken(supabase);
    const seenPhones = new Set<string>();
    const contacts: Contact[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        dataInicial: data_inicial,
        dataFinal: data_final,
        limite: "100",
        pagina: String(page),
      });
      if (loja_id) params.set("idLoja", String(loja_id));

      const url = `${BLING_API_BASE}/pedidos/vendas?${params}`;
      console.log(`Buscando página ${page}: ${url}`);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`Erro Bling API (${res.status}):`, errBody);
        if (res.status === 429) {
          // Rate limited, wait and retry
          await sleep(2000);
          continue;
        }
        throw new Error(`Erro na API do Bling: ${res.status}`);
      }

      const json = await res.json();
      const pedidos = json.data || [];

      if (pedidos.length === 0) {
        hasMore = false;
        break;
      }

      // Process each order's contact
      for (const pedido of pedidos) {
        const contato = pedido.contato;
        if (!contato) continue;

        let telefone = "";
        let nome = contato.nome || "";
        let email = "";
        let tipoDoc = "";
        let documento = "";

        // Extract document info
        if (contato.tipoPessoa === "J") {
          tipoDoc = "cnpj";
          documento = contato.numeroDocumento || "";
        } else {
          tipoDoc = "cpf";
          documento = contato.numeroDocumento || "";
        }

        // Try to get phone from contato
        if (contato.telefone) {
          telefone = contato.telefone;
        } else if (contato.celular) {
          telefone = contato.celular;
        }

        // Try to get email
        email = contato.email || "";

        // If no phone, fetch contact details
        if (!telefone && contato.id) {
          await sleep(RATE_LIMIT_MS);
          try {
            const contactRes = await fetch(`${BLING_API_BASE}/contatos/${contato.id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (contactRes.ok) {
              const contactData = await contactRes.json();
              const detail = contactData.data;
              if (detail) {
                telefone = detail.celular || detail.telefone || "";
                if (!email) email = detail.email || "";
                if (!nome) nome = detail.nome || "";
                if (!documento && detail.numeroDocumento) {
                  documento = detail.numeroDocumento;
                  tipoDoc = detail.tipoPessoa === "J" ? "cnpj" : "cpf";
                }
              }
            }
          } catch (e) {
            console.error(`Erro ao buscar contato ${contato.id}:`, e);
          }
        }

        // Deduplicate by phone
        const normalizedPhone = normalizePhone(telefone);
        if (normalizedPhone && !seenPhones.has(normalizedPhone)) {
          seenPhones.add(normalizedPhone);
          contacts.push({ nome, telefone, email, tipo_documento: tipoDoc, documento });
        }
      }

      // Check if there are more pages
      if (pedidos.length < 100) {
        hasMore = false;
      } else {
        page++;
        await sleep(RATE_LIMIT_MS);
      }
    }

    console.log(`Total de contatos únicos encontrados: ${contacts.length}`);

    return new Response(JSON.stringify({ contacts, total: contacts.length }), {
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
