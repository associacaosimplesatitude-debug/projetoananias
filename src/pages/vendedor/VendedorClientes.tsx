import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ShoppingCart, 
  CheckCircle,
  XCircle,
  UserPlus,
  Play,
  MapPin,
  Pencil,
  Trash2
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CadastrarClienteDialog } from "@/components/vendedor/CadastrarClienteDialog";
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
}

export default function VendedorClientes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { vendedor, isLoading: vendedorLoading } = useVendedor();
  const [cadastrarClienteOpen, setCadastrarClienteOpen] = useState(false);
  const [clienteParaEditar, setClienteParaEditar] = useState<Cliente | null>(null);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | null>(null);
  const [excluindo, setExcluindo] = useState(false);

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

  const loading = vendedorLoading || clientesLoading;

  const handleFazerPedido = (cliente: Cliente) => {
    navigate(`/ebd/shopify-pedidos?clienteId=${cliente.id}&clienteNome=${encodeURIComponent(cliente.nome_igreja)}`);
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
        <CardContent className="pt-6">
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
                      <div className="flex flex-col gap-1">
                        {cliente.status_ativacao_ebd ? (
                          <Badge variant="default" className="bg-green-500 w-fit">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="w-fit">
                            <XCircle className="mr-1 h-3 w-3" />
                            Pendente
                          </Badge>
                        )}
                        {cliente.pode_faturar && (
                          <Badge variant="outline" className="w-fit text-blue-600 border-blue-300 bg-blue-50">
                            B2B
                          </Badge>
                        )}
                      </div>
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
                          PEDIDO
                        </Button>
                        {!cliente.status_ativacao_ebd && (
                          <Button
                            size="sm"
                            onClick={() => handleAtivarPainel(cliente)}
                          >
                            <Play className="mr-1 h-4 w-4" />
                            ATIVAR
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

      <AlertDialog open={!!clienteParaExcluir} onOpenChange={(open) => !open && setClienteParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente <strong>{clienteParaExcluir?.nome_igreja}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluirCliente}
              disabled={excluindo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
