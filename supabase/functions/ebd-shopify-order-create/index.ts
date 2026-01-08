import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// LOJA CORRETA - kgg1pq-6r.myshopify.com
const SHOPIFY_STORE = "kgg1pq-6r.myshopify.com";
const SHOPIFY_API_VERSION = "2025-07";

interface Cliente {
  id: string;
  nome_igreja: string;
  cnpj: string | null;
  cpf: string | null;
  email_superintendente: string | null;
  telefone: string | null;
  nome_responsavel: string | null;
  endereco_cep: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  vendedor_id?: string | null;
  tipo_cliente?: string | null;
}

interface CartItem {
  variantId: string;
  quantity: number;
  title: string;
  price: string;
}

// Função para formatar CEP no padrão brasileiro
function formatCEP(cep: string | null): string {
  if (!cep) return "";
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length === 8) {
    return `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`;
  }
  return cleanCep;
}

// Mapeamento completo de estados brasileiros para código ISO
const ESTADOS_BRASIL: Record<string, string> = {
  'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amapá': 'AP', 'amazonas': 'AM',
  'bahia': 'BA', 'ceara': 'CE', 'ceará': 'CE', 'distrito federal': 'DF', 
  'espirito santo': 'ES', 'espírito santo': 'ES', 'goias': 'GO', 'goiás': 'GO',
  'maranhao': 'MA', 'maranhão': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', 'para': 'PA', 'pará': 'PA', 'paraiba': 'PB', 'paraíba': 'PB',
  'parana': 'PR', 'paraná': 'PR', 'pernambuco': 'PE', 'piaui': 'PI', 'piauí': 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  'rondonia': 'RO', 'rondônia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC',
  'sao paulo': 'SP', 'são paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO',
  // Abreviações comuns
  'ac': 'AC', 'al': 'AL', 'ap': 'AP', 'am': 'AM', 'ba': 'BA', 'ce': 'CE',
  'df': 'DF', 'es': 'ES', 'go': 'GO', 'ma': 'MA', 'mt': 'MT', 'ms': 'MS',
  'mg': 'MG', 'pa': 'PA', 'pb': 'PB', 'pr': 'PR', 'pe': 'PE', 'pi': 'PI',
  'rj': 'RJ', 'rn': 'RN', 'rs': 'RS', 'ro': 'RO', 'rr': 'RR', 'sc': 'SC',
  'sp': 'SP', 'se': 'SE', 'to': 'TO'
};

