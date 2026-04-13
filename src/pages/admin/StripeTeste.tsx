import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CreditCard, RefreshCw, Zap, Settings, ListChecks, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface StripeLog {
  id: string;
  payment_intent_id: string | null;
  amount: number;
  fee_amount: number;
  net_amount: number;
  status: string;
  description: string | null;
  stripe_event: string | null;
  created_at: string;
}

interface PaymentResult {
  payment_intent_id: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  client_secret: string;
  status: string;
}

export default function StripeTeste() {
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [logs, setLogs] = useState<StripeLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    const { data, error } = await supabase
      .from("stripe_test_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setLogs(data as unknown as StripeLog[]);
    setLoadingLogs(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleCreatePayment = async () => {
    const amount = parseFloat(valor);
    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-test-payment", {
        body: { amount, description: descricao || "Teste Stripe Admin", test_mode: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast.success("PaymentIntent criado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar PaymentIntent");
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "PAGO":
        return <Badge className="bg-green-600 text-white hover:bg-green-700">PAGO</Badge>;
      case "FALHOU":
        return <Badge className="bg-red-600 text-white hover:bg-red-700">FALHOU</Badge>;
      case "SESSAO_CONCLUIDA":
        return <Badge className="bg-blue-600 text-white hover:bg-blue-700">SESSÃO CONCLUÍDA</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="h-8 w-8 text-[#635BFF]" />
        <div>
          <h1 className="text-2xl font-bold">Stripe — Área de Testes</h1>
          <p className="text-sm text-muted-foreground">
            Ambiente isolado para validar a integração Stripe Connect antes da migração
          </p>
        </div>
      </div>

      {/* Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" /> Configuração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="font-medium text-muted-foreground">Connected Account:</span>
              <p className="font-mono text-xs">acct_1TKJLCQqNlxyJH6p (Central Gospel)</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Webhook URL:</span>
              <p className="font-mono text-xs break-all">
                https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/stripe-webhook
              </p>
            </div>
            <div className="md:col-span-2">
              <span className="font-medium text-muted-foreground">Split configurado:</span>
              <p>
                <Badge className="bg-green-600 text-white mr-2">97%</Badge> Central Gospel
                <span className="mx-2">|</span>
                <Badge className="bg-[#635BFF] text-white">3%</Badge> House Comunicação (taxa)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Criar Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5" /> Criar Pagamento de Teste
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Valor em R$</label>
              <Input
                type="number"
                placeholder="100.00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                min="0.01"
                step="0.01"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Descrição do teste</label>
              <Input
                placeholder="Ex: Teste revista trimestral"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleCreatePayment} disabled={loading}>
            {loading ? "Criando..." : "Criar PaymentIntent"}
          </Button>

          {result && (
            <div className="mt-4 p-4 rounded-lg bg-muted border text-sm font-mono space-y-1">
              <p><strong>payment_intent_id:</strong> {result.payment_intent_id}</p>
              <p><strong>Valor total:</strong> {formatBRL(result.amount)}</p>
              <p><strong>Taxa House (3%):</strong> {formatBRL(result.fee_amount)}</p>
              <p><strong>Líquido Central Gospel (97%):</strong> {formatBRL(result.net_amount)}</p>
              <p><strong>Status:</strong> {result.status}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-muted-foreground">client_secret (clique para expandir)</summary>
                <p className="break-all mt-1">{result.client_secret}</p>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListChecks className="h-5 w-5" /> Log de Eventos Webhook
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loadingLogs}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loadingLogs ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Nenhum evento webhook recebido ainda. Configure o webhook no Stripe Dashboard
              apontando para a URL acima.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Payment Intent ID</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Taxa House</TableHead>
                  <TableHead className="text-right">Líquido CG</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Evento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{formatDate(log.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[180px] truncate">
                      {log.payment_intent_id}
                    </TableCell>
                    <TableCell className="text-right">{formatBRL(log.amount)}</TableCell>
                    <TableCell className="text-right">{formatBRL(log.fee_amount)}</TableCell>
                    <TableCell className="text-right">{formatBRL(log.net_amount)}</TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs">{log.stripe_event}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Próximos Passos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowRight className="h-5 w-5" /> Próximos Passos
          </CardTitle>
          <CardDescription>
            Checkouts que serão migrados para Stripe após validação desta integração
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm list-decimal list-inside">
            <li>
              <span className="font-medium">/ebd/checkout-shopify-mp</span>{" "}
              <span className="text-muted-foreground">(CheckoutShopifyMP.tsx) — Checkout principal de propostas</span>
            </li>
            <li>
              <span className="font-medium">/proposta/:token</span>{" "}
              <span className="text-muted-foreground">(PropostaDigital.tsx) — Redirecionamento de propostas digitais</span>
            </li>
            <li>
              <span className="font-medium">/admin/ebd/checkout</span>{" "}
              <span className="text-muted-foreground">(Checkout legado) — Checkout administrativo EBD</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
