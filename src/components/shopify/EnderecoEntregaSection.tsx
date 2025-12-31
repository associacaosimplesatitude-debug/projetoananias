import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MapPin, Plus, Home, Building, Loader2, ChevronDown, ChevronUp, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Endereco {
  id: string;
  nome: string;
  sobrenome?: string | null;
  cpf_cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  cep: string;
  rua: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  estado: string;
}

interface EnderecoEntregaSectionProps {
  clienteId: string | null;
  clienteEndereco?: {
    rua?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
  } | null;
  clienteNome?: string | null;
  onEnderecoChange: (endereco: Endereco | null) => void;
  selectedEndereco: Endereco | null;
}

export function EnderecoEntregaSection({
  clienteId,
  clienteEndereco,
  clienteNome,
  onEnderecoChange,
  selectedEndereco
}: EnderecoEntregaSectionProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("principal");
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [newEndereco, setNewEndereco] = useState({
    nome: "", sobrenome: "", cpf_cnpj: "", email: "", telefone: "",
    cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: ""
  });

  const queryClient = useQueryClient();

  // Fetch saved addresses for this specific client
  const { data: enderecosSalvos } = useQuery({
    queryKey: ["enderecos-entrega", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const { data, error } = await supabase
        .from("ebd_endereco_entrega")
        .select("*")
        .eq("user_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Endereco[];
    },
    enabled: !!clienteId
  });

  // Create principal address from cliente data
  const enderecoPrincipal: Endereco | null = clienteEndereco?.rua ? {
    id: "principal",
    nome: clienteNome || "Endereço Principal",
    cep: clienteEndereco.cep || "",
    rua: clienteEndereco.rua || "",
    numero: clienteEndereco.numero || "",
    bairro: clienteEndereco.bairro || "",
    cidade: clienteEndereco.cidade || "",
    estado: clienteEndereco.estado || ""
  } : null;

  // Set default selection when data loads
  useEffect(() => {
    if (enderecoPrincipal && !selectedEndereco) {
      onEnderecoChange(enderecoPrincipal);
      setSelectedId("principal");
    }
  }, [enderecoPrincipal]);

  const handleSelectEndereco = (id: string) => {
    setSelectedId(id);
    if (id === "principal" && enderecoPrincipal) {
      onEnderecoChange(enderecoPrincipal);
    } else {
      const encontrado = enderecosSalvos?.find(e => e.id === id);
      onEnderecoChange(encontrado || null);
    }
    setIsOpen(false);
  };

  // CEP lookup
  const handleCepChange = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    setNewEndereco(prev => ({ ...prev, cep: cleanCep }));
    
    if (cleanCep.length === 8) {
      setIsLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setNewEndereco(prev => ({
            ...prev,
            rua: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            estado: data.uf || ""
          }));
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  // Save new address
  const saveEndereco = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error("Cliente não selecionado");
      
      // Check if address with same name already exists for this client
      const { data: existing } = await supabase
        .from("ebd_endereco_entrega")
        .select("id")
        .eq("user_id", clienteId)
        .eq("nome", newEndereco.nome)
        .maybeSingle();
      
      if (existing) {
        // Update existing address
        const { data, error } = await supabase
          .from("ebd_endereco_entrega")
          .update({
            sobrenome: newEndereco.sobrenome || null,
            cpf_cnpj: newEndereco.cpf_cnpj || null,
            email: newEndereco.email || null,
            telefone: newEndereco.telefone || null,
            cep: newEndereco.cep,
            rua: newEndereco.rua,
            numero: newEndereco.numero,
            complemento: newEndereco.complemento || null,
            bairro: newEndereco.bairro,
            cidade: newEndereco.cidade,
            estado: newEndereco.estado
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Insert new address
        const { data, error } = await supabase
          .from("ebd_endereco_entrega")
          .insert({
            user_id: clienteId,
            nome: newEndereco.nome,
            sobrenome: newEndereco.sobrenome || null,
            cpf_cnpj: newEndereco.cpf_cnpj || null,
            email: newEndereco.email || null,
            telefone: newEndereco.telefone || null,
            cep: newEndereco.cep,
            rua: newEndereco.rua,
            numero: newEndereco.numero,
            complemento: newEndereco.complemento || null,
            bairro: newEndereco.bairro,
            cidade: newEndereco.cidade,
            estado: newEndereco.estado
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["enderecos-entrega", clienteId] });
      setShowAddDialog(false);
      setNewEndereco({
        nome: "", sobrenome: "", cpf_cnpj: "", email: "", telefone: "",
        cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: ""
      });
      setSelectedId(data.id);
      onEnderecoChange(data);
      toast.success("Endereço salvo com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar endereço: " + error.message);
    }
  });

  const formatCep = (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length >= 5) {
      return `${clean.slice(0, 5)}-${clean.slice(5, 8)}`;
    }
    return clean;
  };

  // Get display name for selected address
  const getSelectedDisplay = () => {
    if (selectedId === "principal" && enderecoPrincipal) {
      return {
        nome: "Endereço Principal",
        resumo: `${enderecoPrincipal.cidade}/${enderecoPrincipal.estado}`
      };
    }
    const encontrado = enderecosSalvos?.find(e => e.id === selectedId);
    if (encontrado) {
      return {
        nome: encontrado.nome,
        resumo: `${encontrado.cidade}/${encontrado.estado}`
      };
    }
    return null;
  };

  const selectedDisplay = getSelectedDisplay();

  return (
    <div className="space-y-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors w-full text-left py-1">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">Endereço de Entrega</span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
          {clienteId && (
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Novo
            </Button>
          )}
        </div>

        {/* Compact selected address preview (shown when collapsed) */}
        {!isOpen && selectedDisplay && (
          <div className="flex items-center gap-2 py-2 px-2 bg-muted/50 rounded-md text-xs">
            <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
            <span className="font-medium">{selectedDisplay.nome}</span>
            <span className="text-muted-foreground">• {selectedDisplay.resumo}</span>
          </div>
        )}

        <CollapsibleContent className="space-y-2 pt-2">
          <RadioGroup value={selectedId} onValueChange={handleSelectEndereco}>
            {/* Principal address */}
            {enderecoPrincipal && (
              <div className={`flex items-start space-x-2 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                selectedId === "principal" ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
              }`}>
                <RadioGroupItem value="principal" id="endereco-principal" className="mt-0.5 h-3.5 w-3.5" />
                <label htmlFor="endereco-principal" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-1.5">
                    <Home className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">Endereço Principal</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 leading-tight">
                    {enderecoPrincipal.rua}, {enderecoPrincipal.numero} • {enderecoPrincipal.bairro}
                  </p>
                  <p className="text-muted-foreground leading-tight">
                    {enderecoPrincipal.cidade}/{enderecoPrincipal.estado} • CEP: {formatCep(enderecoPrincipal.cep)}
                  </p>
                </label>
              </div>
            )}

            {/* Saved addresses */}
            {enderecosSalvos?.map((endereco) => (
              <div key={endereco.id} className={`flex items-start space-x-2 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                selectedId === endereco.id ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
              }`}>
                <RadioGroupItem value={endereco.id} id={`endereco-${endereco.id}`} className="mt-0.5 h-3.5 w-3.5" />
                <label htmlFor={`endereco-${endereco.id}`} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-1.5">
                    <Building className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{endereco.nome}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 leading-tight">
                    {endereco.rua}, {endereco.numero} • {endereco.bairro}
                  </p>
                  <p className="text-muted-foreground leading-tight">
                    {endereco.cidade}/{endereco.estado} • CEP: {formatCep(endereco.cep)}
                  </p>
                </label>
              </div>
            ))}
          </RadioGroup>
        </CollapsibleContent>
      </Collapsible>

      {!enderecoPrincipal && (!enderecosSalvos || enderecosSalvos.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-2">Nenhum endereço cadastrado</p>
            {clienteId && (
              <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-3 w-3 mr-1" />
                Cadastrar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Address Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Endereço de Entrega</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={newEndereco.nome}
                  onChange={(e) => setNewEndereco(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Casa, Trabalho"
                />
              </div>
              <div>
                <Label htmlFor="sobrenome">Sobrenome</Label>
                <Input
                  id="sobrenome"
                  value={newEndereco.sobrenome}
                  onChange={(e) => setNewEndereco(prev => ({ ...prev, sobrenome: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cep">CEP *</Label>
              <div className="relative">
                <Input
                  id="cep"
                  value={formatCep(newEndereco.cep)}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {isLoadingCep && (
                  <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label htmlFor="rua">Rua *</Label>
                <Input
                  id="rua"
                  value={newEndereco.rua}
                  onChange={(e) => setNewEndereco(prev => ({ ...prev, rua: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="numero">Número *</Label>
                <Input
                  id="numero"
                  value={newEndereco.numero}
                  onChange={(e) => setNewEndereco(prev => ({ ...prev, numero: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="complemento">Complemento</Label>
              <Input
                id="complemento"
                value={newEndereco.complemento}
                onChange={(e) => setNewEndereco(prev => ({ ...prev, complemento: e.target.value }))}
                placeholder="Apto, Bloco, etc."
              />
            </div>

            <div>
              <Label htmlFor="bairro">Bairro *</Label>
              <Input
                id="bairro"
                value={newEndereco.bairro}
                onChange={(e) => setNewEndereco(prev => ({ ...prev, bairro: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cidade">Cidade *</Label>
                <Input
                  id="cidade"
                  value={newEndereco.cidade}
                  onChange={(e) => setNewEndereco(prev => ({ ...prev, cidade: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="estado">Estado *</Label>
                <Input
                  id="estado"
                  value={newEndereco.estado}
                  onChange={(e) => setNewEndereco(prev => ({ ...prev, estado: e.target.value }))}
                  maxLength={2}
                  placeholder="SP"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={newEndereco.telefone}
                onChange={(e) => setNewEndereco(prev => ({ ...prev, telefone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveEndereco.mutate()}
              disabled={
                !newEndereco.nome ||
                !newEndereco.cep ||
                !newEndereco.rua ||
                !newEndereco.numero ||
                !newEndereco.bairro ||
                !newEndereco.cidade ||
                !newEndereco.estado ||
                saveEndereco.isPending
              }
            >
              {saveEndereco.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Endereço"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}