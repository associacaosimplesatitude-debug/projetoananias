// Tests Fase 2 — RPCs unificadas
const url = "https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/agente-loja-cg";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function call(telefone: string, mensagem_user: string) {
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ telefone, mensagem_user }),
  });
  const txt = await res.text();
  console.log(`\n=== ${telefone} | "${mensagem_user}" | ${Date.now() - t0}ms | HTTP ${res.status} ===`);
  console.log(txt);
}

Deno.test("Fase 2 - Cristiano (licenca + OTP)", async () => {
  await call("21987161800", "Como baixo a revista para o celular");
});

Deno.test("Fase 2 - Sabrina (cadastrada sem compra)", async () => {
  await call("11949910738", "Bom dia");
});

Deno.test("Fase 2 - Lead novo", async () => {
  await call("5511999999999", "Olá, vocês têm a revista de adulto?");
});
