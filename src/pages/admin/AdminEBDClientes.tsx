import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Users, FileText, AlertTriangle, CheckCircle, XCircle, Percent, MapPin, User, Building2, Calendar, UserCog } from "lucide-react";
import { useState } from "react";
import { DescontoFaturamentoDialog } from "@/components/vendedor/DescontoFaturamentoDialog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Cliente {
  id: string;
  nome_igreja: string;
  nome_responsavel: string | null;
  nome_superintendente: string | null;
  email_superintendente: string | null;
  telefone: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  cnpj: string | null;
  cpf: string | null;
  status_ativacao_ebd: boolean;
  tipo_cliente: string | null;
  onboarding_concluido: boolean | null;
  vendedor_id: string | null;
  desconto_faturamento: number | null;
  pode_faturar: boolean;
  desconto_atribuido_por: string | null;
  desconto_atribuido_em: string | null;
  created_at: string;
  vendedor?: {
    id: string;
    nome: string;
  } | null;
  desconto_atribuidor?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface Vendedor {
  id: string;
  nome: string;
}

export default function AdminEBDClientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [vendedorFilter, setVendedorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clienteParaDesconto, setClienteParaDesconto] = useState<Cliente | null>(null);

  // Buscar todos os clientes
  const { data: clientes = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-ebd-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select(`
          *,
          vendedor:vendedores!ebd_clientes_vendedor_id_fkey(id, nome)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar perfis dos usuários que atribuíram desconto
      const clientesComDesconto = (data || []).filter(c => c.desconto_atribuido_por);
      const userIds = [...new Set(clientesComDesconto.map(c => c.desconto_atribuido_por))];
      
      let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = { full_name: p.full_name, email: p.email };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string | null }>);
        }
      }

      return (data || []).map(c => ({
        ...c,
        desconto_atribuidor: c.desconto_atribuido_por ? profilesMap[c.desconto_atribuido_por] || null : null,
      })) as Cliente[];
    },
  });

  // Buscar vendedores para filtro
  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-list-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome")
        .eq("status", "Ativo")
        .order("nome");
      if (error) throw error;
      return data as Vendedor[];
    },
  });

  // Filtrar clientes
  const clientesFiltrados = clientes.filter((cliente) => {
    const matchesSearch =
      cliente.nome_igreja?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.cnpj?.includes(searchTerm) ||
      cliente.cpf?.includes(searchTerm) ||
      cliente.email_superintendente?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesVendedor =
      vendedorFilter === "all" ||
      (vendedorFilter === "sem_vendedor" && !cliente.vendedor_id) ||
      cliente.vendedor_id === vendedorFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "ativo" && cliente.status_ativacao_ebd) ||
      (statusFilter === "inativo" && !cliente.status_ativacao_ebd) ||
      (statusFilter === "com_desconto" && (cliente.desconto_faturamento || 0) > 0) ||
      (statusFilter === "pode_faturar" && cliente.pode_faturar) ||
      (statusFilter === "onboarding_pendente" && cliente.vendedor_id && !cliente.onboarding_concluido);

    return matchesSearch && matchesVendedor && matchesStatus;
  });

  // Estatísticas
  const stats = {
    total: clientes.length,
    comDesconto: clientes.filter(c => (c.desconto_faturamento || 0) > 0).length,
    podeFaturar: clientes.filter(c => c.pode_faturar).length,
    semVendedor: clientes.filter(c => !c.vendedor_id).length,
    onboardingPendente: clientes.filter(c => c.vendedor_id && !c.onboarding_concluido).length,
  };

  const formatDocumento = (cnpj: string | null, cpf: string | null) => {
    const doc = cnpj || cpf || "";
    if (!doc) return "-";
    const digits = doc.replace(/\D/g, "");
    if (digits.length === 14) {
      return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    } else if (digits.length === 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return doc;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Clientes EBD - Visão Gerencial
        </h1>
        <p className="text-muted-foreground">
          Visualize e gerencie todos os clientes de todos os vendedores
        </p>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total de Clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-600">{stats.comDesconto}</div>
            <p className="text-xs text-muted-foreground">Com Desconto</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats.podeFaturar}</div>
            <p className="text-xs text-muted-foreground">Pode Faturar</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.semVendedor}</div>
            <p className="text-xs text-muted-foreground">Sem Vendedor</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{stats.onboardingPendente}</div>
            <p className="text-xs text-muted-foreground">Onboarding Pendente</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ, CPF ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os vendedores</SelectItem>
            <SelectItem value="sem_vendedor">Sem vendedor</SelectItem>
            {vendedores.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
            <SelectItem value="com_desconto">Com Desconto</SelectItem>
            <SelectItem value="pode_faturar">Pode Faturar</SelectItem>
            <SelectItem value="onboarding_pendente">Onboarding Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de clientes */}
      {isLoading ? (
        <div className="text-center py-8">Carregando clientes...</div>
      ) : clientesFiltrados.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            Nenhum cliente encontrado com os filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clientesFiltrados.map((cliente) => (
            <Card key={cliente.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{cliente.nome_igreja}</h3>
                    {cliente.vendedor ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <UserCog className="h-3 w-3" />
                        {cliente.vendedor.nome}
                      </p>
                    ) : (
                      <p className="text-xs text-yellow-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Sem vendedor
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {cliente.status_ativacao_ebd ? (
                      <Badge className="bg-green-500 text-xs">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Inativo</Badge>
                    )}
                  </div>
                </div>

                {/* Badges de status */}
                <div className="flex flex-wrap gap-1">
                  {cliente.tipo_cliente && (
                    <Badge variant="outline" className="text-xs">
                      {cliente.tipo_cliente}
                    </Badge>
                  )}
                  {cliente.pode_faturar && (
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      <FileText className="mr-1 h-3 w-3" />
                      Faturamento
                    </Badge>
                  )}
                  {(cliente.desconto_faturamento || 0) > 0 && (
                    <Badge className="bg-orange-500 text-white text-xs">
                      <Percent className="mr-1 h-3 w-3" />
                      {cliente.desconto_faturamento}% vendedor
                    </Badge>
                  )}
                  {cliente.vendedor_id && !cliente.onboarding_concluido && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Setup Pendente
                    </Badge>
                  )}
                  {cliente.onboarding_concluido && (
                    <Badge className="bg-green-100 text-green-700 text-xs">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Setup OK
                    </Badge>
                  )}
                </div>

                {/* Info */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="flex items-center gap-1">
                    {cliente.cnpj ? (
                      <Building2 className="h-3 w-3" />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                    {formatDocumento(cliente.cnpj, cliente.cpf)}
                  </p>
                  {(cliente.endereco_cidade || cliente.endereco_estado) && (
                    <p className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {cliente.endereco_cidade}{cliente.endereco_cidade && cliente.endereco_estado && "/"}{cliente.endereco_estado}
                    </p>
                  )}
                </div>

                {/* Quem atribuiu o desconto */}
                {(cliente.desconto_faturamento || 0) > 0 && (
                  <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-md p-2">
                    <p className="text-xs font-medium text-orange-800 dark:text-orange-200">
                      Desconto atribuído por:
                    </p>
                    {cliente.desconto_atribuidor ? (
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        {cliente.desconto_atribuidor.full_name || cliente.desconto_atribuidor.email || "Usuário"}
                        {cliente.desconto_atribuido_em && (
                          <span className="text-orange-500 ml-1">
                            em {format(parseISO(cliente.desconto_atribuido_em), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-orange-600 dark:text-orange-400 italic">
                        Não rastreado (desconto antigo)
                      </p>
                    )}
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setClienteParaDesconto(cliente)}
                  >
                    <Percent className="h-3 w-3 mr-1" />
                    Desconto
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de desconto */}
      <DescontoFaturamentoDialog
        open={!!clienteParaDesconto}
        onOpenChange={(open) => !open && setClienteParaDesconto(null)}
        cliente={clienteParaDesconto}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
