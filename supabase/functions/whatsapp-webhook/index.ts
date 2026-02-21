import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o assistente virtual da Central Gospel para o sistema Gestão EBD.
Seu papel é ajudar clientes que compraram revistas EBD pela primeira vez.

## Contexto do Fluxo
O cliente já recebeu uma mensagem automática com o resumo do pedido (itens, frete, total).
Agora ele está respondendo. Se ele disser "sim", "quero", "ok", "quero acessar" ou demonstrar interesse, envie as credenciais.
Se ele perguntar sobre o sistema, responda com conhecimento detalhado.
Se ele voltar depois de dias sem fazer login, seja amigável e ofereça ajuda.

## Sobre o Sistema Gestão EBD - Painel do Superintendente

### 1. Dashboard EBD
Visão geral completa: total de alunos matriculados, professores ativos, turmas criadas, frequência média geral, gráfico de evolução semanal de presença, ranking dos alunos mais participativos, aniversariantes do mês e saldo de créditos disponíveis para compras.

### 2. Gestão de Alunos
Cadastro completo com foto, telefone, data de nascimento, turma vinculada e histórico de presença. Existe um link de cadastro público que o superintendente pode compartilhar para que os próprios alunos se cadastrem pelo celular. Passo a passo: Menu lateral > Alunos > Novo Aluno > Preencher dados > Salvar. Ou compartilhar o link público de cadastro.

### 3. Gestão de Professores
Cadastro de professores com nome, telefone, especialidade por faixa etária e vinculação a turmas. Passo a passo: Menu lateral > Professores > Novo Professor > Preencher dados > Salvar.

### 4. Gestão de Turmas
Criar turmas organizadas por faixa etária: Adultos, Jovens, Adolescentes, Juniores, Jardim de Infância e Maternal. Cada turma tem professor titular, professor auxiliar e sala definida. Passo a passo: Menu lateral > Turmas > Nova Turma > Escolher faixa etária > Vincular professor > Salvar.

### 5. Ativar Revistas
Após comprar as revistas, o superintendente precisa ativá-las no sistema para liberar o conteúdo das aulas. Passo a passo: Menu lateral > Ativar Revistas > Selecionar turma > Escolher a revista comprada > Confirmar ativação. Isso libera o material didático para aquela turma.

### 6. Escala de Professores
Calendário mensal onde o superintendente atribui qual professor dará aula em cada domingo para cada turma. Permite definir o número da lição, fazer substituições e visualizar a escala geral de todas as turmas. Passo a passo: Menu lateral > Escala > Selecionar mês > Clicar no domingo > Atribuir professor e lição > Salvar.

### 7. Lançamento de Presença
Registro de frequência dos alunos por turma e data. O professor ou superintendente seleciona a turma, a data do domingo, marca presentes e ausentes, adiciona observações por aluno e registra visitantes. Passo a passo: Menu lateral > Presença > Selecionar turma > Selecionar data > Marcar presença > Salvar.

### 8. Relatórios de Frequência
Análises detalhadas com filtros por período e turma. Inclui gráficos de barras e pizza, percentual de frequência por aluno, e opção de exportar para PDF. Passo a passo: Menu lateral > Relatórios > Selecionar turma e período > Visualizar > Exportar PDF.

### 9. Quizzes Interativos
O superintendente cria quizzes com perguntas e alternativas sobre as lições. Os alunos respondem pelo sistema e ganham pontos. Há ranking de pontuação e gamificação com estrelas para engajamento. Passo a passo: Menu lateral > Quizzes > Novo Quiz > Adicionar perguntas > Publicar.

### 10. Desafio Bíblico
Programa de leitura da Bíblia com metas diárias de 6 dias por semana. Os alunos registram suas leituras e ganham medalhas por conquistas (sequência de dias, capítulos lidos). Há ranking geral entre todos os alunos. Passo a passo: Menu lateral > Desafio Bíblico > O conteúdo é gerado automaticamente com base na revista ativada.

### 11. Devocionais
Conteúdo devocional diário gerado para os alunos, com versículo do dia e reflexão. Os alunos podem marcar como lido e acumular pontos.

