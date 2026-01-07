import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2, User, Mail, Package, Truck, DollarSign, IdCard, MapPin, Phone, ShoppingBag, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Função para formatar CPF/CNPJ
function formatDocumento(doc: string | null | undefined): string {
  if (!doc) return "";
  
  // Remove caracteres não numéricos
  const cleaned = doc.replace(/\D/g, "");
  
  // CPF: 000.000.000-00
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  
  // CNPJ: 00.000.000/0000-00
  if (cleaned.length === 14) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  
  // Se não é CPF nem CNPJ, retorna original
  return doc;
}

interface ShopifyPedido {
  id: string;
  shopify_order_id: number;
  order_number: string;
  vendedor_id: string | null;
  cliente_id: string | null;
  status_pagamento: string;
  valor_total: number;
  valor_frete: number;
  valor_para_meta: number;
  customer_email: string | null;
  customer_name: string | null;
  customer_document?: string | null;
  customer_phone?: string | null;
  endereco_rua?: string | null;
  endereco_numero?: string | null;
  endereco_complemento?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_estado?: string | null;
  endereco_cep?: string | null;
  created_at: string;
  order_date?: string | null;
  codigo_rastreio: string | null;
  url_rastreio: string | null;
  cliente?: {
    nome_igreja: string;
    tipo_cliente: string | null;
  } | null;
  vendedor?: {
    nome: string;
  } | null;
}

interface Vendedor {
  id: string;
  nome: string;
}

const TIPOS_CLIENTE = [
  { value: "ADVECS", label: "ADVECS" },
  { value: "IGREJA CNPJ", label: "IGREJA CNPJ" },
  { value: "IGREJA CPF", label: "IGREJA CPF" },
  { value: "LOJISTA", label: "LOJISTA" },
  { value: "REPRESENTANTE", label: "REPRESENTANTE" },
  { value: "PESSOA FÍSICA", label: "PESSOA FÍSICA" },
  { value: "REVENDEDOR", label: "REVENDEDOR" },
];

interface PedidoItem {
  id: string;
  product_title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  price: number;
  total_discount: number;
}

interface PedidoOnlineDetailDialogProps {
  pedido: ShopifyPedido | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hideAttribution?: boolean;
}

