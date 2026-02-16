import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// 1x1 transparent GIF pixel
const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const logId = url.searchParams.get("logId");
    const redirectUrl = url.searchParams.get("url");

    if (!type || !logId) {
      return new Response("Missing params", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (type === "open") {
      // Update open tracking - only set if not already opened
      await supabase
        .from("ebd_email_logs")
        .update({ email_aberto: true, data_abertura: new Date().toISOString() })
        .eq("id", logId)
        .eq("email_aberto", false);

      return new Response(TRANSPARENT_GIF, {
        status: 200,
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    }

    if (type === "click") {
      if (!redirectUrl) {
        return new Response("Missing url param", { status: 400 });
      }

      // Update click tracking - only set if not already clicked
      await supabase
        .from("ebd_email_logs")
        .update({ link_clicado: true, data_clique: new Date().toISOString() })
        .eq("id", logId)
        .eq("link_clicado", false);

      // Redirect to original URL
      return new Response(null, {
        status: 302,
        headers: { "Location": redirectUrl },
      });
    }

    return new Response("Invalid type", { status: 400 });
  } catch (error: any) {
    console.error("ebd-email-tracker error:", error);
    return new Response("Error", { status: 500 });
  }
};

serve(handler);
