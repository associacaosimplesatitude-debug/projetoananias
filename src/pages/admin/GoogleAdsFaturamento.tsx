import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, DollarSign, CreditCard, TrendingDown, Receipt } from "lucide-react";

export default function GoogleAdsFaturamento() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["google-ads-billing"],
    queryFn: async () => {
      const res = await supabase.functions.invoke("google-ads-dashboard", {
        body: { action: "billing" },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error && !res.data?.month_cost && res.data.month_cost !== 0) throw new Error(res.data.error);
      return res.data;
    },
  });

  const customerId = data?.customer_id || "";
  const billingUrl = `https://ads.google.com/aw/billing/summary?ocid=${customerId}`;

  const infoCards = [
    {
      icon: DollarSign,
      label: "Custo Líquido do Mês",
      value: data ? `R$ ${Number(data.month_cost).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—",
    },
    {
      icon: CreditCard,
      label: "Status do Faturamento",
      value: data?.billing_setup ? "Aprovado" : "Não configurado",
    },
    {
      icon: Receipt,
      label: "Conta de Pagamento",
      value: data?.billing_setup?.paymentsAccount || "N/A",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Faturamento Google Ads</h1>
        <p className="text-muted-foreground">Resumo financeiro da sua conta</p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">Erro: {(error as Error).message}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {infoCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-xl font-bold">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : card.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Adicionar Fundos
          </CardTitle>
          <CardDescription>
            Para adicionar fundos à sua conta do Google Ads, utilize o painel oficial.
            A adição de fundos não é suportada via API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href={billingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir Faturamento no Google Ads
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