export function PedidoOnlineDetailDialog({
  pedido,
  open,
  onOpenChange,
  hideAttribution = false,
}: PedidoOnlineDetailDialogProps) {
  const queryClient = useQueryClient();
  const [selectedVendedor, setSelectedVendedor] = useState<string>("");
  const [selectedTipoCliente, setSelectedTipoCliente] = useState<string>("");
  const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);

  // Fetch vendedores
  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-list"],
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

  // Fetch cliente data if cliente_id exists
  const { data: clienteData } = useQuery({
    queryKey: ["cliente-detail", pedido?.cliente_id],
    queryFn: async () => {
      if (!pedido?.cliente_id) return null;
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("*")
        .eq("id", pedido.cliente_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!pedido?.cliente_id,
  });

  // Fetch order items
  const { data: orderItems = [], refetch: refetchItems, isLoading: isLoadingItems } = useQuery({
    queryKey: ["pedido-items", pedido?.id],
    queryFn: async () => {
      if (!pedido?.id) return [];
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos_itens")
        .select("*")
        .eq("pedido_id", pedido.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as PedidoItem[];
    },
    enabled: !!pedido?.id,
  });

  // Mutation to sync items for this order
  const syncItemsMutation = useMutation({
    mutationFn: async () => {
      if (!pedido?.id) throw new Error("Pedido não encontrado");
      
      const { data, error } = await supabase.functions.invoke("ebd-shopify-sync-order-items", {
        body: { pedido_id: pedido.id }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.items_synced || 0} itens sincronizados`);
      refetchItems();
    },
    onError: (error) => {
      toast.error("Erro ao sincronizar itens", {
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Auto-sync when opening dialog if no items and not already attempted
  useEffect(() => {
    if (open && pedido?.id && orderItems.length === 0 && !isLoadingItems && !autoSyncAttempted && !syncItemsMutation.isPending) {
      setAutoSyncAttempted(true);
      syncItemsMutation.mutate();
    }
  }, [open, pedido?.id, orderItems.length, isLoadingItems, autoSyncAttempted, syncItemsMutation.isPending]);

  // Reset auto-sync flag when dialog closes or pedido changes
  useEffect(() => {
    if (!open) {
      setAutoSyncAttempted(false);
    }
  }, [open, pedido?.id]);

  // Initialize form state when a NEW pedido is opened.
  // IMPORTANT: do not overwrite user selections when clienteData arrives async.
  const [initializedPedidoId, setInitializedPedidoId] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !pedido) return;

    if (initializedPedidoId !== pedido.id) {
      setInitializedPedidoId(pedido.id);
      setSelectedVendedor(pedido.vendedor_id || "");
      setSelectedTipoCliente(clienteData?.tipo_cliente || pedido.cliente?.tipo_cliente || "");
    } else {
      // Only auto-fill tipo_cliente if user hasn't picked one yet
      if (!selectedTipoCliente) {
        setSelectedTipoCliente(clienteData?.tipo_cliente || pedido.cliente?.tipo_cliente || "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pedido?.id, initializedPedidoId, clienteData?.tipo_cliente]);

  // Mutation to save attribution
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!pedido) return;

      console.log("[ATRIBUIÇÃO] Iniciando atribuição:", {
        pedido_id: pedido.id,
        order_number: pedido.order_number,
        vendedor_atual: pedido.vendedor_id,
        vendedor_selecionado: selectedVendedor,
      });

      // Update pedido with vendedor
      if (selectedVendedor !== (pedido.vendedor_id || "")) {
        console.log("[ATRIBUIÇÃO] Atualizando vendedor_id no pedido...");
        const { error: pedidoError } = await supabase
          .from("ebd_shopify_pedidos")
          .update({ vendedor_id: selectedVendedor || null })
          .eq("id", pedido.id);
        
        if (pedidoError) {
          console.error("[ATRIBUIÇÃO] ERRO ao atualizar pedido:", pedidoError);
          throw pedidoError;
        }
        console.log("[ATRIBUIÇÃO] Pedido atualizado com sucesso!");
      } else {
        console.log("[ATRIBUIÇÃO] Vendedor não mudou, pulando atualização do pedido");
      }

      let finalClienteId = pedido.cliente_id;

      // If cliente exists, update tipo_cliente and vendedor_id
      if (pedido.cliente_id) {
        const updateData: Record<string, any> = {};
        
        if (selectedTipoCliente) {
          updateData.tipo_cliente = selectedTipoCliente;
        }
        if (selectedVendedor) {
          updateData.vendedor_id = selectedVendedor;
          // Marcar como pós-venda ecommerce quando atribuir vendedor
          updateData.is_pos_venda_ecommerce = true;
        }

        if (Object.keys(updateData).length > 0) {
          const { error: clienteError } = await supabase
            .from("ebd_clientes")
            .update(updateData)
            .eq("id", pedido.cliente_id);
          if (clienteError) throw clienteError;
        }
      } else if (pedido.customer_email) {
        // Try to find or create cliente by email
        const { data: existingCliente } = await supabase
          .from("ebd_clientes")
          .select("id")
          .eq("email_superintendente", pedido.customer_email.toLowerCase())
          .maybeSingle();

        if (existingCliente) {
          finalClienteId = existingCliente.id;
          
          // Update existing cliente
          const updateData: Record<string, any> = {};
          if (selectedTipoCliente) updateData.tipo_cliente = selectedTipoCliente;
          if (selectedVendedor) {
            updateData.vendedor_id = selectedVendedor;
            // Marcar como pós-venda ecommerce quando atribuir vendedor
            updateData.is_pos_venda_ecommerce = true;
          }
          
          // Preencher campos de endereço e documento se vazios
          if (pedido.endereco_cidade) updateData.endereco_cidade = pedido.endereco_cidade;
          if (pedido.endereco_estado) updateData.endereco_estado = pedido.endereco_estado;
          if (pedido.endereco_cep) updateData.endereco_cep = pedido.endereco_cep;
          if (pedido.endereco_rua) updateData.endereco_rua = pedido.endereco_rua;
          if (pedido.endereco_numero) updateData.endereco_numero = pedido.endereco_numero;
          if (pedido.endereco_bairro) updateData.endereco_bairro = pedido.endereco_bairro;
          if (pedido.customer_name) updateData.nome_responsavel = pedido.customer_name;
          if (pedido.customer_phone) updateData.telefone = pedido.customer_phone;
          
          // CPF/CNPJ
          const documento = pedido.customer_document?.replace(/\D/g, "") || null;
          if (documento && documento.length === 14) {
            updateData.cnpj = pedido.customer_document;
          } else if (documento && documento.length === 11) {
            updateData.cpf = pedido.customer_document;
          }

          if (Object.keys(updateData).length > 0) {
            const { error } = await supabase
              .from("ebd_clientes")
              .update(updateData)
              .eq("id", existingCliente.id);
            if (error) throw error;
          }

          // Link pedido to cliente
          const { error: linkError } = await supabase
            .from("ebd_shopify_pedidos")
            .update({ cliente_id: existingCliente.id })
            .eq("id", pedido.id);
          if (linkError) throw linkError;
        } else {
          // Determinar CPF/CNPJ
          const documento = pedido.customer_document?.replace(/\D/g, "") || null;
          const isCnpj = documento && documento.length === 14;
          const isCpf = documento && documento.length === 11;

          // Create new cliente with all data from pedido
          const { data: newCliente, error: createError } = await supabase
            .from("ebd_clientes")
            .insert({
              nome_igreja: pedido.customer_name || "Cliente Online",
              email_superintendente: pedido.customer_email?.toLowerCase(),
              tipo_cliente: selectedTipoCliente || "PESSOA FÍSICA",
              vendedor_id: selectedVendedor || null,
              status_ativacao_ebd: false,
              // Marcar como pós-venda ecommerce quando atribuir vendedor
              is_pos_venda_ecommerce: selectedVendedor ? true : false,
              // Campos de endereço
              endereco_rua: pedido.endereco_rua || null,
              endereco_numero: pedido.endereco_numero || null,
              endereco_bairro: pedido.endereco_bairro || null,
              endereco_cidade: pedido.endereco_cidade || null,
              endereco_estado: pedido.endereco_estado || null,
              endereco_cep: pedido.endereco_cep || null,
              nome_responsavel: pedido.customer_name || null,
              telefone: pedido.customer_phone || null,
              cnpj: isCnpj ? pedido.customer_document : null,
              cpf: isCpf ? pedido.customer_document : null,
            })
            .select("id")
            .single();

          if (createError) throw createError;
          
          finalClienteId = newCliente.id;

          // Link pedido to new cliente
          const { error: linkError } = await supabase
            .from("ebd_shopify_pedidos")
            .update({ cliente_id: newCliente.id })
            .eq("id", pedido.id);
          if (linkError) throw linkError;
        }
      }

      // INSERIR/ATUALIZAR NA TABELA PIVÔ ebd_pos_venda_ecommerce (OBRIGATÓRIO quando tem vendedor)
      if (selectedVendedor) {
        const emailCliente = pedido.customer_email?.toLowerCase() || "";
        
        if (!emailCliente) {
          console.error("Email do cliente não encontrado no pedido");
          toast.error("Email do cliente é obrigatório para atribuição");
          throw new Error("Email do cliente é obrigatório");
        }

        // Verificar se já existe vínculo para este pedido
        const { data: existingVinculo, error: checkError } = await (supabase as any)
          .from("ebd_pos_venda_ecommerce")
          .select("id")
          .eq("pedido_id", pedido.id)
          .maybeSingle();

        if (checkError) {
          console.error("Erro ao verificar vínculo existente:", checkError);
          throw checkError;
        }

        if (existingVinculo) {
          // Atualizar vínculo existente
          const { error: updateVinculoError } = await (supabase as any)
            .from("ebd_pos_venda_ecommerce")
            .update({
              vendedor_id: selectedVendedor,
              cliente_id: finalClienteId || null,
              email_cliente: emailCliente,
            })
            .eq("id", existingVinculo.id);
          if (updateVinculoError) {
            console.error("Erro ao atualizar vínculo pós-venda:", updateVinculoError);
            toast.error("Erro ao atualizar vínculo pós-venda");
            throw updateVinculoError;
          }
        } else {
          // Criar novo vínculo na tabela pivô
          const { error: insertVinculoError } = await (supabase as any)
            .from("ebd_pos_venda_ecommerce")
            .insert({
              pedido_id: pedido.id,
              vendedor_id: selectedVendedor,
              cliente_id: finalClienteId || null,
              email_cliente: emailCliente,
              status: "pendente",
            });
          if (insertVinculoError) {
            console.error("Erro ao inserir vínculo pós-venda:", insertVinculoError);
            toast.error("Erro ao criar vínculo pós-venda. Verifique o console.");
            throw insertVinculoError;
          }
        }

        console.log("Vínculo pós-venda criado/atualizado com sucesso:", {
          pedido_id: pedido.id,
          vendedor_id: selectedVendedor,
          cliente_id: finalClienteId,
          email_cliente: emailCliente,
        });
      }
    },
    onSuccess: () => {
      console.log("[ATRIBUIÇÃO] Mutation concluída com sucesso, invalidando queries...");
      toast.success("Atribuição salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ebd-shopify-pedidos-online"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-para-atribuir"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-clientes-para-ativar"] });
      queryClient.invalidateQueries({ queryKey: ["vendedor-pos-venda"] });
      console.log("[ATRIBUIÇÃO] Queries invalidadas, fechando dialog");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erro ao salvar atribuição", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    },
  });

  // State para documento buscado do Bling
  const [documentoFromBling, setDocumentoFromBling] = useState<string | null>(null);
  const [isFetchingDocumento, setIsFetchingDocumento] = useState(false);

  // Prioridade: documento do pedido (Shopify) > documento do cliente (cadastro) > documento do Bling
  const documentoFromPedido = pedido?.customer_document;
  const documentoFromCliente = clienteData?.cnpj || clienteData?.cpf || null;
  const clienteDocumento = documentoFromPedido || documentoFromCliente || documentoFromBling || null;

  // Buscar documento do Bling se não tiver no pedido/cliente
  useEffect(() => {
    if (!open || !pedido) return;
    
    // Se já temos documento, não buscar
    if (documentoFromPedido || documentoFromCliente) {
      setDocumentoFromBling(null);
      return;
    }

    // Se não tem shopify_order_id, não tem como buscar no Bling
    if (!pedido.shopify_order_id) return;

    // Resetar estado quando mudar de pedido
    setDocumentoFromBling(null);

    const fetchDocumentoFromBling = async () => {
      console.log('Buscando documento no Bling para pedido:', pedido.shopify_order_id);
      setIsFetchingDocumento(true);
      
      try {
        const { data, error } = await supabase.functions.invoke("bling-get-order-details", {
          body: { 
            bling_order_id: pedido.shopify_order_id,
            pedido_id: pedido.id
          }
        });

        if (error) {
          console.error('Erro ao buscar documento do Bling:', error);
          return;
        }

        if (data?.documento) {
          console.log('Documento recuperado:', data.documento);
          setDocumentoFromBling(data.documento);
        }
      } catch (err) {
        console.error('Erro ao buscar documento do Bling:', err);
      } finally {
        setIsFetchingDocumento(false);
      }
    };

    fetchDocumentoFromBling();
  }, [open, pedido?.id, pedido?.shopify_order_id, documentoFromPedido, documentoFromCliente]);

  if (!pedido) return null;

  const orderDate = pedido.order_date || pedido.created_at;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pedido #{pedido.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Data do Pedido</p>
              <p className="font-medium">
                {format(new Date(orderDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge>{pedido.status_pagamento}</Badge>
            </div>
          </div>

          <Separator />

          {/* Customer Info */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Cliente
            </h4>
            <div className="grid gap-2 text-sm pl-6">
              <p className="font-medium">
                {pedido.cliente?.nome_igreja || pedido.customer_name || "Não identificado"}
              </p>

              <p className="text-muted-foreground flex items-center gap-1">
                <IdCard className="h-3 w-3" />
                CPF/CNPJ: {isFetchingDocumento ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">Carregando...</span>
                  </span>
                ) : (
                  formatDocumento(clienteDocumento) || "-"
                )}
              </p>

              {pedido.customer_email && (
                <p className="text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {pedido.customer_email}
                </p>
              )}

              {pedido.customer_phone && (
                <p className="text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {pedido.customer_phone}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Endereço de Entrega */}
          {(pedido.endereco_rua || pedido.endereco_cidade) && (
            <>
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Endereço de Entrega
                </h4>
                <div className="text-sm pl-6 space-y-1">
                  {pedido.endereco_rua && (
                    <p>
                      {pedido.endereco_rua}
                      {pedido.endereco_numero && `, ${pedido.endereco_numero}`}
                    </p>
                  )}
                  {pedido.endereco_complemento && (
                    <p className="text-muted-foreground">{pedido.endereco_complemento}</p>
                  )}
                  {pedido.endereco_bairro && (
                    <p>{pedido.endereco_bairro}</p>
                  )}
                  {(pedido.endereco_cidade || pedido.endereco_estado) && (
                    <p>
                      {pedido.endereco_cidade}
                      {pedido.endereco_estado && ` - ${pedido.endereco_estado}`}
                    </p>
                  )}
                  {pedido.endereco_cep && (
                    <p className="text-muted-foreground">CEP: {pedido.endereco_cep}</p>
                  )}
                </div>
              </div>

              <Separator />
            </>
          )}

          {/* Produtos do Pedido */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Produtos do Pedido
              </h4>
              {orderItems.length === 0 && !isLoadingItems && !syncItemsMutation.isPending && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncItemsMutation.mutate()}
                  disabled={syncItemsMutation.isPending}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Sincronizar Itens
                </Button>
              )}
            </div>
            <div className="pl-6">
              {(isLoadingItems || syncItemsMutation.isPending) ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando itens...
                </div>
              ) : orderItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum produto encontrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-start text-sm border-b pb-2 last:border-0">
                      <div className="flex-1">
                        <p className="font-medium">{item.product_title}</p>
                        {item.variant_title && (
                          <p className="text-xs text-muted-foreground">{item.variant_title}</p>
                        )}
                        {item.sku && (
                          <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p>{item.quantity}x R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        {item.total_discount > 0 && (
                          <p className="text-xs text-green-600">-R$ {item.total_discount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Financial Info */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Valores
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm pl-6">
              <p>Produtos:</p>
              <p className="text-right">
                R$ {((pedido.valor_total || 0) - (pedido.valor_frete || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p>Frete:</p>
              <p className="text-right">
                R$ {(pedido.valor_frete || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="font-semibold">Total:</p>
              <p className="text-right font-semibold">
                R$ {(pedido.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {pedido.codigo_rastreio && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Rastreio
                </h4>
                <p className="text-sm pl-6">
                  {pedido.url_rastreio ? (
                    <a
                      href={pedido.url_rastreio}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {pedido.codigo_rastreio}
                    </a>
                  ) : (
                    pedido.codigo_rastreio
                  )}
                </p>
              </div>
            </>
          )}

          <Separator />

          {/* Attribution Section - only show if not hidden */}
          {!hideAttribution && (
            <div className="space-y-4 bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold">Atribuição e Classificação</h4>

              <div className="space-y-2">
                <Label htmlFor="vendedor">Atribuir Vendedor</Label>
                <Select value={selectedVendedor || "__none__"} onValueChange={(val) => setSelectedVendedor(val === "__none__" ? "" : val)}>
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
                <Label htmlFor="tipoCliente">Classificar Tipo de Cliente</Label>
                <Select value={selectedTipoCliente} onValueChange={setSelectedTipoCliente}>
                  <SelectTrigger id="tipoCliente">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CLIENTE.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {hideAttribution ? "Fechar" : "Cancelar"}
          </Button>
          {!hideAttribution && (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Atribuição
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
