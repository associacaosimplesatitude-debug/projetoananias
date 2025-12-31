import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ShoppingCart, 
  UserPlus,
  Play,
  Search,
  Percent,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CadastrarClienteDialog } from "@/components/vendedor/CadastrarClienteDialog";
import { DescontoFaturamentoDialog } from "@/components/vendedor/DescontoFaturamentoDialog";
import { LancamentoManualRevistaDialog } from "@/components/vendedor/LancamentoManualRevistaDialog";
import { ClienteCard } from "@/components/ebd/ClienteCard";
import { useVendedor } from "@/hooks/useVendedor";
import { toast } from "sonner";

interface Cliente {
  id: string;
  cnpj: string;
  cpf: string | null;
  nome_igreja: string;
  nome_responsavel: string | null;
  nome_superintendente: string | null;
  email_superintendente: string | null;
  telefone: string | null;
  dia_aula: string | null;
  data_inicio_ebd: string | null;
  data_proxima_compra: string | null;
  status_ativacao_ebd: boolean;
  ultimo_login: string | null;
  data_aniversario_pastor: string | null;
  data_aniversario_superintendente: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  tipo_cliente: string | null;
  possui_cnpj: boolean | null;
  endereco_cep: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  senha_temporaria: string | null;
  pode_faturar: boolean;
  desconto_faturamento: number | null;
  cupom_aniversario_usado: boolean | null;
  cupom_aniversario_ano: number | null;
}

