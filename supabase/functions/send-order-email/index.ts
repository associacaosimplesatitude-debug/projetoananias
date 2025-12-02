import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderEmailRequest {
  orderId: string;
  emailType: "order_created" | "payment_pending" | "payment_approved" | "payment_rejected";
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const getEmailContent = (
  emailType: string,
  orderData: any,
  churchData: any,
  items: any[]
) => {
  const orderId = orderData.id.slice(0, 8).toUpperCase();
  const orderDate = new Date(orderData.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${item.revista?.titulo || "Revista"}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${item.quantidade}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
          ${formatCurrency(item.preco_total)}
        </td>
      </tr>
    `
    )
    .join("");

  const baseStyles = `
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
      .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
      .header { background: linear-gradient(135deg, #1a2d40 0%, #2d4a5e 100%); padding: 30px; text-align: center; }
      .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
      .content { padding: 30px; }
      .order-info { background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
      .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; }
      .status-pending { background-color: #fef3c7; color: #92400e; }
      .status-approved { background-color: #d1fae5; color: #065f46; }
      .status-rejected { background-color: #fee2e2; color: #991b1b; }
      .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      .table th { background-color: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; }
      .total { font-size: 20px; font-weight: 700; color: #059669; }
      .footer { background-color: #1a2d40; color: #ffffff; padding: 20px; text-align: center; font-size: 14px; }
      .button { display: inline-block; background-color: #c89c5a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
    </style>
  `;

  const headerHtml = `
    <div class="header">
      <h1>🚢 Projeto Ananias</h1>
    </div>
  `;

  const orderInfoHtml = `
    <div class="order-info">
      <p style="margin: 0 0 10px 0;"><strong>Pedido:</strong> #${orderId}</p>
      <p style="margin: 0 0 10px 0;"><strong>Data:</strong> ${orderDate}</p>
      <p style="margin: 0 0 10px 0;"><strong>Igreja:</strong> ${churchData?.church_name || "N/A"}</p>
    </div>
  `;

  const itemsTableHtml = `
    <table class="table">
      <thead>
        <tr>
          <th>Produto</th>
          <th style="text-align: center;">Qtd</th>
          <th style="text-align: right;">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding: 12px; text-align: right;"><strong>Frete:</strong></td>
          <td style="padding: 12px; text-align: right;">${formatCurrency(orderData.valor_frete)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 12px; text-align: right;"><strong>Total:</strong></td>
          <td style="padding: 12px; text-align: right;" class="total">${formatCurrency(orderData.valor_total)}</td>
        </tr>
      </tfoot>
    </table>
  `;

  const footerHtml = `
    <div class="footer">
      <p style="margin: 0;">Projeto Ananias - Sistema de Gestão para Igrejas</p>
      <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.8;">Este é um email automático, não responda.</p>
    </div>
  `;

  switch (emailType) {
    case "order_created":
      return {
        subject: `Pedido #${orderId} recebido - Projeto Ananias`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              ${headerHtml}
              <div class="content">
                <h2 style="color: #1a2d40; margin-top: 0;">✅ Pedido Recebido!</h2>
                <p>Olá! Seu pedido foi recebido com sucesso e está aguardando o pagamento.</p>
                ${orderInfoHtml}
                <h3 style="color: #1a2d40;">Itens do Pedido</h3>
                ${itemsTableHtml}
                <p style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                  <strong>⏳ Aguardando Pagamento</strong><br>
                  Assim que identificarmos o pagamento, você receberá uma confirmação por email.
                </p>
              </div>
              ${footerHtml}
            </div>
          </body>
          </html>
        `,
      };

    case "payment_pending":
      return {
        subject: `Pagamento pendente - Pedido #${orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              ${headerHtml}
              <div class="content">
                <h2 style="color: #1a2d40; margin-top: 0;">⏳ Pagamento em Processamento</h2>
                <p>Seu pagamento está sendo processado. Aguarde a confirmação.</p>
                ${orderInfoHtml}
                <div style="text-align: center; margin: 20px 0;">
                  <span class="status-badge status-pending">Pagamento Pendente</span>
                </div>
                ${itemsTableHtml}
                <p style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
                  O processamento pode levar alguns minutos. Você receberá um email assim que o pagamento for confirmado.
                </p>
              </div>
              ${footerHtml}
            </div>
          </body>
          </html>
        `,
      };

    case "payment_approved":
      return {
        subject: `🎉 Pagamento confirmado - Pedido #${orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              ${headerHtml}
              <div class="content">
                <h2 style="color: #059669; margin-top: 0;">🎉 Pagamento Confirmado!</h2>
                <p>Ótima notícia! Seu pagamento foi aprovado e seu pedido está sendo preparado para envio.</p>
                ${orderInfoHtml}
                <div style="text-align: center; margin: 20px 0;">
                  <span class="status-badge status-approved">Pagamento Aprovado</span>
                </div>
                ${itemsTableHtml}
                <p style="background-color: #d1fae5; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
                  <strong>📦 Próximos passos:</strong><br>
                  Seu pedido será enviado em breve. Você receberá o código de rastreamento assim que disponível.
                </p>
              </div>
              ${footerHtml}
            </div>
          </body>
          </html>
        `,
      };

    case "payment_rejected":
      return {
        subject: `Pagamento não aprovado - Pedido #${orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              ${headerHtml}
              <div class="content">
                <h2 style="color: #dc2626; margin-top: 0;">❌ Pagamento Não Aprovado</h2>
                <p>Infelizmente, seu pagamento não foi aprovado pela operadora.</p>
                ${orderInfoHtml}
                <div style="text-align: center; margin: 20px 0;">
                  <span class="status-badge status-rejected">Pagamento Rejeitado</span>
                </div>
                ${itemsTableHtml}
                <p style="background-color: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                  <strong>O que fazer?</strong><br>
                  - Verifique os dados do cartão<br>
                  - Tente outro método de pagamento<br>
                  - Entre em contato com sua operadora de cartão
                </p>
                <div style="text-align: center;">
                  <a href="https://projetoananias.com.br/ebd/catalogo" class="button">Tentar Novamente</a>
                </div>
              </div>
              ${footerHtml}
            </div>
          </body>
          </html>
        `,
      };

    default:
      return {
        subject: `Atualização do Pedido #${orderId}`,
        html: `<p>Seu pedido foi atualizado.</p>`,
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, emailType }: OrderEmailRequest = await req.json();

    console.log(`Sending ${emailType} email for order ${orderId}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch order data
    const { data: orderData, error: orderError } = await supabase
      .from("ebd_pedidos")
      .select(`
        *,
        ebd_pedidos_itens(
          quantidade,
          preco_unitario,
          preco_total,
          revista:ebd_revistas(titulo, imagem_url)
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !orderData) {
      console.error("Order not found:", orderError);
      throw new Error("Pedido não encontrado");
    }

    // Fetch church data
    const { data: churchData } = await supabase
      .from("churches")
      .select("church_name, pastor_email, pastor_name")
      .eq("id", orderData.church_id)
      .single();

    // Usar email_cliente do pedido, fallback para pastor_email
    const recipientEmail = orderData.email_cliente || churchData?.pastor_email;
    
    if (!recipientEmail) {
      console.error("No recipient email found");
      throw new Error("Email do destinatário não encontrado");
    }

    const { subject, html } = getEmailContent(
      emailType,
      orderData,
      churchData,
      orderData.ebd_pedidos_itens || []
    );

    console.log(`Sending email to ${recipientEmail}`);

    const emailResponse = await resend.emails.send({
      from: "Projeto Ananias <noreply@projetoananias.com.br>",
      to: [recipientEmail],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending order email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
