import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, User, Mail, Package, Truck, ExternalLink, ShoppingBag, Church, IdCard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

interface ShopifyPedidoCG {
  id: string;
  shopify_order_id: number;
  order_number: string;
  status_pagamento: string;
  customer_email: string | null;
  customer_name: string | null;
  valor_total: number;
  valor_frete: number;
  codigo_rastreio: string | null;
  url_rastreio: string | null;
  created_at: string;
  order_date?: string | null;
  updated_at: string;
  // Novos campos de endereço e CPF/CNPJ
  customer_document?: string | null;
  endereco_rua?: string | null;
  endereco_numero?: string | null;
  endereco_complemento?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_estado?: string | null;
  endereco_cep?: string | null;
  endereco_nome?: string | null;
  endereco_telefone?: string | null;
}

interface Vendedor {
  id: string;
  nome: string;
  email: string;
}

interface EbdCliente {
  id: string;
  nome_igreja: string;
  email_superintendente: string | null;
  telefone: string | null;
  vendedor_id: string | null;
  tipo_cliente: string | null;
  status_ativacao_ebd: boolean;
  cpf?: string | null;
  cnpj?: string | null;
}

interface PedidoItem {
  id: string;
  product_title: string;
  variant_title: string | null;
  quantity: number;
  price: number;
  sku: string | null;
}