function normalizeUF(uf: string | null): string {
  if (!uf) return "";
  const clean = uf.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos
  
  // Buscar no mapa de estados
  const codigo = ESTADOS_BRASIL[clean];
  if (codigo) return codigo;
  
  // Fallback: se não encontrou e tem 2 chars, usa como está
  if (clean.length === 2) {
    return clean.toUpperCase();
  }
  
  // Último fallback: primeiros 2 caracteres em maiúsculo
  return clean.slice(0, 2).toUpperCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Token para loja kgg1pq-6r.myshopify.com
    const SHOPIFY_ACCESS_TOKEN = Deno.env.get("SHOPIFY_ADMIN_ACCESS_TOKEN");

    if (!SHOPIFY_ACCESS_TOKEN) {
      console.error("SHOPIFY_ACCESS_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Shopify not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Shopify store:", SHOPIFY_STORE, "API:", SHOPIFY_API_VERSION);

    // Get vendedor_id from request body or from authenticated user
    const { 
      cliente, 
      items, 
      vendedor_id,
      vendedor_nome,      // Vendor name for Bling
      faturamento_prazo,  // "30", "60", or "90" for B2B invoicing
      forma_pagamento,    // "FATURAMENTO" for B2B invoicing
      desconto_percentual, // Discount percentage for B2B clients
      valor_frete,        // Shipping cost
      metodo_frete,       // PAC, SEDEX, or FREE
      // Campos de frete manual
      frete_tipo,           // 'manual' ou 'automatico'
      frete_transportadora, // Nome da transportadora (apenas para frete manual)
      frete_prazo_estimado, // Prazo estimado (apenas para frete manual)
      frete_observacao,     // Observação interna sobre o frete manual
    } = await req.json() as { 
      cliente: Cliente; 
      items: CartItem[];
      vendedor_id?: string;
      vendedor_nome?: string;
      faturamento_prazo?: string;
      forma_pagamento?: string;
      desconto_percentual?: string;
      valor_frete?: string;
      metodo_frete?: string;
      frete_tipo?: string;
      frete_transportadora?: string;
      frete_prazo_estimado?: string;
      frete_observacao?: string;
    };

    if (!cliente || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Cliente e itens são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use vendedor_id from request or from cliente
    const finalVendedorId = vendedor_id || cliente.vendedor_id;
    const isFaturamento = forma_pagamento === 'FATURAMENTO' && faturamento_prazo;
    
    // Parse discount and shipping info
    const descontoPercentual = desconto_percentual ? parseFloat(desconto_percentual) : 0;
    const valorFreteRecebido = valor_frete ? parseFloat(valor_frete) : 0;
    const metodoFreteRecebido = metodo_frete || null;
    
    console.log("Creating draft order for cliente:", cliente.nome_igreja);
    console.log("Criando Draft Order com Vendedor ID:", finalVendedorId);
    console.log("Vendedor Nome:", vendedor_nome);
    console.log("Items:", items);
    console.log("Faturamento:", isFaturamento, "Prazo:", faturamento_prazo);
    console.log("Desconto:", descontoPercentual, "%");
    console.log("Frete:", metodoFreteRecebido, "Valor:", valorFreteRecebido);
    console.log("Frete Manual:", frete_tipo, "Transportadora:", frete_transportadora);

    // Step 1: Search for existing customer or create new one
    // IMPORTANT: Shopify pode validar o domínio do e-mail. Então usamos um domínio corporativo conhecido.
    const FALLBACK_EMAIL_DOMAIN = "editoracentralgospel.com";

    const isValidEmail = (email: string) => {
      const value = email.trim().toLowerCase();
      // Simple but strict enough for our needs
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
      const domain = value.split("@")[1] || "";
      if (domain.includes("..")) return false;
      return true;
    };

    // Prefer email do cliente. Se estiver vazio/inválido, tenta buscar no cadastro (ebd_clientes) e só então gera fallback.
    let customerEmail = (cliente.email_superintendente || "").trim().toLowerCase();

    const isUuid = (value: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    if (!customerEmail || !isValidEmail(customerEmail)) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const cnpjClean = cliente.cnpj ? cliente.cnpj.replace(/\D/g, "") : "";
        const canLookupById = !!cliente.id && isUuid(cliente.id);

        let lookupQuery = supabase
          .from("ebd_clientes")
          .select("email_superintendente")
          .limit(1);

        if (canLookupById) {
          lookupQuery = lookupQuery.eq("id", cliente.id);
        } else if (cnpjClean) {
          const cnpjRaw = (cliente.cnpj || "").trim();
          if (cnpjRaw && cnpjRaw !== cnpjClean) {
            // tenta tanto o CNPJ "limpo" quanto o formato com pontuação
            lookupQuery = lookupQuery.or(`cnpj.eq.${cnpjClean},cnpj.eq.${cnpjRaw}`);
          } else {
            lookupQuery = lookupQuery.eq("cnpj", cnpjClean);
          }
          lookupQuery = lookupQuery.eq("nome_igreja", cliente.nome_igreja);
        }

        const { data: clienteDb, error: clienteDbError } = await lookupQuery.maybeSingle();

        if (clienteDbError) {
          console.warn("Email lookup failed (ebd_clientes):", clienteDbError);
        }

        const dbEmail = (clienteDb?.email_superintendente || "").trim().toLowerCase();
        if (dbEmail && isValidEmail(dbEmail)) {
          customerEmail = dbEmail;
          console.log("Using email from cadastro:", customerEmail);
        }
      } catch (e) {
        console.warn("Email lookup exception:", e);
      }
    }

    if (!customerEmail || !isValidEmail(customerEmail)) {
      const timestamp = Date.now();
      const cnpjClean = cliente.cnpj ? cliente.cnpj.replace(/\D/g, "") : "";
      const base = (cnpjClean || cliente.nome_igreja || "cliente")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .substring(0, 20) || "cliente";

      customerEmail = `${base}.${timestamp}@${FALLBACK_EMAIL_DOMAIN}`;
    }

    console.log("Customer email:", customerEmail);

    // Search for customer by email
    const searchResponse = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/customers/search.json?query=email:${encodeURIComponent(customerEmail)}`,
      {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    let customerId: number | null = null;

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.customers && searchData.customers.length > 0) {
        customerId = searchData.customers[0].id;
        console.log("Found existing customer:", customerId);

        // Split name into first_name and last_name for better checkout pre-fill
        const fullName = cliente.nome_responsavel || cliente.nome_igreja || '';
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Update customer with latest info
        await fetch(
          `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}.json`,
          {
            method: "PUT",
            headers: {
              "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              customer: {
                first_name: firstName,
                last_name: lastName,
                phone: cliente.telefone,
                tags: "ebd_cliente",
                note: cliente.cnpj ? `CPF/CNPJ: ${cliente.cnpj}` : undefined,
                addresses: cliente.endereco_rua ? [{
                  address1: `${cliente.endereco_rua || ''}, ${cliente.endereco_numero || 'S/N'}`.trim(),
                  address2: cliente.endereco_complemento || cliente.endereco_bairro || '',
                  city: cliente.endereco_cidade || "",
                  province: cliente.endereco_estado || "",
                  province_code: normalizeUF(cliente.endereco_estado),
                  zip: formatCEP(cliente.endereco_cep),
                  country: "Brazil",
                  country_code: "BR",
                  company: cliente.nome_igreja,
                }] : undefined,
              },
            }),
          }
        );
      }
    }

    // Create customer if not found
    if (!customerId) {
      console.log("Creating new customer...");
      
      // Split name into first_name and last_name for better checkout pre-fill
      const fullName = cliente.nome_responsavel || cliente.nome_igreja || '';
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const createCustomerResponse = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/customers.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer: {
              email: customerEmail,
              first_name: firstName,
              last_name: lastName,
              phone: cliente.telefone,
              tags: "ebd_cliente",
              note: cliente.cnpj ? `CPF/CNPJ: ${cliente.cnpj}` : undefined,
               addresses: cliente.endereco_rua ? [{
                 address1: `${cliente.endereco_rua || ''}, ${cliente.endereco_numero || 'S/N'}`.trim(),
                 address2: cliente.endereco_complemento || cliente.endereco_bairro || '',
                 city: cliente.endereco_cidade || "",
                 province: cliente.endereco_estado || "",
                 province_code: normalizeUF(cliente.endereco_estado),
                 zip: formatCEP(cliente.endereco_cep),
                 country: "Brazil",
                 country_code: "BR",
                 company: cliente.nome_igreja,
               }] : undefined,
            },
          }),
        }
      );

      if (createCustomerResponse.ok) {
        const customerData = await createCustomerResponse.json();
        customerId = customerData.customer.id;
        console.log("Created new customer:", customerId);
      } else {
        const errorText = await createCustomerResponse.text();
        console.error("Failed to create customer:", errorText);
        // Continue without customer - will create order without customer association
      }
    }

    // Step 2: Create Draft Order
    // Convert GraphQL variant IDs to numeric IDs
    // Apply line-item discount if desconto_percentual is provided
    const lineItems = items.map(item => {
      // Extract numeric ID from GraphQL ID (gid://shopify/ProductVariant/123456)
      const variantIdMatch = item.variantId.match(/(\d+)$/);
      const numericVariantId = variantIdMatch ? parseInt(variantIdMatch[1]) : null;
      
      const lineItem: Record<string, unknown> = {
        variant_id: numericVariantId,
        quantity: item.quantity,
        title: item.title,
      };
      
      // Apply discount to line item if discount percentage is provided
      if (descontoPercentual > 0) {
        const originalPrice = parseFloat(item.price);
        const discountAmount = originalPrice * (descontoPercentual / 100);
        lineItem.applied_discount = {
          description: `Desconto B2B (${descontoPercentual}%)`,
          value_type: "fixed_amount",
          value: discountAmount.toFixed(2),
          amount: discountAmount.toFixed(2),
          title: `Desconto ${descontoPercentual}%`,
        };
      }
      
      return lineItem;
    }).filter(item => item.variant_id !== null);

    console.log("Creating draft order with line items:", lineItems);

    // Build note attributes for vendedor tracking
    const noteAttributes: Array<{ name: string; value: string }> = [];
    
    if (finalVendedorId) {
      noteAttributes.push({ name: "vendedor_id", value: finalVendedorId });
    }
    
    if (cliente.id) {
      noteAttributes.push({ name: "cliente_id", value: cliente.id });
    }

    if (isFaturamento) {
      noteAttributes.push({ name: "faturamento_prazo", value: faturamento_prazo! });
      noteAttributes.push({ name: "forma_pagamento", value: "FATURAMENTO" });
    }

    // Adicionar tipo_cliente aos note_attributes para rastreamento
    if (cliente.tipo_cliente) {
      noteAttributes.push({ name: "tipo_cliente", value: cliente.tipo_cliente });
    }

    // Adicionar CPF/CNPJ aos note_attributes para captura fácil na sincronização
    // Busca primeiro em cnpj, depois em cpf
    const documento = cliente.cnpj || cliente.cpf;
    if (documento) {
      noteAttributes.push({ name: "cpf_cnpj", value: documento });
      console.log("Adicionando CPF/CNPJ aos note_attributes:", documento);
    } else {
      console.log("AVISO: Cliente sem CPF/CNPJ:", cliente.id, cliente.nome_igreja);
    }

    // Build tags - Shopify has a 40 character limit per tag
    // Adicionar tag baseada no tipo_cliente para classificação
    const tipoClienteTag = cliente.tipo_cliente?.toUpperCase().replace(/[^A-Z]/g, '_') || '';
    let orderTags = isFaturamento ? "ebd_order,faturamento_b2b" : "ebd_order";
    
    // Adicionar tag de classificação baseada no tipo_cliente
    if (cliente.tipo_cliente) {
      const tipoUpper = cliente.tipo_cliente.toUpperCase();
      if (tipoUpper.includes('ADVEC')) {
        orderTags += ',tipo_advecs';
      } else if (tipoUpper.includes('IGREJA')) {
        orderTags += ',tipo_igreja';
      } else if (tipoUpper.includes('REVENDEDOR')) {
        orderTags += ',tipo_revendedor';
      } else if (tipoUpper.includes('LOJISTA')) {
        orderTags += ',tipo_lojista';
      } else if (tipoUpper.includes('REPRESENTANTE')) {
        orderTags += ',tipo_representante';
      } else if (tipoUpper.includes('PESSOA')) {
        orderTags += ',tipo_pessoa_fisica';
      }
    }

    // Build note with faturamento info
    let orderNote = `Pedido criado via EBD - Cliente: ${cliente.nome_igreja}`;
    if (finalVendedorId) {
      orderNote += ` | Vendedor: ${finalVendedorId}`;
    }
    if (isFaturamento) {
      orderNote += ` | FATURAMENTO ${faturamento_prazo} DIAS`;
    }

    // Build shipping line if frete is provided
    // Para frete manual, usar o nome da transportadora no título
    const isFreteManual = frete_tipo === 'manual' && frete_transportadora;
    let shippingTitle = 'Frete';
    if (isFreteManual) {
      shippingTitle = `Frete Manual - ${frete_transportadora}`;
    } else if (metodoFreteRecebido === 'sedex') {
      shippingTitle = 'SEDEX (Correios)';
    } else if (metodoFreteRecebido === 'pac') {
      shippingTitle = 'PAC (Correios)';
    }
    
    const shippingLine = valorFreteRecebido > 0 ? {
      title: shippingTitle,
      price: valorFreteRecebido.toFixed(2),
      custom: true,
    } : null;

    const draftOrderPayload: Record<string, unknown> = {
      draft_order: {
        line_items: lineItems,
        note: orderNote,
        tags: orderTags,
        note_attributes: noteAttributes,
        ...(customerId && { customer: { id: customerId } }),
        use_customer_default_address: !!customerId,
        ...(shippingLine && { shipping_line: shippingLine }),
      },
    };

    // Add shipping address if available
    if (cliente.endereco_rua) {
      // Priorizar nome_responsavel para first/last name
      // Se não houver, usar "Igreja" como first_name
      const shippingFullName = cliente.nome_responsavel || '';
      const shippingNameParts = shippingFullName.trim().split(' ');
      const shippingFirstName = shippingNameParts[0] || 'Igreja';
      const shippingLastName = shippingNameParts.slice(1).join(' ') || (cliente.nome_igreja || '');
      
      const formattedCep = formatCEP(cliente.endereco_cep);
      const uf = normalizeUF(cliente.endereco_estado);
      
      // Formato correto: address1 = "Rua, Número", address2 = "Complemento"
      const address1 = `${cliente.endereco_rua || ''}, ${cliente.endereco_numero || 'S/N'}`.trim();
      const address2 = cliente.endereco_complemento || '';
      
      console.log("=== VALIDAÇÃO DE ENDEREÇO SHOPIFY ===");
      console.log("address1:", address1);
      console.log("address2:", address2);
      console.log("city:", cliente.endereco_cidade);
      console.log("province (original):", cliente.endereco_estado, "-> province_code:", uf);
      console.log("zip (original):", cliente.endereco_cep, "-> formatted:", formattedCep);
      console.log("first_name:", shippingFirstName);
      console.log("last_name:", shippingLastName);
      console.log("company:", cliente.nome_igreja);
      
      draftOrderPayload.draft_order = {
        ...draftOrderPayload.draft_order as Record<string, unknown>,
        shipping_address: {
          first_name: shippingFirstName,
          last_name: shippingLastName,
          address1: address1,
          address2: address2,
          city: cliente.endereco_cidade || "",
          province: uf, // Usar código ISO ao invés do nome por extenso
          province_code: uf,
          zip: formattedCep,
          country: "Brazil",
          country_code: "BR",
          phone: cliente.telefone,
          company: cliente.nome_igreja,
        },
        billing_address: {
          first_name: shippingFirstName,
          last_name: shippingLastName,
          address1: address1,
          address2: address2,
          city: cliente.endereco_cidade || "",
          province: uf, // Usar código ISO ao invés do nome por extenso
          province_code: uf,
          zip: formattedCep,
          country: "Brazil",
          country_code: "BR",
          phone: cliente.telefone,
          company: cliente.nome_igreja,
        },
      };
    }

    // Add payment terms for B2B faturamento orders
    if (isFaturamento && faturamento_prazo) {
      const daysUntilDue = parseInt(faturamento_prazo);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + daysUntilDue);
      
      draftOrderPayload.draft_order = {
        ...draftOrderPayload.draft_order as Record<string, unknown>,
        // Shopify payment terms: NET_XX days
        payment_terms: {
          payment_terms_name: `Líquido ${daysUntilDue} dias`,
          payment_terms_type: "NET",
          due_in_days: daysUntilDue,
        },
      };
      
      console.log("Adding payment terms:", daysUntilDue, "days, due date:", dueDate.toISOString());
    }

    const draftOrderResponse = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/draft_orders.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draftOrderPayload),
      }
    );

    if (!draftOrderResponse.ok) {
      const errorText = await draftOrderResponse.text();
      console.error("Failed to create draft order:", errorText);

      const isUnavailable =
        errorText.toLowerCase().includes("no longer available") ||
        errorText.toLowerCase().includes("not available") ||
        errorText.toLowerCase().includes("out of stock");

      return new Response(
        JSON.stringify({
          error: isUnavailable
            ? "Um ou mais produtos do carrinho não estão mais disponíveis no Shopify. Remova o item e tente novamente."
            : "Falha ao criar pedido no Shopify",
          errorType: isUnavailable ? "PRODUCT_UNAVAILABLE" : "SHOPIFY_ERROR",
          details: errorText,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const draftOrderData = await draftOrderResponse.json();
    const draftOrder = draftOrderData.draft_order;

    console.log("Draft order created:", draftOrder.id);
    console.log("Draft order note_attributes:", draftOrder.note_attributes);

    // Step 3: For B2B faturamento, create order in Bling instead of returning checkout URL
    if (isFaturamento) {
      console.log("Faturamento B2B detected, creating order in Bling...");
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Format items for Bling - apply discount if provided
      const itensBling = items.map(item => {
        const precoOriginal = parseFloat(item.price);
        const precoComDesconto = descontoPercentual > 0 
          ? precoOriginal * (1 - descontoPercentual / 100) 
          : precoOriginal;
        
        return {
          descricao: item.title,
          unidade: 'UN',
          quantidade: item.quantity,
          valor: precoComDesconto,
          preco_cheio: precoOriginal,
        };
      });

      // Calculate totals with discount
      const valorProdutosSemDesconto = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
      const valorProdutos = descontoPercentual > 0 
        ? valorProdutosSemDesconto * (1 - descontoPercentual / 100)
        : valorProdutosSemDesconto;
      const valorTotal = valorProdutos + valorFreteRecebido;
      
      // Prepare cliente data for Bling - use nome_igreja (church name) instead of nome_responsavel
      const clienteBling = {
        nome: cliente.nome_igreja, // Changed to use church name
        cpf_cnpj: cliente.cnpj,
        email: cliente.email_superintendente,
        telefone: cliente.telefone,
      };
      
      // Prepare address for Bling
      const enderecoBling = cliente.endereco_rua ? {
        rua: cliente.endereco_rua,
        numero: cliente.endereco_numero || 'S/N',
        bairro: cliente.endereco_bairro || '',
        cep: cliente.endereco_cep || '',
        cidade: cliente.endereco_cidade || '',
        estado: cliente.endereco_estado || '',
      } : null;

      // Call bling-create-order function
      const { data: blingData, error: blingError } = await supabase.functions.invoke('bling-create-order', {
        body: {
          cliente: clienteBling,
          endereco_entrega: enderecoBling,
          itens: itensBling,
          pedido_id: draftOrder.id,
          valor_frete: valorFreteRecebido,
          metodo_frete: frete_tipo === 'manual' ? 'manual' : (metodoFreteRecebido || 'free'),
          forma_pagamento: 'FATURAMENTO',
          faturamento_prazo: faturamento_prazo,
          valor_produtos: valorProdutos,
          valor_total: valorTotal,
          vendedor_nome: vendedor_nome, // Pass vendor name to Bling
          desconto_percentual: descontoPercentual,
          // Campos de frete manual
          frete_tipo: frete_tipo || 'automatico',
          frete_transportadora: frete_transportadora || null,
          frete_observacao: frete_observacao || null,
        }
      });

      if (blingError || blingData?.error) {
        const errorMessage = blingData?.error || blingError?.message || "Erro desconhecido";
        console.error("Error creating Bling order:", errorMessage);
        return new Response(
          JSON.stringify({ 
            error: errorMessage, 
            errorType: blingData?.errorType || 'BLING_ERROR',
            draftOrderId: draftOrder.id,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Bling order created successfully:", blingData);

      // Save/order update in ebd_shopify_pedidos so the vendedor can see this faturado order
      try {
        const valorTotalNumber = valorTotal;
        const valorFreteNumber = valorFreteRecebido;
        const valorParaMeta = valorTotalNumber - valorFreteNumber;

        const orderData = {
          shopify_order_id: draftOrder.id as number,
          order_number: draftOrder.name as string,
          vendedor_id: finalVendedorId || null,
          cliente_id: cliente.id || null,
          status_pagamento: "Faturado",
          valor_total: valorTotalNumber,
          valor_frete: valorFreteNumber,
          valor_para_meta: valorParaMeta,
          customer_email: cliente.email_superintendente || null,
          customer_name: cliente.nome_igreja || null,
          codigo_rastreio: null,
          url_rastreio: null,
          updated_at: new Date().toISOString(),
        };

        console.log("Saving faturado B2B order in ebd_shopify_pedidos:", orderData);

        const { error: saveError } = await supabase
          .from("ebd_shopify_pedidos")
          .upsert(orderData, {
            onConflict: "shopify_order_id",
            ignoreDuplicates: false,
          });

        if (saveError) {
          console.error("Error saving faturado B2B order in ebd_shopify_pedidos:", saveError);
        }
      } catch (dbError) {
        console.error("Unexpected error while saving faturado B2B order:", dbError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          draftOrderId: draftOrder.id,
          orderName: draftOrder.name,
          vendedorId: finalVendedorId,
          isFaturamento: true,
          faturamentoPrazo: faturamento_prazo,
          blingOrderId: blingData.bling_order_id,
          blingOrderNumber: blingData.bling_order_number,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===================================================================
    // LINK DE PAGAMENTO DO DRAFT ORDER (com dados do cliente preenchidos)
    // ===================================================================
    // O invoice_url do Draft Order é o link oficial de pagamento da Shopify
    // que já vem com os dados do cliente (nome, endereço, email) preenchidos.
    // Este link é permanente e pode ser compartilhado.
    // ===================================================================
    
    // Get the invoice_url from the draft order - this is the payment link with customer data
    const invoiceUrl = draftOrder.invoice_url;
    
    console.log("Draft Order Invoice URL (com dados do cliente):", invoiceUrl);
    console.log("Draft Order ID:", draftOrder.id, "Name:", draftOrder.name);
    console.log("Criando Draft Order com Vendedor ID:", finalVendedorId);
    
    // Add channel=online_store to ensure checkout works without password
    let finalInvoiceUrl = invoiceUrl;
    if (invoiceUrl && !invoiceUrl.includes('channel=')) {
      const separator = invoiceUrl.includes('?') ? '&' : '?';
      finalInvoiceUrl = `${invoiceUrl}${separator}channel=online_store`;
    }
    
    console.log("Final Invoice URL:", finalInvoiceUrl);

    // ===================================================================
    // PERSISTÊNCIA INICIAL: Salvar pedido no banco com vendedor_id
    // Isso garante que o vendedor seja atribuído IMEDIATAMENTE ao criar o draft order,
    // antes mesmo do pagamento ser confirmado via webhook
    // ===================================================================
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Calculate totals
      const valorProdutos = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
      const valorDescontado = descontoPercentual > 0 
        ? valorProdutos * (1 - descontoPercentual / 100)
        : valorProdutos;
      const valorTotal = valorDescontado + valorFreteRecebido;
      const valorParaMeta = valorTotal - valorFreteRecebido;

      const orderData = {
        shopify_order_id: draftOrder.id as number,
        order_number: draftOrder.name as string,
        vendedor_id: finalVendedorId || null,
        cliente_id: cliente.id || null,
        status_pagamento: "Pendente", // Status inicial - será atualizado pelo webhook quando pago
        valor_total: valorTotal,
        valor_frete: valorFreteRecebido,
        valor_para_meta: valorParaMeta,
        customer_email: cliente.email_superintendente || null,
        customer_name: cliente.nome_igreja || null,
        customer_document: cliente.cnpj || cliente.cpf || null,
        codigo_rastreio: null,
        url_rastreio: null,
        updated_at: new Date().toISOString(),
      };

      console.log("Salvando pedido inicial (draft) com vendedor_id:", finalVendedorId);
      console.log("Dados do pedido:", orderData);

      const { error: saveError } = await supabase
        .from("ebd_shopify_pedidos")
        .upsert(orderData, {
          onConflict: "shopify_order_id",
          ignoreDuplicates: false,
        });

      if (saveError) {
        console.error("Erro ao salvar pedido inicial:", saveError);
      } else {
        console.log("Pedido inicial salvo com sucesso, vendedor_id:", finalVendedorId);
      }
    } catch (dbError) {
      console.error("Erro inesperado ao salvar pedido inicial:", dbError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        draftOrderId: draftOrder.id,
        invoiceUrl: finalInvoiceUrl,    // Link de pagamento com dados do cliente
        checkoutUrl: finalInvoiceUrl,   // Mesmo link para compatibilidade
        cartUrl: finalInvoiceUrl,       // Mesmo link para compatibilidade
        orderName: draftOrder.name,
        vendedorId: finalVendedorId,
        isFaturamento: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ebd-shopify-order-create:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});