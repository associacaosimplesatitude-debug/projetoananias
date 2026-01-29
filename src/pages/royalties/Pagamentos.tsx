import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, CheckCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PagamentoDialog } from "@/components/royalties/PagamentoDialog";
import { ComprovanteUpload } from "@/components/royalties/ComprovanteUpload";
import { useToast } from "@/hooks/use-toast";

export default function RoyaltiesPagamentos() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ["royalties-pagamentos", search],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_pagamentos")
        .select(`
          *,
          royalties_autores (nome_completo, email)
        `)
        .order("data_prevista", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusVariant = (status: string | null) => {
    switch (status) {
      case "pago":
        return "default";
      case "pendente":
        return "secondary";
      case "cancelado":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case "pago":
        return "Pago";
      case "pendente":
        return "Pendente";
      case "cancelado":
        return "Cancelado";
      default:
        return status || "Pendente";
    }
  };

  const handleMarcarPago = async (pagamentoId: string) => {
    try {
      const { error } = await supabase
        .from("royalties_pagamentos")
        .update({
          status: "pago",
          data_efetivacao: new Date().toISOString().split("T")[0],
        })
        .eq("id", pagamentoId);

      if (error) throw error;

      toast({ title: "Pagamento marcado como pago!" });
      queryClient.invalidateQueries({ queryKey: ["royalties-pagamentos"] });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar pagamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleComprovanteUpload = async (pagamentoId: string, url: string) => {
    try {
      const { error } = await supabase
        .from("royalties_pagamentos")
        .update({ comprovante_url: url })
        .eq("id", pagamentoId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["royalties-pagamentos"] });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar comprovante",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleComprovanteRemove = async (pagamentoId: string) => {
    try {
      const { error } = await supabase
        .from("royalties_pagamentos")
        .update({ comprovante_url: null })
        .eq("id", pagamentoId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["royalties-pagamentos"] });
    } catch (error: any) {
      toast({
        title: "Erro ao remover comprovante",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pagamentos</h1>
          <p className="text-muted-foreground">
            Gerencie os pagamentos de royalties aos autores
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Pagamento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pagamentos</CardTitle>
          <CardDescription>
            {pagamentos.length} pagamentos registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por autor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : pagamentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum pagamento encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Autor</TableHead>
                  <TableHead>Data Prevista</TableHead>
                  <TableHead>Data Efetivação</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comprovante</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentos.map((pagamento: any) => (
                  <TableRow key={pagamento.id}>
                    <TableCell className="font-medium">
                      {pagamento.royalties_autores?.nome_completo || "-"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(pagamento.data_prevista), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {pagamento.data_efetivacao 
                        ? format(new Date(pagamento.data_efetivacao), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(pagamento.valor_total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(pagamento.status)}>
                        {getStatusLabel(pagamento.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ComprovanteUpload
                        pagamentoId={pagamento.id}
                        currentUrl={pagamento.comprovante_url}
                        onUpload={(url) => handleComprovanteUpload(pagamento.id, url)}
                        onRemove={() => handleComprovanteRemove(pagamento.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {pagamento.status === "pendente" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarcarPago(pagamento.id)}
                          title="Marcar como pago"
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PagamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
