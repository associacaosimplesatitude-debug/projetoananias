import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  Play
} from "lucide-react";
import { format, differenceInDays, isThisMonth, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { NovoPedidoDialog, DialogMode } from "@/components/vendedor/NovoPedidoDialog";

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
  nome_igreja: string;
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
}

export default function VendedorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("full");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

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

  // Fetch sales data for the current month (simulated with pedidos)
  const { data: vendasMes = 0 } = useQuery({
    queryKey: ["vendedor-vendas-mes", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return 0;

      const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const fimMes = format(endOfMonth(new Date()), "yyyy-MM-dd");

      // For now, calculate based on activated clients this month (approximate)
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id")
        .eq("vendedor_id", vendedor.id)
        .eq("status_ativacao_ebd", true)
        .gte("data_inicio_ebd", inicioMes)
        .lte("data_inicio_ebd", fimMes);

      if (error) return 0;
      // Estimate R$500 per activation for now
      return (data?.length || 0) * 500;
    },
    enabled: !!vendedor?.id,
  });

  const loading = authLoading || vendedorLoading || clientesLoading;

  const fetchVendedorData = () => {
    refetch();
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

  // Open dialog with specific mode
  const openDialog = (mode: DialogMode, cliente: Cliente | null = null) => {
    setDialogMode(mode);
    setSelectedCliente(cliente);
    setDialogOpen(true);
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Painel do Vendedor</h1>
          <p className="text-muted-foreground">
            Bem-vindo, {vendedor?.nome}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline"
            onClick={() => openDialog("cadastro")}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Cadastrar Novo Cliente
          </Button>
          <Button 
            size="lg" 
            className="bg-primary hover:bg-primary/90"
            onClick={() => openDialog("full")}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            Novo Pedido / Ativação EBD
          </Button>
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

      {/* Tabs */}
      <Tabs defaultValue="pendentes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes de Ativação ({clientesPendentes.length})
          </TabsTrigger>
          <TabsTrigger value="proxima-compra">
            Próximas Compras ({clientesProximaCompra.length})
          </TabsTrigger>
          <TabsTrigger value="todos">
            Todos os Clientes ({clientes.length})
          </TabsTrigger>
          <TabsTrigger value="risco">
            Em Risco ({clientesRisco.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="space-y-4">
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
                          CNPJ: {cliente.cnpj}
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
                          onClick={() => openDialog("pedido", cliente)}
                        >
                          <ShoppingCart className="mr-1 h-4 w-4" />
                          Fazer Pedido
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => openDialog("ativacao", cliente)}
                        >
                          <Play className="mr-1 h-4 w-4" />
                          Ativar Painel EBD
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proxima-compra" className="space-y-4">
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
                            onClick={() => openDialog("pedido", cliente)}
                          >
                            <ShoppingCart className="mr-1 h-4 w-4" />
                            Fazer Pedido
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

        <TabsContent value="todos" className="space-y-4">
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
                <div className="space-y-4">
                  {clientes.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{cliente.nome_igreja}</p>
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
                        </div>
                        <p className="text-sm text-muted-foreground">
                          CNPJ: {cliente.cnpj}
                        </p>
                        {cliente.dia_aula && (
                          <p className="text-sm text-muted-foreground">
                            Aula: {cliente.dia_aula}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDialog("pedido", cliente)}
                        >
                          <ShoppingCart className="mr-1 h-4 w-4" />
                          Fazer Pedido
                        </Button>
                        {!cliente.status_ativacao_ebd && (
                          <Button
                            size="sm"
                            onClick={() => openDialog("ativacao", cliente)}
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
        </TabsContent>

        <TabsContent value="risco" className="space-y-4">
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
                            onClick={() => openDialog("pedido", cliente)}
                          >
                            <ShoppingCart className="mr-1 h-4 w-4" />
                            Fazer Pedido
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
      </Tabs>

      {/* Dialog */}
      <NovoPedidoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vendedorId={vendedor?.id || ""}
        clientes={clientes}
        onSuccess={fetchVendedorData}
        initialMode={dialogMode}
        preSelectedCliente={selectedCliente}
      />
    </div>
  );
}
