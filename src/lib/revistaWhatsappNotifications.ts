import { supabase } from "@/integrations/supabase/client";

async function sendWhatsApp(telefone: string, nome: string, mensagem: string) {
  try {
    await supabase.functions.invoke("send-whatsapp-message", {
      body: {
        tipo_mensagem: "notificacao_revista",
        telefone: telefone.replace(/\D/g, ""),
        nome,
        mensagem,
      },
    });
  } catch (err) {
    console.error("Erro ao enviar WhatsApp:", err);
  }
}

/** SE cadastrou aluno — notifica o aluno */
export async function notificarAlunoCadastrado(
  nome: string,
  telefone: string,
  link: string
) {
  if (!telefone) return;
  await sendWhatsApp(
    telefone,
    nome,
    `Olá ${nome}! O seu Superintendente te cadastrou na Revista Virtual. Acesse ${link} para criar sua senha e enviar o comprovante de pagamento.`
  );
}

/** Aluno enviou comprovante — notifica o SE */
export async function notificarComprovanteRecebido(
  seTelefone: string,
  seNome: string,
  alunoNome: string
) {
  if (!seTelefone) return;
  await sendWhatsApp(
    seTelefone,
    seNome,
    `📋 Novo comprovante de ${alunoNome} aguarda sua aprovação na Revista Virtual.`
  );
}

/** SE aprovou acesso — notifica o aluno */
export async function notificarAcessoAprovado(
  telefone: string,
  nome: string,
  email: string,
  link: string
) {
  if (!telefone) return;
  await sendWhatsApp(
    telefone,
    nome,
    `✅ Seu acesso à Revista Virtual foi liberado!\nAcesse: ${link}\nLogin: ${email}`
  );
}

/** SE aprovou troca de dispositivo — notifica o aluno */
export async function notificarTrocaDispositivoAprovada(
  telefone: string,
  nome: string
) {
  if (!telefone) return;
  await sendWhatsApp(
    telefone,
    nome,
    `📱 Troca de dispositivo aprovada! Faça login no novo aparelho para acessar a Revista Virtual.`
  );
}

/** SE revogou acesso — notifica o aluno */
export async function notificarAcessoRevogado(
  telefone: string,
  nome: string
) {
  if (!telefone) return;
  await sendWhatsApp(
    telefone,
    nome,
    `🚫 Seu acesso à Revista Virtual foi suspenso. Fale com seu Superintendente para mais informações.`
  );
}
