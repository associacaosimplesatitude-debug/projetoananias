import { createClient } from "npm:@supabase/supabase-js@2";

// Inline cópia de gerarVariantes (cross-function imports não funcionam no bundler)
function gerarVariantes(input: string): string[] {
  const d = (input || "").replace(/\D/g, "");
  if (!d) return [];
  const set = new Set<string>();
  set.add(d);
  let core = d;
  if (core.startsWith("55") && (core.length === 12 || core.length === 13)) core = core.slice(2);
  if (core.length === 11) {
    const semNove = core.slice(0, 2) + core.slice(3);
    set.add(core); set.add(semNove); set.add("55" + core); set.add("55" + semNove);
  } else if (core.length === 10) {
    const comNove = core.slice(0, 2) + "9" + core.slice(2);
    set.add(core); set.add(comNove); set.add("55" + core); set.add("55" + comNove);
  }
  return Array.from(set);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Decide se a mensagem deve ser roteada pro agente-loja-cg ──
async function deveRotearParaAgente(
  supabase: ReturnType<typeof createClient>,
  telefone: string,
): Promise<{ chamar: boolean; motivo?: string }> {
  const variantes = gerarVariantes(telefone);
  if (variantes.length === 0) return { chamar: false, motivo: "telefone_invalido" };

  // Exceção 1: agente já pausado/escalado
  const { data: convAgente } = await supabase
    .from("agente_ia_conversas")
    .select("id, status")
    .in("telefone", variantes)
    .in("status", ["pausada_humano", "escalada"])
    .order("ultima_mensagem_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (convAgente) return { chamar: false, motivo: `agente_${(convAgente as any).status}` };

  // Exceção 2: cliente em fluxo de retenção/presente ativo
  // retencao_disparos só tem status='sucesso'. Tratamos como "aguardando" se houve
  // disparo nas últimas 72h e ainda NÃO existe retencao_respostas correspondente.
  const limite = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
  const { data: disparoRecente } = await supabase
    .from("retencao_disparos")
    .select("id, telefone, created_at")
    .in("telefone", variantes)
    .eq("status", "sucesso")
    .gte("created_at", limite)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (disparoRecente) {
    const { data: respostaJa } = await supabase
      .from("retencao_respostas")
      .select("id")
      .in("telefone", variantes)
      .gte("created_at", (disparoRecente as any).created_at)
      .limit(1)
      .maybeSingle();
    if (!respostaJa) return { chamar: false, motivo: "fluxo_retencao_aguardando" };
  }

  return { chamar: true };
}

// ── Fire-and-forget: chama o agente sem bloquear o webhook ──
function dispararAgente(telefone: string, mensagem: string, metaMessageId: string | null) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/agente-loja-cg`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const p = fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ telefone, mensagem_user: mensagem, meta_message_id: metaMessageId }),
  })
    .then(async (r) => {
      if (!r.ok) {
        const err = await r.text();
        console.error(`[webhook→agente] agente retornou ${r.status}:`, err.slice(0, 500));
      } else {
        console.log(`[webhook→agente] sucesso pra ${telefone}`);
      }
    })
    .catch((err) => console.error("[webhook→agente] falha:", err?.message || err));
  // @ts-ignore EdgeRuntime global no Deno deploy
  const wait = (globalThis as any).EdgeRuntime?.waitUntil ?? ((q: Promise<unknown>) => q);
  wait(p);
}


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
  return phone.replace(/\D/g, "");
}

function isReceivedMessage(payload: Record<string, unknown>): boolean {
  const event = payload.event as string | undefined;
  const type = payload.type as string | undefined;
  const isFromMe = payload.fromMe as boolean | undefined;
  
  if (isFromMe === true) return false;
  if (event === "received" || type === "ReceivedCallback") return true;
  if (payload.text && typeof (payload.text as Record<string, unknown>).message === "string") return true;
  if (payload.body && typeof payload.body === "string" && !isFromMe) return true;
  
  const image = payload.image as Record<string, unknown> | undefined;
  if (image && (image.imageUrl || image.caption)) return true;
  
  const audio = payload.audio as Record<string, unknown> | undefined;
  if (audio && (audio.audioUrl || audio.url)) return true;
  
  return false;
}

function extractMessageText(payload: Record<string, unknown>): string | null {
  const text = payload.text as Record<string, unknown> | undefined;
  if (text?.message && typeof text.message === "string") return text.message;
  if (payload.body && typeof payload.body === "string") return payload.body as string;
  const message = payload.message as Record<string, unknown> | undefined;
  if (message?.body && typeof message.body === "string") return message.body as string;
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

// ── Detect if a payload is from Meta (entry[].changes[] structure) ──
function isMetaPayload(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return Array.isArray(b.entry) && (b.entry as unknown[]).length > 0;
}

// ── Get verify token from system_settings (with fallback) ──
async function getVerifyToken(supabase: ReturnType<typeof createClient>): Promise<string> {
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "whatsapp_verify_token")
      .maybeSingle();
    if (data?.value) return data.value;
  } catch { /* ignore */ }
  return "centralgospel123"; // fallback
}

// ── Classifica resposta de campanha de retenção ──
async function processarRespostaRetencao(
  supabase: ReturnType<typeof createClient>,
  telefone: string,
  texto: string,
  btnId: string
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Map por id (interactive original do template)
  const idMap: Record<string, { resultado: string; tipo: string }> = {
    "0": { resultado: "interessado", tipo: "interesse" },
    "1": { resultado: "falar_com_consultor", tipo: "quente" },
    "2": { resultado: "recusou", tipo: "recusa" },
    "presente_sim": { resultado: "whatsapp_aceitou_presente_revista", tipo: "aceitar_presente" },
    "presente_consultor": { resultado: "falar_com_consultor", tipo: "quente" },
    "presente_depois": { resultado: "whatsapp_adiou_presente", tipo: "adiar_presente" },
  };

  const t = (texto || "").trim().toLowerCase().replace(/[🎁💬⏰]/g, "").trim();
  const labelMap: Record<string, { resultado: string; tipo: string }> = {
    "falar com consultor": { resultado: "falar_com_consultor", tipo: "quente" },
    "tenho interesse": { resultado: "interessado", tipo: "interesse" },
    "interessado": { resultado: "interessado", tipo: "interesse" },
    "quero ver as novidades": { resultado: "interessado", tipo: "interesse" },
    "ver novidades": { resultado: "interessado", tipo: "interesse" },
    "quero novidades": { resultado: "interessado", tipo: "interesse" },
    "não tenho interesse": { resultado: "recusou", tipo: "recusa" },
    "nao tenho interesse": { resultado: "recusou", tipo: "recusa" },
    "recusar": { resultado: "recusou", tipo: "recusa" },
    "agora não, obrigado": { resultado: "recusou", tipo: "recusa" },
    "agora nao, obrigado": { resultado: "recusou", tipo: "recusa" },
    "agora não obrigado": { resultado: "recusou", tipo: "recusa" },
    "agora nao obrigado": { resultado: "recusou", tipo: "recusa" },
    "sim, libera!": { resultado: "whatsapp_aceitou_presente_revista", tipo: "aceitar_presente" },
    "sim libera": { resultado: "whatsapp_aceitou_presente_revista", tipo: "aceitar_presente" },
    "talvez depois": { resultado: "whatsapp_adiou_presente", tipo: "adiar_presente" },
    "falar consultor": { resultado: "falar_com_consultor", tipo: "quente" },
  };

  const match = (btnId && idMap[btnId]) || labelMap[t];
  if (!match) return;

  const senderPhone = normalizePhone(telefone);
  const sufs = [senderPhone, senderPhone.slice(-11), senderPhone.slice(-10)];
  let cliente: { id: string; vendedor_id: string | null; nome_igreja: string; email_superintendente: string | null; telefone: string | null } | null = null;
  for (const sf of sufs) {
    const { data } = await supabase
      .from("ebd_clientes")
      .select("id, vendedor_id, nome_igreja, email_superintendente, telefone, updated_at")
      .or(`telefone.ilike.%${sf}`)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) { cliente = data[0] as any; break; }
  }
  if (!cliente) {
    console.log(`[Retencao] cliente não encontrado p/ ${senderPhone}`);
    return;
  }
  console.log(`[Retencao] match cliente=${cliente.id} (${cliente.nome_igreja}) tipo=${match.tipo} btn=${btnId || texto}`);

  // Inserir histórico
  await supabase.from("ebd_retencao_contatos").insert({
    cliente_id: cliente.id,
    vendedor_id: cliente.vendedor_id,
    tipo_contato: "whatsapp",
    resultado: match.resultado,
    observacao: `Resposta automática (botão: ${texto || btnId})`,
  });

  // Inserir em retencao_respostas
  await supabase.from("retencao_respostas").insert({
    cliente_id: cliente.id,
    telefone: senderPhone,
    tipo: match.tipo,
    mensagem_recebida: texto || btnId,
  });

  // Buscar nome do vendedor
  let vendedorNome = "seu consultor";
  if (cliente.vendedor_id) {
    const { data: v } = await supabase.from("vendedores").select("nome").eq("id", cliente.vendedor_id).maybeSingle();
    if (v?.nome) vendedorNome = v.nome;
  }

  // Disparar fluxos
  if (match.tipo === "interesse") {
    // @ts-ignore EdgeRuntime is global on Deno deploy
    const wait = (globalThis as any).EdgeRuntime?.waitUntil ?? ((p: Promise<unknown>) => p);
    wait(fetch(`${supabaseUrl}/functions/v1/responder-interesse-novidades`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ cliente_id: cliente.id, telefone: senderPhone, nome: cliente.nome_igreja, vendedor_nome: vendedorNome }),
    }).catch((e) => console.error("[fire-and-forget interesse]", e)));
  }

  if (match.tipo === "aceitar_presente") {
    // @ts-ignore
    const wait = (globalThis as any).EdgeRuntime?.waitUntil ?? ((p: Promise<unknown>) => p);
    wait(fetch(`${supabaseUrl}/functions/v1/liberar-presente-cartas-prisao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        cliente_id: cliente.id,
        telefone: senderPhone,
        nome: cliente.nome_igreja,
        email: cliente.email_superintendente,
        vendedor_nome: vendedorNome,
      }),
    }).catch((e) => console.error("[fire-and-forget presente]", e)));
  }

  if (match.tipo === "adiar_presente") {
    // Mensagem livre de despedida
    try {
      const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);
      const sm: Record<string, string> = {};
      (settings || []).forEach((s: any) => { sm[s.key] = s.value; });
      const to = senderPhone.startsWith("55") ? senderPhone : "55" + senderPhone;
      await fetch(`https://graph.facebook.com/v23.0/${sm["whatsapp_phone_number_id"]}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sm["whatsapp_access_token"]}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: `Tudo bem, ${cliente.nome_igreja}! Sem pressa nenhuma 🙌\n\nVou guardar isso aqui e te procuro daqui um tempinho com novidades. Se mudar de ideia antes, é só me chamar que eu libero na hora — o presente fica reservado pra você.\n\nQue Deus continue abençoando sua igreja 🙏` },
        }),
      });
    } catch (e) { console.error("[adiar_presente]", e); }
  }
}

// ── Process Meta webhook POST payload ──
async function handleMetaPost(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>
) {
  const entries = (body.entry || []) as Array<Record<string, unknown>>;

  for (const entry of entries) {
    const changes = (entry.changes || []) as Array<Record<string, unknown>>;

    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined;
      if (!value) continue;

      const evento = (change.field as string) || "meta_webhook";
      const messages = (value.messages || []) as Array<Record<string, unknown>>;
      const statuses = (value.statuses || []) as Array<Record<string, unknown>>;

      // Save statuses for auditing
      for (const status of statuses) {
        const recipientId = status.recipient_id as string | undefined;
        const statusMessageId = status.id as string | undefined;
        await supabase.from("whatsapp_webhooks").insert({
          evento: "meta_status",
          telefone: recipientId || null,
          message_id: statusMessageId || null,
          payload: body,
        });
      }

      // Process each incoming message
      for (const message of messages) {
        const telefone = (message.from as string) || null;
        const messageId = (message.id as string) || null;

        // Audit log
        await supabase.from("whatsapp_webhooks").insert({
          evento,
          telefone,
          message_id: messageId,
          payload: body,
        });

        if (!telefone) continue;
        const senderPhone = normalizePhone(telefone);

        let contentToSave: string | null = null;
        let imageUrl: string | null = null;
        let audioUrl: string | null = null;

        const msgType = message.type as string;

        if (msgType === "text") {
          const textObj = message.text as Record<string, unknown> | undefined;
          contentToSave = (textObj?.body as string) || null;
        } else if (msgType === "image") {
          const imgObj = message.image as Record<string, unknown> | undefined;
          imageUrl = imgObj?.id ? `meta-media:${imgObj.id}` : null;
          contentToSave = (imgObj?.caption as string) || "[Imagem]";
        } else if (msgType === "audio" || msgType === "voice") {
          const audObj = message.audio as Record<string, unknown> | undefined;
          audioUrl = audObj?.id ? `meta-media:${audObj.id}` : null;
          contentToSave = "[Áudio]";
        } else if (msgType === "button") {
          const btnObj = message.button as Record<string, unknown> | undefined;
          const btnText = (btnObj?.text as string) || (btnObj?.payload as string) || "";
          contentToSave = btnText || "[Botão]";
          await processarRespostaRetencao(supabase, telefone, btnText, "");
        } else if (msgType === "interactive") {
          const intObj = message.interactive as Record<string, unknown> | undefined;
          const btnReply = intObj?.button_reply as Record<string, unknown> | undefined;
          const listReply = intObj?.list_reply as Record<string, unknown> | undefined;
          contentToSave = (btnReply?.title as string) || (listReply?.title as string) || "[Interação]";
          const btnId = (btnReply?.id as string) || "";
          const btnTitle = (btnReply?.title as string) || "";
          await processarRespostaRetencao(supabase, telefone, btnTitle, btnId);
        } else if (msgType === "sticker") {
          contentToSave = "[Sticker]";
        } else if (msgType === "video") {
          contentToSave = "[Vídeo]";
        } else if (msgType === "document") {
          contentToSave = "[Documento]";
        } else if (msgType === "location") {
          contentToSave = "[Localização]";
        } else if (msgType === "contacts") {
          contentToSave = "[Contato]";
        } else if (msgType === "reaction") {
          // Reactions don't need to be saved as messages
          continue;
        } else {
          contentToSave = `[${msgType || "Mensagem"}]`;
        }

        if (!contentToSave || !senderPhone) continue;

        console.log(`[Meta] Received from ${senderPhone}: ${contentToSave}`);

        // Look up client by phone variants
        const phoneSuffixes = [senderPhone, senderPhone.slice(-11), senderPhone.slice(-10)];
        let clienteId = null;
        for (const suffix of phoneSuffixes) {
          const { data } = await supabase
            .from("ebd_clientes")
            .select("id, updated_at")
            .or(`telefone.ilike.%${suffix}`)
            .order("updated_at", { ascending: false })
            .limit(1);
          if (data && data.length > 0) {
            clienteId = data[0].id;
            break;
          }
        }

        // Save to whatsapp_conversas
        await supabase.from("whatsapp_conversas").insert({
          telefone: senderPhone,
          cliente_id: clienteId,
          role: "user",
          content: contentToSave,
          imagem_url: imageUrl,
          audio_url: audioUrl,
        });

        // ── Roteamento pro agente-loja-cg (apenas tipos textuais e fluxos não-bloqueados) ──
        const tiposParaAgente = ["text", "button", "interactive"];
        if (tiposParaAgente.includes(msgType) && contentToSave && !contentToSave.startsWith("[")) {
          const decisao = await deveRotearParaAgente(supabase, senderPhone);
          console.log(`[webhook→agente] roteamento ${senderPhone}:`, decisao);
          if (decisao.chamar) {
            dispararAgente(senderPhone, contentToSave, messageId);
          }
        } else {
          console.log(`[webhook→agente] ignorado tipo=${msgType} content="${contentToSave?.slice(0, 40)}"`);
        }

        // Check if AI agent (legado EBD) is active
        const { data: agenteIaSetting } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "whatsapp_agente_ia_ativo")
          .maybeSingle();

        if (agenteIaSetting?.value === "true" && contentToSave && contentToSave !== "[Imagem]" && contentToSave !== "[Áudio]" && !contentToSave.startsWith("[")) {
          await processIncomingMessage(supabase, senderPhone, contentToSave);
        } else {
          console.log("[Meta] Agente EBD desativado ou tipo não-texto - sem processamento IA legado");
        }

      }

      // If no messages and no statuses, still audit the raw event
      if (messages.length === 0 && statuses.length === 0) {
        await supabase.from("whatsapp_webhooks").insert({
          evento,
          telefone: null,
          message_id: null,
          payload: body,
        });
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ── GET: Meta verification (works on ANY path) ──
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && challenge) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const expectedToken = await getVerifyToken(supabase);

      if (token === expectedToken) {
        console.log("[Webhook] Meta verification OK");
        return new Response(challenge, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
      console.log("[Webhook] Meta verification FAILED - token mismatch:", token, "expected:", expectedToken);
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }
  }

  // ── POST: handle incoming events ──
  if (req.method === "POST") {
    try {
      const body = await req.json();

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // ── Detect Meta payload by structure (not by URL path) ──
      if (isMetaPayload(body)) {
        console.log("[Webhook] Meta payload detected, processing...");
        await handleMetaPost(supabase, body);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Z-API / legacy payload ──
      const evento = body.event || body.type || body.status || "unknown";
      const telefone = body.phone || body.from || body.chatId || null;
      const messageId = body.messageId || body.id?.id || body.ids?.[0] || null;

      await supabase.from("whatsapp_webhooks").insert({
        evento,
        payload: body,
        telefone,
        message_id: messageId,
      });

      if (isReceivedMessage(body)) {
        const messageText = extractMessageText(body);
        const imageUrl = extractImageUrl(body);
        const audioUrl = extractAudioUrl(body);
        const senderPhone = extractPhone(body);

        if ((messageText || imageUrl || audioUrl) && senderPhone) {
          const contentToSave = messageText || (imageUrl ? "[Imagem]" : (audioUrl ? "[Áudio]" : ""));
          console.log(`Received message from ${senderPhone}: ${contentToSave}`);

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
  }

  return new Response("OK", { status: 200, headers: corsHeaders });
});

async function processIncomingMessage(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  messageText: string
) {
  try {
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

    let tracking = null;
    if (cliente) {
      const { data } = await supabase
        .from("funil_posv_tracking")
        .select("*")
        .eq("cliente_id", cliente.id)
        .single();
      tracking = data;
    }

    const { data: historico } = await supabase
      .from("whatsapp_conversas")
      .select("role, content")
      .eq("telefone", phone)
      .order("created_at", { ascending: false })
      .limit(10);

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

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT + contextMessage },
    ];

    if (historico && historico.length > 0) {
      const reversed = [...historico].reverse();
      for (const msg of reversed.slice(0, -1)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: messageText });

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

    await sendZApiMessage(supabase, phone, responseText);

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