interface PedidoCGDetailDialogProps {
  pedido: ShopifyPedidoCG | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIPOS_CLIENTE = [
  { value: "Igreja CNPJ", label: "Igreja CNPJ" },
  { value: "Igreja CPF", label: "Igreja CPF" },
  { value: "IGREJA ADVECS", label: "IGREJA ADVECS" },
  { value: "VAREJO", label: "VAREJO" },
  { value: "LIVRARIA", label: "LIVRARIA" },
  { value: "REVENDEDOR", label: "REVENDEDOR" },
];

function canonicalizeStatus(statusRaw: string | null | undefined): string {
  if (!statusRaw) return "unknown";
  const s = statusRaw.toLowerCase().trim();
  if (s === "paid" || s === "pago") return "paid";
  if (s === "pending" || s === "pendente") return "pending";
  if (s === "refunded" || s === "reembolsado") return "refunded";
  if (s === "voided" || s === "cancelado") return "voided";
  if (s === "partially_refunded") return "partially_refunded";
  if (s === "partially_paid") return "partially_paid";
  if (s === "authorized" || s === "autorizado") return "authorized";
  return "unknown";
}

export function PedidoCGDetailDialog({ pedido, open, onOpenChange }: PedidoCGDetailDialogProps) {
  const queryClient = useQueryClient();
  const { isAdmin, isGerenteEbd } = useUserRole();
  const canManage = isAdmin || isGerenteEbd;

  const [selectedVendedor, setSelectedVendedor] = useState<string>("");
  const [selectedTipoCliente, setSelectedTipoCliente] = useState<string>("");
  const [nomeIgreja, setNomeIgreja] = useState<string>("");

  // Fetch vendedores
  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome, email")
        .eq("status", "Ativo")
        .order("nome");
      if (error) throw error;
      return data as Vendedor[];
    },
    enabled: open && canManage,
  });

  // Fetch line items for this order
  const { data: lineItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ["pedido-cg-itens", pedido?.id],
    queryFn: async () => {
      if (!pedido?.id) return [];
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos_cg_itens")
        .select("*")
        .eq("pedido_id", pedido.id)
        .order("product_title");
      if (error) throw error;
      return data as PedidoItem[];
    },
    enabled: open && !!pedido?.id,
  });

  // Fetch existing client by email
  const { data: existingCliente, isLoading: isLoadingCliente } = useQuery({
    queryKey: ["ebd-cliente-by-email", pedido?.customer_email],
    queryFn: async () => {
      if (!pedido?.customer_email) return null;
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("*")
        .eq("email_superintendente", pedido.customer_email)
        .maybeSingle();
      if (error) throw error;
      return data as EbdCliente | null;
    },
    enabled: open && !!pedido?.customer_email,
  });

  // Update state when cliente data loads
  useEffect(() => {
    if (existingCliente) {
      setSelectedVendedor(existingCliente.vendedor_id || "");
      setSelectedTipoCliente(existingCliente.tipo_cliente || "");
      setNomeIgreja(existingCliente.nome_igreja || "");
    } else {
      setSelectedVendedor("");
      setSelectedTipoCliente("");
      setNomeIgreja(pedido?.customer_name || "");
    }
  }, [existingCliente, pedido]);

  // Mutation to create or update cliente
  const saveClienteMutation = useMutation({
    mutationFn: async () => {
      if (!pedido) throw new Error("Pedido não encontrado");

      const clienteData = {
        nome_igreja: nomeIgreja || pedido.customer_name || "Cliente sem nome",
        email_superintendente: pedido.customer_email,
        vendedor_id: selectedVendedor || null,
        tipo_cliente: selectedTipoCliente || null,
      };

      if (existingCliente) {
        // Update existing cliente
        const { error } = await supabase
          .from("ebd_clientes")
          .update({
            nome_igreja: clienteData.nome_igreja,
            vendedor_id: clienteData.vendedor_id,
            tipo_cliente: clienteData.tipo_cliente,
          })
          .eq("id", existingCliente.id);
        if (error) throw error;
      } else {
        // Create new cliente
        const { error } = await supabase.from("ebd_clientes").insert(clienteData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cliente atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ebd-cliente-by-email", pedido?.customer_email] });
      queryClient.invalidateQueries({ queryKey: ["clientes-para-atribuir"] });
    },
    onError: (error) => {
      console.error("Error saving cliente:", error);
      toast.error("Erro ao salvar cliente");
    },
  });

  if (!pedido) return null;

  const orderDate = pedido.order_date || pedido.created_at;
  const formattedDate = format(parseISO(orderDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const getStatusBadge = (status: string) => {
    const canonical = canonicalizeStatus(status);
    switch (canonical) {
      case "paid":
        return <Badge className="bg-green-500">Pago</Badge>;
      case "pending":
        return <Badge variant="outline">Pendente</Badge>;
      case "refunded":
        return <Badge variant="destructive">Reembolsado</Badge>;
      case "voided":
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pedido {pedido.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Data do Pedido</Label>
              <p className="font-medium">{formattedDate}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <div className="mt-1">{getStatusBadge(pedido.status_pagamento)}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Valor Total</Label>
              <p className="font-medium text-lg">
                {pedido.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Frete</Label>
              <p className="font-medium">
                {pedido.valor_frete.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </div>

          <Separator />

          {/* Customer Info */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Informações do Cliente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{pedido.customer_name || "Não informado"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{pedido.customer_email || "Não informado"}</span>
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <IdCard className="h-4 w-4 text-muted-foreground" />
                <span>
                  {pedido.customer_document
                    ? `CPF/CNPJ: ${pedido.customer_document}`
                    : existingCliente?.cnpj
                      ? `CNPJ: ${existingCliente.cnpj}`
                      : existingCliente?.cpf
                        ? `CPF: ${existingCliente.cpf}`
                        : "CPF/CNPJ: -"}
                </span>
              </div>
            </div>
          </div>

          {/* Endereço de Entrega */}
          {(pedido.endereco_rua || pedido.endereco_cidade) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Endereço de Entrega
                </h3>
                <div className="text-sm space-y-1">
                  {pedido.endereco_nome && <p><strong>Destinatário:</strong> {pedido.endereco_nome}</p>}
                  {pedido.endereco_rua && (
                    <p>
                      {pedido.endereco_rua}
                      {pedido.endereco_numero ? `, ${pedido.endereco_numero}` : ""}
                      {pedido.endereco_complemento ? ` - ${pedido.endereco_complemento}` : ""}
                    </p>
                  )}
                  {(pedido.endereco_bairro || pedido.endereco_cidade || pedido.endereco_estado) && (
                    <p>
                      {pedido.endereco_bairro ? `${pedido.endereco_bairro}, ` : ""}
                      {pedido.endereco_cidade || ""}{pedido.endereco_estado ? ` - ${pedido.endereco_estado}` : ""}
                    </p>
                  )}
                  {pedido.endereco_cep && <p><strong>CEP:</strong> {pedido.endereco_cep}</p>}
                  {pedido.endereco_telefone && <p><strong>Telefone:</strong> {pedido.endereco_telefone}</p>}
                </div>
              </div>
            </>
          )}

          {/* Products List */}
          <Separator />
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Produtos do Pedido
            </h3>
            {isLoadingItems ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando produtos...
              </div>
            ) : lineItems.length > 0 ? (
              <div className="space-y-2">
                {lineItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.product_title}</p>
                      {item.variant_title && item.variant_title !== "Default Title" && (
                        <p className="text-sm text-muted-foreground">{item.variant_title}</p>
                      )}
                      {item.sku && (
                        <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {item.quantity}x {item.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total: {(item.quantity * item.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Nenhum produto encontrado. Sincronize os pedidos para carregar os itens.
              </p>
            )}
          </div>

          {/* Tracking Info */}
          {pedido.codigo_rastreio && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Rastreamento
                </h3>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{pedido.codigo_rastreio}</span>
                  {pedido.url_rastreio && (
                    <a
                      href={pedido.url_rastreio}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Rastrear
                    </a>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Attribution Section - Only for managers */}
          {canManage && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Church className="h-4 w-4" />
                  Atribuição e Classificação
                </h3>

                {isLoadingCliente ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando dados do cliente...
                  </div>
                ) : (
                  <>
                    {existingCliente && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Cliente existente: <span className="font-medium">{existingCliente.nome_igreja}</span>
                        </p>
                        {existingCliente.status_ativacao_ebd ? (
                          <Badge className="mt-2 bg-green-500">EBD Ativado</Badge>
                        ) : (
                          <Badge variant="outline" className="mt-2">EBD Não Ativado</Badge>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="nome-igreja">Nome da Igreja/Instituição</Label>
                      <Input
                        id="nome-igreja"
                        value={nomeIgreja}
                        onChange={(e) => setNomeIgreja(e.target.value)}
                        placeholder="Ex: Igreja Batista da Lagoinha"
                      />
                      <p className="text-xs text-muted-foreground">
                        Preencha após contato com o cliente
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vendedor">Atribuir Vendedor</Label>
                      <Select 
                        value={selectedVendedor || "__none__"} 
                        onValueChange={(val) => setSelectedVendedor(val === "__none__" ? "" : val)}
                      >
                        <SelectTrigger id="vendedor">
                          <SelectValue placeholder="Selecione um vendedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sem vendedor</SelectItem>
                          {vendedores.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tipo-cliente">Tipo de Cliente</Label>
                      <Select 
                        value={selectedTipoCliente || "__none__"} 
                        onValueChange={(val) => setSelectedTipoCliente(val === "__none__" ? "" : val)}
                      >
                        <SelectTrigger id="tipo-cliente">
                          <SelectValue placeholder="Selecione o tipo de cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Não classificado</SelectItem>
                          {TIPOS_CLIENTE.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={() => saveClienteMutation.mutate()}
                      disabled={saveClienteMutation.isPending}
                      className="w-full"
                    >
                      {saveClienteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Salvar Atribuição e Classificação
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
