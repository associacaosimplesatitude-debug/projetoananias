import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck, 
  XCircle,
  Search,
  Eye,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface ResgateItem {
  produto_id: string;
  titulo: string;
  quantidade: number;
  valor_unitario: number;
  desconto_aplicado: number;
  sku?: string;
}

interface Resgate {
  id: string;
  autor_id: string;
  data_solicitacao: string;
  status: string;
  valor_total: number;
  itens: ResgateItem[];
  endereco_entrega: any;
  observacoes: string | null;
  bling_order_id: string | null;
  bling_order_number: string | null;
  created_at: string;
  autor: {
    nome_completo: string;
    email: string;
  };
}

const statusConfig = {
  pendente: { label: "Pendente", icon: Clock, variant: "secondary" as const, color: "text-yellow-600" },
  aprovado: { label: "Aprovado", icon: CheckCircle2, variant: "default" as const, color: "text-blue-600" },
  enviado: { label: "Enviado", icon: Truck, variant: "default" as const, color: "text-green-600" },
  cancelado: { label: "Cancelado", icon: XCircle, variant: "destructive" as const, color: "text-red-600" },
};

export default function Resgates() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedResgate, setSelectedResgate] = useState<Resgate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  const { data: resgates, isLoading } = useQuery({
    queryKey: ["royalties-resgates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_resgates")
        .select(`
          *,
          autor:royalties_autores(nome_completo, email)
        `)
        .order("data_solicitacao", { ascending: false });

      if (error) throw error;
      return data as unknown as Resgate[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, obs }: { id: string; status: string; obs?: string }) => {
      const payload: any = { status };
      if (obs !== undefined) payload.observacoes = obs;
      
      const { error } = await supabase
        .from("royalties_resgates")
        .update(payload)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["royalties-resgates"] });
      toast.success("Status atualizado!");
      setDialogOpen(false);
      setSelectedResgate(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar status", { description: error.message });
    },
  });

  // Mutation para aprovar resgate e criar pedido no Bling
  const aprovarResgateMutation = useMutation({
    mutationFn: async ({ id, obs }: { id: string; obs?: string }) => {
      // Primeiro salvar observações se houver
      if (obs) {
        const { error: obsError } = await supabase
          .from("royalties_resgates")
          .update({ observacoes: obs })
          .eq("id", id);
        
        if (obsError) {
          console.warn("Erro ao salvar observações:", obsError);
        }
      }

      // Chamar edge function para aprovar e criar pedido no Bling
      const { data, error } = await supabase.functions.invoke('aprovar-resgate', {
        body: { resgate_id: id }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao aprovar resgate');

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["royalties-resgates"] });
      toast.success("Resgate aprovado!", {
        description: `Pedido Bling: ${data.bling_order_number}`
      });
      setDialogOpen(false);
      setSelectedResgate(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao aprovar resgate", { description: error.message });
    },
  });

  const filteredResgates = resgates?.filter((r) => {
    const matchesSearch = r.autor?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "todos" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: resgates?.length || 0,
    pendentes: resgates?.filter((r) => r.status === "pendente").length || 0,
    aprovados: resgates?.filter((r) => r.status === "aprovado").length || 0,
    enviados: resgates?.filter((r) => r.status === "enviado").length || 0,
  };

  const openDetails = (resgate: Resgate) => {
    setSelectedResgate(resgate);
    setObservacoes(resgate.observacoes || "");
    setDialogOpen(true);
  };

  const handleStatusChange = (novoStatus: string) => {
    if (!selectedResgate) return;
    updateStatusMutation.mutate({ 
      id: selectedResgate.id, 
      status: novoStatus, 
      obs: observacoes 
    });
  };

  const handleAprovarResgate = () => {
    if (!selectedResgate) return;
    aprovarResgateMutation.mutate({ 
      id: selectedResgate.id, 
      obs: observacoes 
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestão de Resgates</h1>
        <p className="text-muted-foreground">
          Gerencie as solicitações de troca de royalties por produtos.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span className="text-2xl font-bold">{stats.pendentes}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aprovados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold">{stats.aprovados}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Enviados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">{stats.enviados}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por autor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredResgates?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum resgate encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Autor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pedido Bling</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResgates?.map((resgate) => {
                  const config = statusConfig[resgate.status as keyof typeof statusConfig];
                  const Icon = config?.icon || Clock;
                  return (
                    <TableRow key={resgate.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{resgate.autor?.nome_completo}</p>
                          <p className="text-sm text-muted-foreground">{resgate.autor?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(resgate.data_solicitacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {Array.isArray(resgate.itens) ? resgate.itens.length : 0} produto(s)
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(resgate.valor_total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={config?.variant} className="gap-1">
                          <Icon className="h-3 w-3" />
                          {config?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {resgate.bling_order_number ? (
                          <span className="font-mono text-sm text-blue-600">
                            #{resgate.bling_order_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetails(resgate)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Resgate</DialogTitle>
          </DialogHeader>

          {selectedResgate && (
            <div className="space-y-6">
              {/* Autor Info */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Autor</h4>
                <p className="font-medium">{selectedResgate.autor?.nome_completo}</p>
                <p className="text-sm text-muted-foreground">{selectedResgate.autor?.email}</p>
              </div>

              {/* Itens */}
              <div>
                <h4 className="font-medium mb-3">Itens do Resgate</h4>
                <div className="space-y-2">
                  {Array.isArray(selectedResgate.itens) && selectedResgate.itens.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="font-medium">{item.titulo}</p>
                        <p className="text-sm text-muted-foreground">
                          Qtd: {item.quantidade} × {formatCurrency(item.valor_unitario)}
                          {item.desconto_aplicado > 0 && (
                            <span className="text-green-600 ml-2">
                              ({item.desconto_aplicado}% OFF)
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="font-medium">
                        {formatCurrency(item.quantidade * item.valor_unitario * (1 - item.desconto_aplicado / 100))}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-bold">{formatCurrency(selectedResgate.valor_total)}</span>
                </div>
              </div>

              {/* Endereço */}
              {selectedResgate.endereco_entrega && (
                <div>
                  <h4 className="font-medium mb-2">Endereço de Entrega</h4>
                  <div className="p-3 bg-muted/30 rounded-lg text-sm">
                    {selectedResgate.endereco_entrega.rua}, {selectedResgate.endereco_entrega.numero}
                    {selectedResgate.endereco_entrega.complemento && ` - ${selectedResgate.endereco_entrega.complemento}`}
                    <br />
                    {selectedResgate.endereco_entrega.bairro} - {selectedResgate.endereco_entrega.cidade}/{selectedResgate.endereco_entrega.estado}
                    <br />
                    CEP: {selectedResgate.endereco_entrega.cep}
                  </div>
                </div>
              )}

              {/* Observações */}
              <div>
                <h4 className="font-medium mb-2">Observações</h4>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Adicione observações sobre o resgate..."
                  rows={3}
                />
              </div>

              {/* Pedido Bling */}
              {selectedResgate.bling_order_number && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium mb-2 text-blue-800">Pedido Bling</h4>
                  <p className="text-blue-700 font-mono text-lg">
                    #{selectedResgate.bling_order_number}
                  </p>
                </div>
              )}

              {/* Status Actions */}
              <div>
                <h4 className="font-medium mb-3">Alterar Status</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedResgate.status === "pendente" && (
                    <>
                      <Button 
                        onClick={handleAprovarResgate}
                        disabled={aprovarResgateMutation.isPending || updateStatusMutation.isPending}
                        className="gap-2"
                      >
                        {aprovarResgateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        {aprovarResgateMutation.isPending ? "Processando..." : "Aprovar e Criar Pedido Bling"}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleStatusChange("cancelado")}
                        disabled={aprovarResgateMutation.isPending || updateStatusMutation.isPending}
                        className="gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Cancelar
                      </Button>
                    </>
                  )}
                  {selectedResgate.status === "aprovado" && (
                    <>
                      <Button 
                        onClick={() => handleStatusChange("enviado")}
                        disabled={updateStatusMutation.isPending}
                        className="gap-2"
                      >
                        <Truck className="h-4 w-4" />
                        Marcar como Enviado
                      </Button>
                      {selectedResgate.bling_order_number && (
                        <p className="text-sm text-muted-foreground self-center">
                          Pedido Bling: #{selectedResgate.bling_order_number}
                        </p>
                      )}
                    </>
                  )}
                  {(selectedResgate.status === "enviado" || selectedResgate.status === "cancelado") && (
                    <p className="text-sm text-muted-foreground">
                      Este resgate já foi {selectedResgate.status === "enviado" ? "enviado" : "cancelado"}.
                      {selectedResgate.bling_order_number && ` (Pedido Bling: #${selectedResgate.bling_order_number})`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
