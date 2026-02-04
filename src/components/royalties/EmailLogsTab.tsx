import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, Search, CheckCircle, XCircle, Clock } from "lucide-react";

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
  template: {
    nome: string;
    codigo: string;
  } | null;
  autor: {
    nome_completo: string;
  } | null;
}

export function EmailLogsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
        .limit(100);

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

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "enviado":
        return (
          <Badge variant="default">
            <CheckCircle className="h-3 w-3 mr-1" />
            Enviado
          </Badge>
        );
      case "erro":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Envios
        </CardTitle>
        <CardDescription>
          Veja todos os emails enviados para autores
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por destinatário, assunto ou autor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="erro">Erro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredLogs?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum email encontrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>{log.autor?.nome_completo || "-"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {log.destinatario}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.template?.nome || "-"}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {log.assunto}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(log.status)}
                    {log.erro && (
                      <p className="text-xs text-destructive mt-1 max-w-xs truncate">
                        {log.erro}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
