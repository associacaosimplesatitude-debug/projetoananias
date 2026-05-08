// E2E smoke test — invokes the deployed agente-loja-cg using the runtime SERVICE_ROLE_KEY.
Deno.test("agente-loja-cg end-to-end", async () => {
  const url = "https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/agente-loja-cg";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      telefone: "5511987654321",
      mensagem_user: "Olá, vocês têm a revista de adulto desse trimestre?",
    }),
  });
  const elapsed = Date.now() - t0;
  const text = await res.text();
  console.log("HTTP_STATUS=", res.status);
  console.log("ELAPSED_MS=", elapsed);
  console.log("BODY=", text);
});
