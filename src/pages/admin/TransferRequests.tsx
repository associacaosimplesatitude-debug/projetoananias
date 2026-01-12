import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowRightLeft, 
  Check, 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle,
  User,
  Building2,
  Loader2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TransferRequest {
  id: string;
  cliente_id: string;
  vendedor_solicitante_id: string;
  vendedor_atual_id: string | null;
  status: string;
  motivo_solicitacao: string | null;
  motivo_rejeicao: string | null;
  created_at: string;
  resolved_at: string | null;
  cliente: {
    nome_igreja: string;
    cnpj: string | null;
    cpf: string | null;
    email_superintendente: string | null;
  };
  vendedor_solicitante: {
    id: string;
    nome: string;
    email: string;
  };
  vendedor_atual: {
    id: string;
    nome: string;
    email: string;
  } | null;
}

const formatDocument = (cnpj: string | null, cpf: string | null) => {
  const doc = cnpj || cpf || "";
  if (!doc) return "—";
  const numbers = doc.replace(/\D/g, "");
  if (numbers.length === 11) {
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else if (numbers.length === 14) {
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
};

export default function TransferRequests() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pendente");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TransferRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["transfer-requests", activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_transfer_requests")
        .select(`
          *,
          cliente:ebd_clientes!cliente_id(nome_igreja, cnpj, cpf, email_superintendente),
          vendedor_solicitante:vendedores!vendedor_solicitante_id(id, nome, email),
          vendedor_atual:vendedores!vendedor_atual_id(id, nome, email)
        `)
        .eq("status", activeTab)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TransferRequest[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (request: TransferRequest) => {
      setProcessingId(request.id);
      
      // 1. Executar a transferência usando a função RPC
      const { error: transferError } = await supabase.rpc('transfer_cliente_vendedor', {
        _source: 'ebd_clientes',
        _cliente_id: request.cliente_id,
        _vendedor_id: request.vendedor_solicitante_id
      });

      if (transferError) throw transferError;

      // 2. Atualizar status da requisição
      const { error: updateError } = await supabase
        .from("ebd_transfer_requests")
        .update({
          status: "aprovado",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      // 3. Criar notificação para o vendedor solicitante
      await supabase.from("ebd_notifications").insert({
        user_email: request.vendedor_solicitante.email,
        titulo: "Transferência Aprovada! 🎉",
        mensagem: `O cliente "${request.cliente.nome_igreja}" foi transferido para sua carteira.`,
        tipo: "sucesso",
        link: "/vendedor/clientes",
        metadata: { cliente_id: request.cliente_id }
      });

      // 4. Criar notificação para o vendedor anterior (se existir)
      if (request.vendedor_atual) {
        await supabase.from("ebd_notifications").insert({
          user_email: request.vendedor_atual.email,
          titulo: "Cliente Transferido",
          mensagem: `O cliente "${request.cliente.nome_igreja}" foi transferido para ${request.vendedor_solicitante.nome}.`,
          tipo: "aviso",
          metadata: { cliente_id: request.cliente_id }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfer-requests"] });
      toast.success("Transferência aprovada com sucesso!");
      setProcessingId(null);
    },
    onError: (error) => {
      console.error("Erro ao aprovar transferência:", error);
      toast.error("Erro ao aprovar transferência");
      setProcessingId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ request, reason }: { request: TransferRequest; reason: string }) => {
      setProcessingId(request.id);

      // 1. Atualizar status da requisição
      const { error: updateError } = await supabase
        .from("ebd_transfer_requests")
        .update({
          status: "rejeitado",
          motivo_rejeicao: reason || null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      // 2. Criar notificação para o vendedor solicitante
      await supabase.from("ebd_notifications").insert({
        user_email: request.vendedor_solicitante.email,
        titulo: "Solicitação de Transferência Recusada",
        mensagem: reason 
          ? `Sua solicitação para o cliente "${request.cliente.nome_igreja}" foi recusada. Motivo: ${reason}`
          : `Sua solicitação para o cliente "${request.cliente.nome_igreja}" foi recusada.`,
        tipo: "erro",
        metadata: { cliente_id: request.cliente_id }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfer-requests"] });
      toast.success("Solicitação rejeitada");
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectReason("");
      setProcessingId(null);
    },
    onError: (error) => {
      console.error("Erro ao rejeitar transferência:", error);
      toast.error("Erro ao rejeitar transferência");
      setProcessingId(null);
    },
  });

  const handleReject = (request: TransferRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (selectedRequest) {
      rejectMutation.mutate({ request: selectedRequest, reason: rejectReason });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "aprovado":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case "rejeitado":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6" />
          Solicitações de Transferência
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie as solicitações de transferência de clientes entre vendedores
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pendente" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendentes
          </TabsTrigger>
          <TabsTrigger value="aprovado" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Aprovadas
          </TabsTrigger>
          <TabsTrigger value="rejeitado" className="gap-2">
            <XCircle className="h-4 w-4" />
            Rejeitadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ArrowRightLeft className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma solicitação {activeTab === "pendente" ? "pendente" : activeTab === "aprovado" ? "aprovada" : "rejeitada"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          {request.cliente.nome_igreja}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {formatDocument(request.cliente.cnpj, request.cliente.cpf)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(request.status)}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(request.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Vendedor Atual</p>
                          <p className="font-medium">
                            {request.vendedor_atual?.nome || "Sem vendedor"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <User className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-xs text-muted-foreground">Solicitante</p>
                          <p className="font-medium text-primary">
                            {request.vendedor_solicitante.nome}
                          </p>
                        </div>
                      </div>
                    </div>

                    {request.motivo_solicitacao && (
                      <div className="p-3 rounded-lg bg-muted/50 border">
                        <p className="text-xs text-muted-foreground mb-1">Motivo da Solicitação</p>
                        <p className="text-sm">{request.motivo_solicitacao}</p>
                      </div>
                    )}

                    {request.motivo_rejeicao && request.status === "rejeitado" && (
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                        <p className="text-xs text-red-600 dark:text-red-400 mb-1">Motivo da Rejeição</p>
                        <p className="text-sm text-red-700 dark:text-red-300">{request.motivo_rejeicao}</p>
                      </div>
                    )}

                    {activeTab === "pendente" && (
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => handleReject(request)}
                          disabled={processingId === request.id}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Rejeitar
                        </Button>
                        <Button
                          onClick={() => approveMutation.mutate(request)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4 mr-2" />
                          )}
                          Aprovar Transferência
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de Rejeição */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
            <DialogDescription>
              Você está prestes a rejeitar a solicitação de transferência do cliente
              "{selectedRequest?.cliente.nome_igreja}".
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Motivo da rejeição (opcional)
            </label>
            <Textarea
              placeholder="Ex: Cliente já em atendimento ativo, histórico de negociação..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
