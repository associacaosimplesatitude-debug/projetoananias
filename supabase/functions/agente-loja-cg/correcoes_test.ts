// Validation tests for skill v1.3 corrections.
const URL = "https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/agente-loja-cg";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function call(label: string, telefone: string, mensagem_user: string) {
  const t0 = Date.now();
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ telefone, mensagem_user }),
  });
  const text = await res.text();
  console.log(`\n===== ${label} =====`);
  console.log(`telefone=${telefone} | msg="${mensagem_user}"`);
  console.log(`HTTP=${res.status} elapsed=${Date.now() - t0}ms`);
  console.log(`BODY=${text}`);
  return text;
}

Deno.test("v1.3 — 6 testes", async () => {
  await call("T1 apresentação limpa", "21987161800", "Bom dia");
  await call("T2 cliente diz problema", "21987161800", "Não consigo acessar a revista");
  await call("T3 compra revista física", "21987161800", "Quero comprar 40 revistas Cartas da Prisão Aluno e 10 Professor físicas");
  await call("T4 outro telefone licença Shopify", "21984078711", "Bom dia");
  await call("T5 pergunta desconto sem dizer o que quer", "21984078711", "Vocês têm desconto?");
  await call("T6 quer falar com humano", "21984078711", "Quero falar com uma pessoa");
});