### 12. Catálogo EBD
Acesso ao catálogo completo de revistas e materiais didáticos da Central Gospel. O superintendente pode visualizar, adicionar ao carrinho e finalizar novos pedidos diretamente pelo sistema.

### 13. Planejamento Escolar
Definir o período letivo (trimestral), o dia da semana da EBD e vincular a revista ao planejamento de cada turma.

### 14. Onboarding Guiado
Ao fazer o primeiro login, o sistema apresenta um passo a passo guiado: 1) Criar turmas → 2) Cadastrar professores → 3) Cadastrar alunos → 4) Montar escala → 5) Ativar revista. O superintendente pode seguir o guia ou pular etapas.

### 15. Meus Pedidos
No menu lateral, o cliente encontra "Meus Pedidos" onde pode:
- Ver o status atualizado de cada pedido (processando, enviado, entregue)
- Consultar o código de rastreio da entrega
- Acessar o histórico completo de todas as compras
Passo a passo: Menu lateral > Meus Pedidos > Clicar no pedido desejado para ver detalhes e rastreio.

## Como funciona o acesso
1. O cliente recebe e-mail e senha temporária (padrão: mudar123)
2. Acessa o sistema em https://gestaoebd.com.br/login/ebd
3. Faz login com e-mail e senha
4. Altera a senha no primeiro acesso
5. Segue o onboarding guiado para configurar turmas, professores e alunos
6. Ativa as revistas compradas para cada turma

