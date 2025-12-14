import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CalendarIcon, 
  Search, 
  UserPlus, 
  ShoppingCart, 
  ChevronRight,
  CheckCircle,
  SkipForward,
  ExternalLink,
  BookOpen
} from "lucide-react";
import { format, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Cliente {
  id: string;
  cnpj: string;
  nome_igreja: string;
  nome_superintendente: string | null;
  email_superintendente: string | null;
  telefone: string | null;
  dia_aula: string | null;
  status_ativacao_ebd: boolean;
}

interface Revista {
  id: string;
  titulo: string;
  faixa_etaria_alvo: string;
  preco_cheio: number | null;
  estoque: number | null;
  imagem_url: string | null;
}

interface CartItem {
  revista: Revista;
  quantidade: number;
}

export type DialogMode = "full" | "pedido" | "ativacao" | "cadastro";

interface NovoPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendedorId: string;
  clientes: Cliente[];
  onSuccess: () => void;
  initialMode?: DialogMode;
  preSelectedCliente?: Cliente | null;
  initialCart?: CartItem[];
}

const DIAS_AULA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function NovoPedidoDialog({
  open,
  onOpenChange,
  vendedorId,
  clientes,
  onSuccess,
  initialMode = "full",
  preSelectedCliente = null,
  initialCart = [],
}: NovoPedidoDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"cliente" | "catalogo" | "ativacao" | "resumo">("cliente");
  const [clienteTab, setClienteTab] = useState<"existente" | "novo">("existente");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [skippedCatalog, setSkippedCatalog] = useState(false);

  // New client form
  const [novoCliente, setNovoCliente] = useState({
    nome_igreja: "",
    cnpj: "",
    nome_superintendente: "",
    email_superintendente: "",
    telefone: "",
  });

  // Activation form
  const [ativacaoData, setAtivacaoData] = useState({
    dia_aula: "Domingo",
    data_inicio_ebd: undefined as Date | undefined,
  });

  // Handle initial mode and pre-selected client
  useEffect(() => {
    if (open) {
      // Load cart from sessionStorage if available
      const savedCart = sessionStorage.getItem('vendedor-cart');
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          if (parsedCart.length > 0) {
            setCart(parsedCart);
          }
        } catch (e) {
          console.error('Error loading cart:', e);
        }
      }
      
      if (initialCart.length > 0) {
        setCart(initialCart);
      }
      
      if (preSelectedCliente) {
        setSelectedCliente(preSelectedCliente);
        if (initialMode === "ativacao") {
          setSkippedCatalog(true);
          setStep("ativacao");
        } else if (initialMode === "pedido") {
          setStep("catalogo");
        } else {
          setStep("catalogo");
        }
      } else if (initialMode === "cadastro") {
        setClienteTab("novo");
        setStep("cliente");
      } else {
        setStep("cliente");
      }
    }
  }, [open, preSelectedCliente, initialMode, initialCart]);

  const filteredClientes = clientes.filter(
    (c) =>
      c.nome_igreja.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cnpj.includes(searchTerm.replace(/\D/g, ""))
  );

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 18);
  };

  const handleSelectCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setStep("catalogo");
  };

  const handleCreateNovoCliente = async (continueFlow: boolean = true) => {
    if (!novoCliente.nome_igreja || !novoCliente.cnpj) {
      toast.error("Nome da Igreja e CNPJ são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ebd_clientes")
        .insert({
          vendedor_id: vendedorId,
          nome_igreja: novoCliente.nome_igreja,
          cnpj: novoCliente.cnpj.replace(/\D/g, ""),
          nome_superintendente: novoCliente.nome_superintendente || null,
          email_superintendente: novoCliente.email_superintendente || null,
          telefone: novoCliente.telefone || null,
          status_ativacao_ebd: false,
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes("duplicate key")) {
          toast.error("Já existe um cliente com este CNPJ");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Cliente cadastrado!");
      
      if (continueFlow) {
        setSelectedCliente(data as Cliente);
        setStep("catalogo");
      } else {
        // Just close and refresh - cadastro only mode
        handleClose();
        onSuccess();
      }
    } catch (error) {
      console.error("Error creating cliente:", error);
      toast.error("Erro ao cadastrar cliente");
    } finally {
      setLoading(false);
    }
  };

  const cartTotal = cart.reduce(
    (total, item) => total + (item.revista.preco_cheio || 0) * item.quantidade,
    0
  );

  const handleSkipCatalog = () => {
    setSkippedCatalog(true);
    if (!selectedCliente?.status_ativacao_ebd) {
      setStep("ativacao");
    } else {
      setStep("resumo");
    }
  };

  const handleGoToCatalog = () => {
    if (!selectedCliente) return;
    
    // Close dialog and navigate to catalog page
    onOpenChange(false);
    navigate(`/ebd/shopify-pedidos?clienteId=${selectedCliente.id}&clienteNome=${encodeURIComponent(selectedCliente.nome_igreja)}`);
  };

  const handleProceedToActivation = () => {
    if (!selectedCliente?.status_ativacao_ebd) {
      setStep("ativacao");
    } else {
      setStep("resumo");
    }
  };

  const handleFinalizar = async () => {
    if (!selectedCliente) return;

    setLoading(true);
    try {
      // 1. If client needs activation, update their data
      if (!selectedCliente.status_ativacao_ebd && ativacaoData.data_inicio_ebd) {
        const dataProximaCompra = addWeeks(ativacaoData.data_inicio_ebd, 13);

        // Create superintendent user if email provided
        if (selectedCliente.email_superintendente) {
          try {
            await supabase.functions.invoke("create-ebd-user", {
              body: {
                email: selectedCliente.email_superintendente,
                password: Math.random().toString(36).slice(-8) + "A1!",
                fullName: selectedCliente.nome_superintendente || "Superintendente",
              },
            });
          } catch (e) {
            console.error("Error creating user:", e);
          }
        }

        await supabase
          .from("ebd_clientes")
          .update({
            dia_aula: ativacaoData.dia_aula,
            data_inicio_ebd: format(ativacaoData.data_inicio_ebd, "yyyy-MM-dd"),
            data_proxima_compra: format(dataProximaCompra, "yyyy-MM-dd"),
            status_ativacao_ebd: true,
          })
          .eq("id", selectedCliente.id);
      }

      // 2. Create order in system (Bling integration would go here)
      if (cart.length > 0) {
        // For now just log the order - Bling integration can be added later
        console.log("Order for client:", selectedCliente.nome_igreja);
        console.log("Items:", cart);
        console.log("Total:", cartTotal);
        
        // TODO: Call bling-create-order edge function here
      }

      // Clear cart from sessionStorage
      sessionStorage.removeItem('vendedor-cart');

      toast.success(
        skippedCatalog && !selectedCliente.status_ativacao_ebd
          ? "Cliente ativado com sucesso!"
          : "Pedido finalizado com sucesso!"
      );
      
      handleClose();
      onSuccess();
    } catch (error) {
      console.error("Error finalizing order:", error);
      toast.error("Erro ao finalizar");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep("cliente");
    setSelectedCliente(null);
    setCart([]);
    setSearchTerm("");
    setSkippedCatalog(false);
    setNovoCliente({
      nome_igreja: "",
      cnpj: "",
      nome_superintendente: "",
      email_superintendente: "",
      telefone: "",
    });
    setAtivacaoData({
      dia_aula: "Domingo",
      data_inicio_ebd: undefined,
    });
    setClienteTab("existente");
    onOpenChange(false);
  };

  const getDialogTitle = () => {
    if (initialMode === "cadastro") return "Cadastrar Novo Cliente";
    if (initialMode === "ativacao") return "Ativar Painel EBD";
    if (initialMode === "pedido") return "Novo Pedido";
    return "Novo Pedido / Ativação EBD";
  };

  const showProgressSteps = initialMode !== "cadastro";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {getDialogTitle()}
          </DialogTitle>
          <DialogDescription>
            {step === "cliente" && "Selecione ou cadastre um cliente"}
            {step === "catalogo" && `Cliente: ${selectedCliente?.nome_igreja}`}
            {step === "ativacao" && "Configure os dados da ativação EBD"}
            {step === "resumo" && "Confira os dados"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        {showProgressSteps && (
          <div className="flex items-center justify-center gap-2 py-2">
            <Badge variant={step === "cliente" ? "default" : "secondary"}>1. Cliente</Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant={step === "catalogo" ? "default" : skippedCatalog ? "outline" : "secondary"}>
              2. Catálogo {skippedCatalog && "(Pulado)"}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant={step === "ativacao" || step === "resumo" ? "default" : "secondary"}>
              3. {selectedCliente?.status_ativacao_ebd ? "Resumo" : "Ativação"}
            </Badge>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {/* Step 1: Select Client */}
          {step === "cliente" && (
            <Tabs value={clienteTab} onValueChange={(v) => setClienteTab(v as "existente" | "novo")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existente">
                  <Search className="mr-2 h-4 w-4" />
                  Cliente Existente
                </TabsTrigger>
                <TabsTrigger value="novo">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Novo Cliente
                </TabsTrigger>
              </TabsList>

              <TabsContent value="existente" className="mt-4">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou CNPJ..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {filteredClientes.map((cliente) => (
                        <Card
                          key={cliente.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSelectCliente(cliente)}
                        >
                          <CardContent className="p-4 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{cliente.nome_igreja}</p>
                              <p className="text-sm text-muted-foreground">
                                CNPJ: {cliente.cnpj}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {cliente.status_ativacao_ebd ? (
                                <Badge variant="default" className="bg-green-500">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Pendente</Badge>
                              )}
                              <ChevronRight className="h-4 w-4" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {filteredClientes.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhum cliente encontrado
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="novo" className="mt-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome da Igreja *</Label>
                      <Input
                        value={novoCliente.nome_igreja}
                        onChange={(e) =>
                          setNovoCliente({ ...novoCliente, nome_igreja: e.target.value })
                        }
                        placeholder="Igreja Assembleia de Deus..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CNPJ *</Label>
                      <Input
                        value={novoCliente.cnpj}
                        onChange={(e) =>
                          setNovoCliente({ ...novoCliente, cnpj: formatCNPJ(e.target.value) })
                        }
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome do Superintendente</Label>
                      <Input
                        value={novoCliente.nome_superintendente}
                        onChange={(e) =>
                          setNovoCliente({ ...novoCliente, nome_superintendente: e.target.value })
                        }
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail do Superintendente</Label>
                      <Input
                        type="email"
                        value={novoCliente.email_superintendente}
                        onChange={(e) =>
                          setNovoCliente({ ...novoCliente, email_superintendente: e.target.value })
                        }
                        placeholder="email@igreja.com"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Telefone</Label>
                      <Input
                        value={novoCliente.telefone}
                        onChange={(e) =>
                          setNovoCliente({ ...novoCliente, telefone: e.target.value })
                        }
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                  {initialMode === "cadastro" ? (
                    <Button
                      onClick={() => handleCreateNovoCliente(false)}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? "Cadastrando..." : "Cadastrar Cliente"}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleCreateNovoCliente(true)}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? "Cadastrando..." : "Cadastrar e Continuar"}
                    </Button>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Step 2: Catalog - Now just shows options */}
          {step === "catalogo" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="text-center space-y-2">
                <BookOpen className="h-16 w-16 mx-auto text-muted-foreground" />
                <h3 className="text-lg font-semibold">Selecionar Produtos</h3>
                <p className="text-muted-foreground max-w-md">
                  Acesse o catálogo completo para adicionar revistas ao pedido ou pule esta etapa para ativação direta.
                </p>
              </div>

              {cart.length > 0 && (
                <Card className="w-full max-w-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        <span className="font-medium">{cart.length} {cart.length === 1 ? 'item' : 'itens'} no pedido</span>
                      </div>
                      <span className="font-bold text-primary">R$ {cartTotal.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                <Button 
                  size="lg" 
                  className="flex-1"
                  onClick={handleGoToCatalog}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ir para o Catálogo
                </Button>
                {!selectedCliente?.status_ativacao_ebd && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex-1"
                    onClick={handleSkipCatalog}
                  >
                    <SkipForward className="mr-2 h-4 w-4" />
                    Pular Catálogo
                  </Button>
                )}
              </div>

              {cart.length > 0 && (
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleProceedToActivation}
                  className="w-full max-w-md"
                >
                  Continuar com {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Step 3: Activation */}
          {step === "ativacao" && (
            <div className="space-y-4 py-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Dados de Ativação EBD</CardTitle>
                  <CardDescription>
                    Configure os dados para ativar o painel EBD do cliente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dia da Aula *</Label>
                      <Select
                        value={ativacaoData.dia_aula}
                        onValueChange={(value) =>
                          setAtivacaoData({ ...ativacaoData, dia_aula: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o dia" />
                        </SelectTrigger>
                        <SelectContent>
                          {DIAS_AULA.map((dia) => (
                            <SelectItem key={dia} value={dia}>
                              {dia}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Data de Início da EBD *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !ativacaoData.data_inicio_ebd && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {ativacaoData.data_inicio_ebd ? (
                              format(ativacaoData.data_inicio_ebd, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione a data</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={ativacaoData.data_inicio_ebd}
                            onSelect={(date) =>
                              setAtivacaoData({ ...ativacaoData, data_inicio_ebd: date })
                            }
                            initialFocus
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  {ativacaoData.data_inicio_ebd && (
                    <p className="text-sm text-muted-foreground">
                      Próxima compra prevista:{" "}
                      {format(addWeeks(ativacaoData.data_inicio_ebd, 13), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 4: Summary */}
          {step === "resumo" && (
            <div className="space-y-4 py-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {skippedCatalog ? "Resumo da Ativação" : "Resumo do Pedido"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Cliente</Label>
                    <p className="font-medium">{selectedCliente?.nome_igreja}</p>
                    <p className="text-sm text-muted-foreground">
                      CNPJ: {selectedCliente?.cnpj}
                    </p>
                  </div>
                  {cart.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Itens do Pedido</Label>
                      <div className="space-y-1 mt-1">
                        {cart.map((item) => (
                          <div key={item.revista.id} className="flex justify-between text-sm">
                            <span>
                              {item.quantidade}x {item.revista.titulo}
                            </span>
                            <span>
                              R$ {((item.revista.preco_cheio || 0) * item.quantidade).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold border-t pt-1">
                          <span>Total</span>
                          <span>R$ {cartTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {!selectedCliente?.status_ativacao_ebd && ativacaoData.data_inicio_ebd && (
                    <div>
                      <Label className="text-muted-foreground">Ativação EBD</Label>
                      <p className="text-sm">
                        Dia da Aula: <strong>{ativacaoData.dia_aula}</strong>
                      </p>
                      <p className="text-sm">
                        Início:{" "}
                        <strong>
                          {format(ativacaoData.data_inicio_ebd, "dd/MM/yyyy", { locale: ptBR })}
                        </strong>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            {step !== "cliente" && step !== "catalogo" && (
              <Button
                variant="outline"
                onClick={() => {
                  if (step === "ativacao") {
                    if (skippedCatalog && initialMode === "ativacao") {
                      handleClose();
                    } else {
                      setSkippedCatalog(false);
                      setStep("catalogo");
                    }
                  }
                  else if (step === "resumo") {
                    if (selectedCliente?.status_ativacao_ebd) {
                      setStep("catalogo");
                    } else {
                      setStep("ativacao");
                    }
                  }
                }}
              >
                Voltar
              </Button>
            )}
            {step === "ativacao" && (
              <Button
                onClick={() => setStep("resumo")}
                disabled={!ativacaoData.data_inicio_ebd}
              >
                Ver Resumo
              </Button>
            )}
            {step === "resumo" && (
              <Button onClick={handleFinalizar} disabled={loading}>
                {loading ? "Finalizando..." : skippedCatalog ? "Ativar Cliente" : "Finalizar Pedido"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
