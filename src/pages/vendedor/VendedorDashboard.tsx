import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  UserPlus, 
  AlertTriangle, 
  Calendar, 
  Gift,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";
import { format, differenceInDays, isThisMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { CadastrarClienteDialog } from "@/components/vendedor/CadastrarClienteDialog";
import { AtivarClienteDialog } from "@/components/vendedor/AtivarClienteDialog";

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  email_bling: string | null;
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
  const [cadastrarDialogOpen, setCadastrarDialogOpen] = useState(false);
  const [ativarDialogOpen, setAtivarDialogOpen] = useState(false);
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

  const handleAtivarCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setAtivarDialogOpen(true);
  };

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
        <Button onClick={() => setCadastrarDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Cadastrar Novo Cliente
        </Button>
      </div>

      {/* Dashboard Cards */}
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
                      <Button onClick={() => handleAtivarCliente(cliente)}>
                        Ativar Painel EBD
                      </Button>
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
                            {cliente.email_superintendente}
                          </p>
                        </div>
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
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(cliente.data_proxima_compra!), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
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
                      {!cliente.status_ativacao_ebd && (
                        <Button
                          variant="outline"
                          onClick={() => handleAtivarCliente(cliente)}
                        >
                          Ativar
                        </Button>
                      )}
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
                        <div className="text-right">
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {diasSemLogin
                              ? `${diasSemLogin} dias sem login`
                              : "Nunca logou"}
                          </Badge>
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

      {/* Dialogs */}
      <CadastrarClienteDialog
        open={cadastrarDialogOpen}
        onOpenChange={setCadastrarDialogOpen}
        vendedorId={vendedor?.id || ""}
        onSuccess={fetchVendedorData}
      />

      {selectedCliente && (
        <AtivarClienteDialog
          open={ativarDialogOpen}
          onOpenChange={setAtivarDialogOpen}
          cliente={selectedCliente}
          onSuccess={fetchVendedorData}
        />
      )}
    </div>
  );
}
