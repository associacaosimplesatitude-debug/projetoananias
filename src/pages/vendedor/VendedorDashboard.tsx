import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Users, 
  ShoppingCart, 
  AlertTriangle, 
  Gift,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Target,
  UserPlus,
  Play,
  MapPin,
  Pencil,
  Trash2
} from "lucide-react";
import { format, differenceInDays, isThisMonth, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CadastrarClienteDialog } from "@/components/vendedor/CadastrarClienteDialog";
import { VendedorPedidosTab } from "@/components/vendedor/VendedorPedidosTab";
import { VendedorLeadsTab } from "@/components/vendedor/VendedorLeadsTab";
import { UserProfileDropdown } from "@/components/layout/UserProfileDropdown";
import { LeadScoringKPIs } from "@/components/leads/LeadScoringKPIs";
import { toast } from "sonner";

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  email_bling: string | null;
  comissao_percentual: number;
  meta_mensal_valor: number;
}

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
}

export default function VendedorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cadastrarClienteOpen, setCadastrarClienteOpen] = useState(false);
  const [clienteParaEditar, setClienteParaEditar] = useState<Cliente | null>(null);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const { data: vendedor, isLoading: vendedorLoading, refetch } = useQuery({
    queryKey: ["vendedor", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;

      const { data, error } = await supabase
        .from("vendedores")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();

      if (error) throw error;
      return data as Vendedor | null;
    },
    enabled: !!user?.email,
  });

  const { data: clientes = [], isLoading: clientesLoading } = useQuery({
    queryKey: ["vendedor-clientes", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];

      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("*")
        .eq("vendedor_id", vendedor.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Cliente[];
    },
    enabled: !!vendedor?.id,
  });

  // Fetch sales data for the current month
  const { data: vendasMes = 0 } = useQuery({
    queryKey: ["vendedor-vendas-mes", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return 0;

      const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const fimMes = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id")
        .eq("vendedor_id", vendedor.id)
        .eq("status_ativacao_ebd", true)
        .gte("data_inicio_ebd", inicioMes)
        .lte("data_inicio_ebd", fimMes);

      if (error) return 0;
      return (data?.length || 0) * 500;
    },
    enabled: !!vendedor?.id,
  });

  const loading = authLoading || vendedorLoading || clientesLoading;

  const fetchVendedorData = () => {
    refetch();
    // Also invalidate the clients query to refresh the list
    queryClient.invalidateQueries({ queryKey: ["vendedor-clientes", vendedor?.id] });
  };

  const clientesPendentes = clientes.filter(c => !c.status_ativacao_ebd);
  const clientesAtivos = clientes.filter(c => c.status_ativacao_ebd);
  
  const clientesProximaCompra = clientesAtivos
    .filter(c => c.data_proxima_compra)
    .sort((a, b) => {
      const dateA = new Date(a.data_proxima_compra!);
      const dateB = new Date(b.data_proxima_compra!);
      return dateA.getTime() - dateB.getTime();
    });

  const aniversariantes = clientes.filter(c => {
    const pastorBday = c.data_aniversario_pastor ? parseISO(c.data_aniversario_pastor) : null;
    const supBday = c.data_aniversario_superintendente ? parseISO(c.data_aniversario_superintendente) : null;
    return (pastorBday && isThisMonth(pastorBday)) || (supBday && isThisMonth(supBday));
  });

  const clientesRisco = clientesAtivos.filter(c => {
    if (!c.ultimo_login) return true;
    const diasSemLogin = differenceInDays(new Date(), new Date(c.ultimo_login));
    return diasSemLogin > 30;
  });

  // Navigate to catalog page for order
  const handleFazerPedido = (cliente: Cliente) => {
    navigate(`/vendedor/catalogo?clienteId=${cliente.id}&clienteNome=${encodeURIComponent(cliente.nome_igreja)}`);
  };

  // Navigate to activation page
  const handleAtivarPainel = (cliente: Cliente) => {
    navigate(`/vendedor/ativacao?clienteId=${cliente.id}&clienteNome=${encodeURIComponent(cliente.nome_igreja)}`);
  };

  // Edit client
  const handleEditarCliente = (cliente: Cliente) => {
    setClienteParaEditar(cliente);
    setCadastrarClienteOpen(true);
  };

  // Delete client
  const handleExcluirCliente = async () => {
    if (!clienteParaExcluir) return;
    
    setExcluindo(true);
    try {
      const { error } = await supabase
        .from("ebd_clientes")
        .delete()
        .eq("id", clienteParaExcluir.id);

      if (error) throw error;

      toast.success("Cliente excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["vendedor-clientes", vendedor?.id] });
      setClienteParaExcluir(null);
    } catch (error) {
      console.error("Error deleting cliente:", error);
      toast.error("Erro ao excluir cliente");
    } finally {
      setExcluindo(false);
    }
  };

  const formatDocumento = (cliente: Cliente) => {
    const doc = cliente.cnpj || cliente.cpf || "";
    if (doc.length === 14) {
      return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    } else if (doc.length === 11) {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return doc;
  };

  const getLocalizacao = (cliente: Cliente) => {
    if (cliente.endereco_cidade && cliente.endereco_estado) {
      return `${cliente.endereco_cidade}/${cliente.endereco_estado}`;
    }
    return "-";
  };

  // Calculate KPIs
  const comissaoMes = vendasMes * ((vendedor?.comissao_percentual || 0) / 100);
  const metaMensal = vendedor?.meta_mensal_valor || 0;
  const progressoMeta = metaMensal > 0 ? Math.min((vendasMes / metaMensal) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!vendedor) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Painel do Vendedor</h2>
            <p className="text-muted-foreground">
              Você ainda não está cadastrado como vendedor no sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Painel do Vendedor</h1>
          <p className="text-muted-foreground">
            Bem-vindo, {vendedor?.nome}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            size="lg"
            onClick={() => setCadastrarClienteOpen(true)}
          >
            <UserPlus className="mr-2 h-5 w-5" />
            Cadastrar Novo Cliente
          </Button>
          <UserProfileDropdown />
        </div>
      </div>

      {/* Dashboard Cards - Row 1: Client Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientes.length}</div>
            <p className="text-xs text-muted-foreground">
              {clientesAtivos.length} ativos, {clientesPendentes.length} pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes de Ativação</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientesPendentes.length}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando ativação do Painel EBD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aniversariantes</CardTitle>
            <Gift className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aniversariantes.length}</div>
            <p className="text-xs text-muted-foreground">
              Este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes em Risco</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientesRisco.length}</div>
            <p className="text-xs text-muted-foreground">
              Sem login há mais de 30 dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Cards - Row 2: Sales KPIs */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Comissão Acumulada no Mês
            </CardTitle>
            <DollarSign className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
              R$ {comissaoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Vendas do mês: R$ {vendasMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} 
              × {vendedor?.comissao_percentual || 0}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Progresso da Meta
            </CardTitle>
            <Target className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                {progressoMeta.toFixed(1)}%
              </span>
              <span className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                da meta
              </span>
            </div>
            <Progress value={progressoMeta} className="h-3 bg-blue-100 dark:bg-blue-900" />
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              R$ {vendasMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de R$ {metaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lead Scoring KPIs */}
      <LeadScoringKPIs vendedorId={vendedor.id} />

      {/* Tabs with Client Lists */}
      <Tabs defaultValue="clientes" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="clientes">
            Clientes ({clientes.length})
          </TabsTrigger>
          <TabsTrigger value="pendentes">
            Pendentes ({clientesPendentes.length})
          </TabsTrigger>
          <TabsTrigger value="proxima-compra">
            Próximas Compras ({clientesProximaCompra.length})
          </TabsTrigger>
          <TabsTrigger value="risco">
            Em Risco ({clientesRisco.length})
          </TabsTrigger>
          <TabsTrigger value="leads">
            Leads
          </TabsTrigger>
          <TabsTrigger value="pedidos">
            Pedidos
          </TabsTrigger>
        </TabsList>

        {/* Tab: Todos os Clientes */}
        <TabsContent value="clientes">
          <Card>
            <CardHeader>
              <CardTitle>Todos os Clientes</CardTitle>
              <CardDescription>
                Lista completa de clientes na sua carteira
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum cliente cadastrado
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>CNPJ/CPF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientes.map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium">{cliente.nome_igreja}</TableCell>
                        <TableCell>{cliente.nome_responsavel || cliente.nome_superintendente || "-"}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {getLocalizacao(cliente)}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{formatDocumento(cliente)}</TableCell>
                        <TableCell>
                          {cliente.status_ativacao_ebd ? (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="mr-1 h-3 w-3" />
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditarCliente(cliente)}
                              title="Editar cliente"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setClienteParaExcluir(cliente)}
                              title="Excluir cliente"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFazerPedido(cliente)}
                            >
                              <ShoppingCart className="mr-1 h-4 w-4" />
                              FAZER PEDIDO
                            </Button>
                            {!cliente.status_ativacao_ebd && (
                              <Button
                                size="sm"
                                onClick={() => handleAtivarPainel(cliente)}
                              >
                                <Play className="mr-1 h-4 w-4" />
                                ATIVAR PAINEL EBD
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Pendentes de Ativação */}
        <TabsContent value="pendentes">
          <Card>
            <CardHeader>
              <CardTitle>Clientes Pendentes de Ativação</CardTitle>
              <CardDescription>
                Clientes que ainda não tiveram o Painel EBD ativado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientesPendentes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum cliente pendente de ativação
                </p>
              ) : (
                <div className="space-y-4">
                  {clientesPendentes.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{cliente.nome_igreja}</p>
                        <p className="text-sm text-muted-foreground">
                          {cliente.nome_responsavel || cliente.nome_superintendente || "Sem responsável"}
                        </p>
                        {cliente.email_superintendente && (
                          <p className="text-sm text-muted-foreground">
                            {cliente.email_superintendente}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleFazerPedido(cliente)}
                        >
                          <ShoppingCart className="mr-1 h-4 w-4" />
                          FAZER PEDIDO
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleAtivarPainel(cliente)}
                        >
                          <Play className="mr-1 h-4 w-4" />
                          ATIVAR PAINEL EBD
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Próximas Compras */}
        <TabsContent value="proxima-compra">
          <Card>
            <CardHeader>
              <CardTitle>Próximas Compras Previstas</CardTitle>
              <CardDescription>
                Clientes ordenados por data prevista da próxima compra
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientesProximaCompra.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma previsão de compra
                </p>
              ) : (
                <div className="space-y-4">
                  {clientesProximaCompra.map((cliente) => {
                    const diasRestantes = differenceInDays(
                      new Date(cliente.data_proxima_compra!),
                      new Date()
                    );
                    const isUrgent = diasRestantes <= 7;
                    const isWarning = diasRestantes <= 14;

                    return (
                      <div
                        key={cliente.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">{cliente.nome_igreja}</p>
                          <p className="text-sm text-muted-foreground">
                            {cliente.nome_superintendente || cliente.email_superintendente || "Sem contato"}
                          </p>
                          {cliente.telefone && (
                            <p className="text-sm text-muted-foreground">
                              {cliente.telefone}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right space-y-1">
                            <Badge
                              variant={isUrgent ? "destructive" : isWarning ? "secondary" : "outline"}
                            >
                              {diasRestantes < 0
                                ? `${Math.abs(diasRestantes)} dias atrasado`
                                : diasRestantes === 0
                                ? "Hoje!"
                                : `Em ${diasRestantes} dias`}
                            </Badge>
                            <p className="text-sm font-medium">
                              {format(new Date(cliente.data_proxima_compra!), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                          <Button 
                            size="sm"
                            onClick={() => handleFazerPedido(cliente)}
                          >
                            <ShoppingCart className="mr-1 h-4 w-4" />
                            FAZER PEDIDO
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Em Risco */}
        <TabsContent value="risco">
          <Card>
            <CardHeader>
              <CardTitle>Clientes em Risco</CardTitle>
              <CardDescription>
                Clientes sem login há mais de 30 dias - requerem atenção
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientesRisco.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum cliente em risco
                </p>
              ) : (
                <div className="space-y-4">
                  {clientesRisco.map((cliente) => {
                    const diasSemLogin = cliente.ultimo_login
                      ? differenceInDays(new Date(), new Date(cliente.ultimo_login))
                      : null;

                    return (
                      <div
                        key={cliente.id}
                        className="flex items-center justify-between p-4 border rounded-lg border-destructive/50 bg-destructive/5"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">{cliente.nome_igreja}</p>
                          <p className="text-sm text-muted-foreground">
                            {cliente.email_superintendente}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {diasSemLogin
                              ? `${diasSemLogin} dias sem login`
                              : "Nunca logou"}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFazerPedido(cliente)}
                          >
                            <ShoppingCart className="mr-1 h-4 w-4" />
                            FAZER PEDIDO
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Leads */}
        <TabsContent value="leads">
          <VendedorLeadsTab vendedorId={vendedor?.id || ""} />
        </TabsContent>

        {/* Tab: Pedidos */}
        <TabsContent value="pedidos">
          <VendedorPedidosTab vendedorId={vendedor?.id || ""} />
        </TabsContent>
      </Tabs>

      {/* Cadastrar/Editar Cliente Dialog */}
      <CadastrarClienteDialog
        open={cadastrarClienteOpen}
        onOpenChange={(open) => {
          setCadastrarClienteOpen(open);
          if (!open) setClienteParaEditar(null);
        }}
        vendedorId={vendedor?.id || ""}
        onSuccess={fetchVendedorData}
        clienteParaEditar={clienteParaEditar}
      />

      {/* Confirmação de Exclusão */}
      <AlertDialog open={!!clienteParaExcluir} onOpenChange={(open) => !open && setClienteParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente <strong>{clienteParaExcluir?.nome_igreja}</strong>?
              Esta ação é irreversível e todos os dados associados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluirCliente}
              disabled={excluindo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo ? "Excluindo..." : "Excluir Cliente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