export default function VendedorClientes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { vendedor, isLoading: vendedorLoading } = useVendedor();
  const [cadastrarClienteOpen, setCadastrarClienteOpen] = useState(false);
  const [clienteParaEditar, setClienteParaEditar] = useState<Cliente | null>(null);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | null>(null);
  const [clienteParaDesconto, setClienteParaDesconto] = useState<Cliente | null>(null);
  const [clienteParaLancamento, setClienteParaLancamento] = useState<Cliente | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");

  const { data: clientes = [], isLoading: clientesLoading } = useQuery({
    queryKey: ["vendedor-clientes", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];

      const { data: ebdClientesData, error: ebdClientesError } = await supabase
        .from("ebd_clientes")
        .select("*")
        .eq("vendedor_id", vendedor.id)
        .order("created_at", { ascending: false });
      if (ebdClientesError) throw ebdClientesError;

      const { data: assinaturasData, error: assinaturasError } = await supabase
        .from("assinaturas")
        .select(`
          cliente_id,
          church:churches(id, church_name, city, state, vendedor_id)
        `)
        .eq("status", "Ativo");
      if (assinaturasError) throw assinaturasError;

      const fromAssinaturas = (assinaturasData || [])
        .filter((row: any) => row?.church?.vendedor_id === vendedor.id)
        .map((row: any) => {
          const c = row.church;
          return {
            id: c.id,
            cnpj: "",
            cpf: null,
            nome_igreja: c.church_name,
            nome_responsavel: null,
            nome_superintendente: null,
            email_superintendente: null,
            telefone: null,
            dia_aula: null,
            data_inicio_ebd: null,
            data_proxima_compra: null,
            status_ativacao_ebd: true,
            ultimo_login: null,
            data_aniversario_pastor: null,
            data_aniversario_superintendente: null,
            endereco_cidade: c.city ?? null,
            endereco_estado: c.state ?? null,
            tipo_cliente: "Módulo EBD",
            possui_cnpj: null,
            endereco_cep: null,
            endereco_rua: null,
            endereco_numero: null,
            endereco_complemento: null,
            endereco_bairro: null,
            senha_temporaria: null,
            pode_faturar: false,
            desconto_faturamento: null,
            cupom_aniversario_usado: null,
            cupom_aniversario_ano: null,
          } as Cliente;
        });

      const ebdClientesIds = new Set((ebdClientesData || []).map((c: any) => c.id));
      const merged = [
        ...(ebdClientesData || []),
        ...fromAssinaturas.filter((c) => !ebdClientesIds.has(c.id)),
      ];

      return merged as Cliente[];
    },
    enabled: !!vendedor?.id,
  });

  // Fetch credits for all clients
  const clienteIds = clientes.map(c => c.id);
  const { data: creditos = [] } = useQuery({
    queryKey: ["clientes-creditos", clienteIds],
    queryFn: async () => {
      if (clienteIds.length === 0) return [];
      const { data, error } = await supabase
        .from("ebd_creditos")
        .select("*")
        .in("cliente_id", clienteIds);
      if (error) throw error;
      return data;
    },
    enabled: clienteIds.length > 0,
  });

  // Calculate credits per client
  const getCreditosForCliente = (clienteId: string) => {
    const clienteCreditos = creditos.filter(c => c.cliente_id === clienteId);
    const disponiveis = clienteCreditos
      .filter(c => !c.usado && (!c.validade || new Date(c.validade) >= new Date()))
      .reduce((sum, c) => sum + Number(c.valor), 0);
    const usados = clienteCreditos
      .filter(c => c.usado)
      .reduce((sum, c) => sum + Number(c.valor), 0);
    return { disponiveis, usados };
  };

  const loading = vendedorLoading || clientesLoading;

  const handleFazerPedido = (cliente: Cliente) => {
    navigate(`/vendedor/shopify?clienteId=${cliente.id}&clienteNome=${encodeURIComponent(cliente.nome_igreja)}`);
  };

  const handleAtivarPainel = (cliente: Cliente) => {
    navigate(`/vendedor/ativacao?clienteId=${cliente.id}&clienteNome=${encodeURIComponent(cliente.nome_igreja)}`);
  };

  const handleEditarCliente = (cliente: Cliente) => {
    setClienteParaEditar(cliente);
    setCadastrarClienteOpen(true);
  };

  const handleExcluirCliente = async () => {
    if (!clienteParaExcluir) return;
    setExcluindo(true);
    try {
      const { count: ordersCount } = await supabase
        .from("ebd_shopify_pedidos")
        .select("*", { count: "exact", head: true })
        .eq("cliente_id", clienteParaExcluir.id);
      
      if (ordersCount && ordersCount > 0) {
        toast.error("Não é possível excluir este cliente pois ele possui pedidos registrados.");
        setExcluindo(false);
        setClienteParaExcluir(null);
        return;
      }

      const { error } = await supabase
        .from("ebd_clientes")
        .delete()
        .eq("id", clienteParaExcluir.id);
      if (error) throw error;
      toast.success("Cliente excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["vendedor-clientes", vendedor?.id] });
      setClienteParaExcluir(null);
    } catch (error: any) {
      console.error("Error deleting cliente:", error);
      if (error?.code === '23503') {
        toast.error("Não é possível excluir este cliente pois ele possui registros vinculados.");
      } else {
        toast.error("Erro ao excluir cliente. Verifique se não há dados vinculados.");
      }
    } finally {
      setExcluindo(false);
    }
  };

  const estadosUnicos = [...new Set(clientes.map(c => c.endereco_estado).filter(Boolean))].sort();

  const filteredClientes = clientes.filter((cliente) => {
    const matchesSearch = 
      cliente.nome_igreja.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cliente.nome_responsavel?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (cliente.nome_superintendente?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (cliente.cnpj?.includes(searchTerm) ?? false) ||
      (cliente.cpf?.includes(searchTerm) ?? false);

    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "ativo" && cliente.status_ativacao_ebd) ||
      (statusFilter === "pendente" && !cliente.status_ativacao_ebd);

    const matchesEstado = 
      estadoFilter === "all" ||
      cliente.endereco_estado === estadoFilter;

    return matchesSearch && matchesStatus && matchesEstado;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clientes</h2>
          <p className="text-muted-foreground">Lista completa de clientes na sua carteira</p>
        </div>
        <Button onClick={() => setCadastrarClienteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, responsável, CNPJ/CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Estados</SelectItem>
                {estadosUnicos.map((estado) => (
                  <SelectItem key={estado} value={estado!}>{estado}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredClientes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {clientes.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum cliente encontrado com os filtros selecionados"}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClientes.map((cliente) => (
                <div key={cliente.id} className="relative">
                  <ClienteCard
                    cliente={{
                      id: cliente.id,
                      nome_igreja: cliente.nome_igreja,
                      nome_responsavel: cliente.nome_responsavel,
                      nome_superintendente: cliente.nome_superintendente,
                      endereco_cidade: cliente.endereco_cidade,
                      endereco_estado: cliente.endereco_estado,
                      cnpj: cliente.cnpj,
                      cpf: cliente.cpf,
                      status_ativacao_ebd: cliente.status_ativacao_ebd,
                      tipo_cliente: cliente.tipo_cliente,
                      data_aniversario_pastor: cliente.data_aniversario_pastor,
                      data_aniversario_superintendente: cliente.data_aniversario_superintendente,
                      cupom_aniversario_usado: cliente.cupom_aniversario_usado,
                      cupom_aniversario_ano: cliente.cupom_aniversario_ano,
                    }}
                    creditos={getCreditosForCliente(cliente.id)}
                    onEdit={() => handleEditarCliente(cliente)}
                    onLancamentoManual={() => setClienteParaLancamento(cliente)}
                    isAdmin={false}
                  />
                  {/* Action buttons overlay */}
                  <div className="absolute bottom-14 right-4 flex gap-1">
                    {cliente.pode_faturar && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setClienteParaDesconto(cliente)}
                        title="Configurar desconto de faturamento"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Percent className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFazerPedido(cliente)}
                      className="h-8"
                    >
                      <ShoppingCart className="mr-1 h-4 w-4" />
                      Pedido
                    </Button>
                    {!cliente.status_ativacao_ebd && (
                      <Button
                        size="sm"
                        onClick={() => handleAtivarPainel(cliente)}
                        className="h-8"
                      >
                        <Play className="mr-1 h-4 w-4" />
                        Ativar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CadastrarClienteDialog
        open={cadastrarClienteOpen}
        onOpenChange={(open) => {
          setCadastrarClienteOpen(open);
          if (!open) setClienteParaEditar(null);
        }}
        vendedorId={vendedor?.id || ""}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["vendedor-clientes", vendedor?.id] })}
        clienteParaEditar={clienteParaEditar}
      />

      <DescontoFaturamentoDialog
        open={!!clienteParaDesconto}
        onOpenChange={(open) => !open && setClienteParaDesconto(null)}
        cliente={clienteParaDesconto}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["vendedor-clientes", vendedor?.id] })}
      />

      <LancamentoManualRevistaDialog
        open={!!clienteParaLancamento}
        onOpenChange={(open) => !open && setClienteParaLancamento(null)}
        clienteId={clienteParaLancamento?.id || ""}
        clienteNome={clienteParaLancamento?.nome_igreja || ""}
      />

      <AlertDialog open={!!clienteParaExcluir} onOpenChange={(open) => !open && setClienteParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente "{clienteParaExcluir?.nome_igreja}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirCliente} disabled={excluindo}>
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
