import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileText, ExternalLink, AlertCircle } from "lucide-react";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function GoogleAdsDocumentos() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth())); // previous month by default

  const { data, isLoading, error } = useQuery({
    queryKey: ["google-ads-invoices", year, month],
    queryFn: async () => {
      const res = await supabase.functions.invoke("google-ads-dashboard", {
        body: { action: "invoices", year: Number(year), month: Number(month) + 1 },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error && !res.data?.invoices) throw new Error(res.data.error);
      return res.data;
    },
  });

  const invoices = data?.invoices || [];
  const hasData = data?.has_data ?? invoices.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documentos Google Ads</h1>
        <p className="text-muted-foreground">Notas fiscais e orçamentos da conta</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-sm font-medium mb-1 block">Mês</label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Ano</label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025, 2026].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">Erro: {(error as Error).message}</p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !hasData ? (
        /* Fallback when no invoices */
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center py-8 space-y-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-lg">Nenhuma nota fiscal encontrada</h3>
                <p className="text-muted-foreground mt-1">
                  Não foram encontrados registros de orçamentos ou notas fiscais para esta conta no período selecionado.
                  Isso pode ocorrer se a conta utiliza faturamento automático por cartão.
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href="https://ads.google.com/aw/billing/documents" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver documentos no Google Ads
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Orçamentos e Documentos
            </CardTitle>
            <CardDescription>{invoices.length} registro(s) encontrado(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv: any, idx: number) => (
                  <TableRow key={inv.id || idx}>
                    <TableCell className="font-medium">{inv.name}</TableCell>
                    <TableCell>R$ {Number(inv.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{inv.status}</TableCell>
                    <TableCell>{inv.start_date || "—"}</TableCell>
                    <TableCell>{inv.end_date || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