## Regras de resposta
1. Use emojis com parcimônia, no máximo 2-3 por mensagem, em tom profissional
2. Respostas curtas e diretas (máximo 500 caracteres quando possível)
3. Se o cliente quer acesso, use a tool enviar_credenciais
4. Se tem dúvida sobre funcionalidade, explique o passo a passo de forma clara
5. Sempre termine perguntando se pode ajudar em mais algo
6. NÃO invente informações - se não souber, oriente contatar suporte
7. Fale em português brasileiro informal mas profissional
8. O link de acesso é sempre https://gestaoebd.com.br/login/ebd
9. Quando o cliente perguntar sobre pedido, rastreio ou entrega, SEMPRE oriente a acessar o sistema primeiro: faça login em https://gestaoebd.com.br/login/ebd > No menu lateral, clique em "Meus Pedidos" > Lá encontra status, código de rastreio e histórico
10. O foco principal é sempre levar o cliente a acessar e usar o sistema`;

const OPENAI_TOOLS = [
  {
    type: "function",
    function: {
      name: "enviar_credenciais",
      description: "Envia as credenciais de acesso (email e senha) ao cliente quando ele solicita acesso ao sistema, diz 'sim', 'quero', 'ok', ou demonstra interesse em acessar.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "responder_duvida",
      description: "Responde uma dúvida do cliente sobre o sistema EBD ou sobre funcionalidades específicas.",
      parameters: {
        type: "object",
        properties: {
          resposta: {
            type: "string",
            description: "A resposta para a dúvida do cliente, clara e objetiva",
          },
        },
        required: ["resposta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resposta_generica",
      description: "Para saudações, agradecimentos ou mensagens não relacionadas ao sistema.",
      parameters: {
        type: "object",
        properties: {
          resposta: {
            type: "string",
            description: "Resposta amigável e profissional",
          },
        },
        required: ["resposta"],
      },
    },
  },
];

function normalizePhone(phone: string): string {
  // Remove tudo que não é número
  return phone.replace(/\D/g, "");
}

function isReceivedMessage(payload: Record<string, unknown>): boolean {
  // Z-API sends received messages with these patterns
  const event = payload.event as string | undefined;
  const type = payload.type as string | undefined;
  const isFromMe = payload.fromMe as boolean | undefined;
  
  if (isFromMe === true) return false;
  
  if (event === "received" || type === "ReceivedCallback") return true;
  
  // Check for text message content
  if (payload.text && typeof (payload.text as Record<string, unknown>).message === "string") return true;
  if (payload.body && typeof payload.body === "string" && !isFromMe) return true;
  
  // Check for image message
  const image = payload.image as Record<string, unknown> | undefined;
  if (image && (image.imageUrl || image.caption)) return true;
  
  // Check for audio message
  const audio = payload.audio as Record<string, unknown> | undefined;
  if (audio && (audio.audioUrl || audio.url)) return true;
  
  return false;
}

function extractMessageText(payload: Record<string, unknown>): string | null {
  // Try different Z-API payload structures
  const text = payload.text as Record<string, unknown> | undefined;
  if (text?.message && typeof text.message === "string") return text.message;
  
  if (payload.body && typeof payload.body === "string") return payload.body as string;
  
  const message = payload.message as Record<string, unknown> | undefined;
  if (message?.body && typeof message.body === "string") return message.body as string;

  // Image with caption
  const image = payload.image as Record<string, unknown> | undefined;
  if (image?.caption && typeof image.caption === "string") return image.caption;
  
  return null;
}

function extractImageUrl(payload: Record<string, unknown>): string | null {
  const image = payload.image as Record<string, unknown> | undefined;
  if (image?.imageUrl && typeof image.imageUrl === "string") return image.imageUrl as string;
  if (image?.thumbnailUrl && typeof image.thumbnailUrl === "string") return image.thumbnailUrl as string;
  return null;
}

function extractAudioUrl(payload: Record<string, unknown>): string | null {
  const audio = payload.audio as Record<string, unknown> | undefined;
  if (audio?.audioUrl && typeof audio.audioUrl === "string") return audio.audioUrl as string;
  if (audio?.url && typeof audio.url === "string") return audio.url as string;
  return null;
}

function extractPhone(payload: Record<string, unknown>): string | null {
  const phone = payload.phone as string | undefined;
  if (phone) return normalizePhone(phone);
  
  const from = payload.from as string | undefined;
  if (from) return normalizePhone(from);
  
  const chatId = payload.chatId as string | undefined;
  if (chatId) return normalizePhone(chatId.replace("@c.us", "").replace("@g.us", ""));
  
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // === META WHATSAPP WEBHOOK ROUTE ===
  const url = new URL(req.url);
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1];

  if (lastSegment === "whatsapp-meta-webhook") {
    // GET - Meta verification
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === "MEU_VERIFY_TOKEN_123") {
        console.log("Meta webhook verified successfully");
        return new Response(challenge || "", {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // POST - Receive Meta events
    if (req.method === "POST") {
      try {
        const body = await req.json();
        console.log("Meta webhook event:", JSON.stringify(body));

        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        const telefone = message?.from || body?.entry?.[0]?.changes?.[0]?.value?.metadata?.display_phone_number || null;
        const messageId = message?.id || null;
        const evento = body?.entry?.[0]?.changes?.[0]?.field || "meta_webhook";

        await supabase.from("whatsapp_webhooks").insert({
          evento,
          telefone,
          message_id: messageId,
          payload: body,
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("Meta webhook error:", err);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  }
  // === END META WEBHOOK ROUTE ===

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();

    // Extract common fields for logging
    const evento = payload.event || payload.type || payload.status || "unknown";
    const telefone = payload.phone || payload.from || payload.chatId || null;
    const messageId = payload.messageId || payload.id?.id || payload.ids?.[0] || null;

    // Always log the webhook
    await supabase.from("whatsapp_webhooks").insert({
      evento,
      payload,
      telefone,
      message_id: messageId,
    });

    // Check if this is a received text message
    if (isReceivedMessage(payload)) {
      const messageText = extractMessageText(payload);
      const imageUrl = extractImageUrl(payload);
      const audioUrl = extractAudioUrl(payload);
      const senderPhone = extractPhone(payload);

      if ((messageText || imageUrl || audioUrl) && senderPhone) {
        const contentToSave = messageText || (imageUrl ? "[Imagem]" : (audioUrl ? "[Áudio]" : ""));
        console.log(`Received message from ${senderPhone}: ${contentToSave}${imageUrl ? " [com imagem]" : ""}${audioUrl ? " [com áudio]" : ""}`);

        // SEMPRE salvar mensagem recebida em whatsapp_conversas
        // Look up client by phone for the cliente_id
        const phoneSuffixes = [senderPhone, senderPhone.slice(-11), senderPhone.slice(-10)];
        let clienteId = null;
        for (const suffix of phoneSuffixes) {
          const { data } = await supabase
            .from("ebd_clientes")
            .select("id")
            .or(`telefone.ilike.%${suffix}`)
            .limit(1)
            .single();
          if (data) {
            clienteId = data.id;
            break;
          }
        }

        await supabase.from("whatsapp_conversas").insert({
          telefone: senderPhone,
          cliente_id: clienteId,
          role: "user",
          content: contentToSave,
          imagem_url: imageUrl,
          audio_url: audioUrl,
        });

        // Verificar se o agente IA está ativo para processar com OpenAI
        const { data: agenteIaSetting } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "whatsapp_agente_ia_ativo")
          .maybeSingle();

        if (agenteIaSetting?.value === "true" && contentToSave && contentToSave !== "[Imagem]" && contentToSave !== "[Áudio]") {
          await processIncomingMessage(supabase, senderPhone, contentToSave);
        } else {
          console.log("Agente de IA desativado - mensagem salva sem processamento IA");
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processIncomingMessage(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  messageText: string
) {
  try {
    // 1. Look up client by phone (try multiple formats)
    const phoneSuffixes = [phone, phone.slice(-11), phone.slice(-10)];
    let cliente = null;

    for (const suffix of phoneSuffixes) {
      const { data } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, nome_responsavel, nome_superintendente, email_superintendente, senha_temporaria, telefone, ultimo_login, onboarding_concluido, status_ativacao_ebd")
        .or(`telefone.ilike.%${suffix}`)
        .limit(1)
        .single();

      if (data) {
        cliente = data;
        break;
      }
    }

    // 2. Get funil tracking if client found
    let tracking = null;
    if (cliente) {
      const { data } = await supabase
        .from("funil_posv_tracking")
        .select("*")
        .eq("cliente_id", cliente.id)
        .single();
      tracking = data;
    }

    // 3. Get conversation history (last 10 messages)
    const { data: historico } = await supabase
      .from("whatsapp_conversas")
      .select("role, content")
      .eq("telefone", phone)
      .order("created_at", { ascending: false })
      .limit(10);

    // User message already saved before calling processIncomingMessage

    // 5. Build context for OpenAI
    const contextParts: string[] = [];
    if (cliente) {
      contextParts.push(`Cliente: ${cliente.nome_igreja}`);
      contextParts.push(`Responsável: ${cliente.nome_responsavel || cliente.nome_superintendente || "N/A"}`);
      contextParts.push(`Email: ${cliente.email_superintendente || "N/A"}`);
      contextParts.push(`Já fez login: ${cliente.ultimo_login ? "Sim" : "Não"}`);
      contextParts.push(`Onboarding concluído: ${cliente.onboarding_concluido ? "Sim" : "Não"}`);
      contextParts.push(`EBD ativo: ${cliente.status_ativacao_ebd ? "Sim" : "Não"}`);
      if (tracking) {
        contextParts.push(`Fase do funil: ${tracking.fase_atual}`);
      }
      if (cliente.senha_temporaria) {
        contextParts.push(`Tem senha temporária: Sim`);
      }
    } else {
      contextParts.push("Cliente NÃO encontrado no sistema pelo telefone.");
    }

    const contextMessage = `\n\n--- CONTEXTO DO CLIENTE ---\n${contextParts.join("\n")}`;

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT + contextMessage },
    ];

    // Add conversation history (reversed to chronological order)
    if (historico && historico.length > 0) {
      const reversed = [...historico].reverse();
      // Skip the last one since it's the current message we just saved
      for (const msg of reversed.slice(0, -1)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current user message
    messages.push({ role: "user", content: messageText });

    // 6. Call OpenAI
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("OPENAI_API_KEY not configured");
      return;
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        tools: OPENAI_TOOLS,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI error:", openaiResponse.status, errorText);
      return;
    }

    const openaiResult = await openaiResponse.json();
    const choice = openaiResult.choices?.[0];

    if (!choice) {
      console.error("No choice in OpenAI response");
      return;
    }

    // 7. Process the response
    let responseText = "";
    let toolUsed = null;

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || "{}");
      toolUsed = functionName;

      if (functionName === "enviar_credenciais") {
        responseText = await handleEnviarCredenciais(supabase, cliente, phone);
      } else if (functionName === "responder_duvida") {
        responseText = args.resposta || "Desculpe, não consegui formular uma resposta. Tente novamente.";
      } else if (functionName === "resposta_generica") {
        responseText = args.resposta || "Olá! Como posso ajudar? 😊";
      }
    } else if (choice.message.content) {
      responseText = choice.message.content;
    }

    if (!responseText) {
      responseText = "Olá! Sou o assistente da Central Gospel. Como posso ajudar você hoje? 📚";
    }

    // 8. Send response via Z-API
    await sendZApiMessage(supabase, phone, responseText);

    // 9. Save assistant response to history
    await supabase.from("whatsapp_conversas").insert({
      telefone: phone,
      cliente_id: cliente?.id || null,
      role: "assistant",
      content: responseText,
      tool_used: toolUsed,
    });

    console.log(`Response sent to ${phone}: ${responseText.substring(0, 100)}...`);
  } catch (error) {
    console.error("Error processing message:", error);
  }
}

async function handleEnviarCredenciais(
  supabase: ReturnType<typeof createClient>,
  cliente: Record<string, unknown> | null,
  phone: string
): Promise<string> {
  if (!cliente) {
    return "Desculpe, não encontramos seu cadastro no sistema. Por favor, entre em contato com o suporte para que possamos ajudá-lo. 📞";
  }

  const email = cliente.email_superintendente as string;
  const senha = cliente.senha_temporaria as string;
  const nomeIgreja = cliente.nome_igreja as string;

  if (!email || !senha) {
    return `Olá! Identificamos sua igreja *${nomeIgreja}* no sistema, mas as credenciais ainda não foram configuradas. Nossa equipe vai preparar seu acesso e enviar em breve! 🙏`;
  }

  // Update tracking to phase 2 if applicable
  if (cliente.id) {
    await supabase
      .from("funil_posv_tracking")
      .update({
        fase_atual: 2,
        fase2_enviada_em: new Date().toISOString(),
        ultima_mensagem_em: new Date().toISOString(),
      })
      .eq("cliente_id", cliente.id);
  }

  return `*Aqui estão seus dados de acesso ao Sistema Gestão EBD:*\n\n` +
    `*E-mail:* ${email}\n` +
    `*Senha:* ${senha}\n\n` +
    `*Acesse:* https://gestaoebd.com.br/login/ebd\n\n` +
    `Recomendamos alterar a senha no primeiro acesso.\n\n` +
    `Ao entrar, você já pode:\n` +
    `- Acompanhar seu pedido e código de rastreio (Menu > Meus Pedidos)\n` +
    `- Configurar turmas, professores e alunos com o guia passo a passo\n\n` +
    `O sistema vai te orientar em cada etapa.\n\n` +
    `Precisa de ajuda? Me pergunte!`;
}

async function sendZApiMessage(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  message: string
) {
  try {
    // Get Z-API credentials
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
      console.error("Z-API credentials not configured");
      return;
    }

    const zapiEndpoint = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/send-text`;

    const zapiResponse = await fetch(zapiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify({ phone, message }),
    });

    const zapiResult = await zapiResponse.json();

    // Log the message
    await supabase.from("whatsapp_mensagens").insert({
      tipo_mensagem: "agente_ia",
      telefone_destino: phone,
      mensagem: message,
      status: zapiResponse.ok ? "enviado" : "erro",
      erro_detalhes: zapiResponse.ok ? null : JSON.stringify(zapiResult),
      payload_enviado: { phone, message },
      resposta_recebida: zapiResult,
    });

    if (!zapiResponse.ok) {
      console.error("Z-API send error:", zapiResult);
    }
  } catch (error) {
    console.error("Error sending Z-API message:", error);
  }
}
