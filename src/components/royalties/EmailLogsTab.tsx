import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format, subDays, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  History, Search, CheckCircle, XCircle, Clock, Mail, AlertTriangle,
  TrendingUp, ChevronDown, Zap, Hand,
} from "lucide-react";

interface EmailLog {
  id: string;
  template_id: string;
  autor_id: string;
  destinatario: string;
  assunto: string;
  status: string;
  erro: string | null;
  dados_enviados: Record<string, string>;
  created_at: string;
  tipo_envio: string;
  resend_email_id: string | null;
  template: { nome: string; codigo: string } | null;
  autor: { nome_completo: string } | null;
}

function SummaryCards({ logs }: { logs: EmailLog[] }) {
  const total = logs.length;
  const enviados = logs.filter((l) => l.status === "enviado").length;
  const erros = logs.filter((l) => l.status === "erro").length;
  const taxa = total > 0 ? Math.round((enviados / total) * 100) : 0;

  const cards = [
    { label: "Total Enviados", value: total, icon: Mail, color: "text-primary" },
    { label: "Com Sucesso", value: enviados, icon: CheckCircle, color: "text-green-600" },
    { label: "Com Erro", value: erros, icon: AlertTriangle, color: "text-destructive" },
    { label: "Taxa de Sucesso", value: `${taxa}%`, icon: TrendingUp, color: "text-blue-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
              <c.icon className={`h-5 w-5 ${c.color} opacity-70`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LogRow({ log }: { log: EmailLog }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <TableRow className="cursor-pointer" onClick={() => setOpen(!open)}>
        <TableCell className="whitespace-nowrap">
          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </TableCell>
        <TableCell>
          {log.tipo_envio === "automatico" ? (
            <Badge variant="secondary" className="gap-1">
              <Zap className="h-3 w-3" /> Auto
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <Hand className="h-3 w-3" /> Manual
            </Badge>
          )}
        </TableCell>
        <TableCell>{log.autor?.nome_completo || "-"}</TableCell>
        <TableCell className="font-mono text-sm">{log.destinatario}</TableCell>
        <TableCell>
          <Badge variant="outline">{log.template?.nome || "-"}</Badge>
        </TableCell>
        <TableCell className="max-w-xs truncate">{log.assunto}</TableCell>
        <TableCell>
          {log.status === "enviado" ? (
            <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Enviado</Badge>
          ) : log.status === "erro" ? (
            <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>
          ) : (
            <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{log.status}</Badge>
          )}
        </TableCell>
        <TableCell>
          <CollapsibleTrigger asChild>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
        </TableCell>
      </TableRow>
      <CollapsibleContent asChild>
        <tr>
          <td colSpan={8} className="bg-muted/30 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {log.erro && (
                <div className="md:col-span-2">
                  <p className="font-medium text-destructive mb-1">Erro:</p>
                  <p className="text-destructive/80">{log.erro}</p>
                </div>
              )}
              {log.resend_email_id && (
                <div>
                  <p className="font-medium text-muted-foreground">Resend ID:</p>
                  <p className="font-mono text-xs">{log.resend_email_id}</p>
                </div>
              )}
              <div className="md:col-span-2">
                <p className="font-medium text-muted-foreground mb-1">Dados Enviados:</p>
                <pre className="text-xs bg-background rounded p-2 overflow-auto max-h-40">
                  {JSON.stringify(log.dados_enviados, null, 2)}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function EmailLogsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [periodoFilter, setPeriodoFilter] = useState("all");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["royalties-email-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_email_logs")
        .select(`
          *,
          template:royalties_email_templates(nome, codigo),
          autor:royalties_autores(nome_completo)
        `)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as EmailLog[];
    },
  });

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      !searchTerm ||
      log.destinatario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.assunto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.autor?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    const matchesTipo = tipoFilter === "all" || log.tipo_envio === tipoFilter;

    let matchesPeriodo = true;
    if (periodoFilter === "7") {
      matchesPeriodo = isAfter(new Date(log.created_at), subDays(new Date(), 7));
    } else if (periodoFilter === "30") {
      matchesPeriodo = isAfter(new Date(log.created_at), subDays(new Date(), 30));
    }

    return matchesSearch && matchesStatus && matchesTipo && matchesPeriodo;
  }) || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <SummaryCards logs={filteredLogs} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Envios
          </CardTitle>
          <CardDescription>Todos os emails enviados para autores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por destinatário, assunto ou autor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="automatico">Automático</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo período</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum email encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
