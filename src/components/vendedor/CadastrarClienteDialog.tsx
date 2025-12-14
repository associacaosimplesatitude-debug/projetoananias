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
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { MapPin, User, Building, Lock, Phone, Pencil } from "lucide-react";

interface Cliente {
  id: string;
  tipo_cliente: string | null;
  nome_igreja: string;
  nome_responsavel: string | null;
  email_superintendente: string | null;
  telefone: string | null;
  possui_cnpj: boolean | null;
  cnpj: string;
  cpf: string | null;
  endereco_cep: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  senha_temporaria: string | null;
  pode_faturar?: boolean;
}

interface CadastrarClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendedorId: string;
  onSuccess: () => void;
  clienteParaEditar?: Cliente | null;
}

const TIPOS_CLIENTE = ["Igreja", "Lojista", "Pessoa Física"] as const;

const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export function CadastrarClienteDialog({
  open,
  onOpenChange,
  vendedorId,
  onSuccess,
  clienteParaEditar,
}: CadastrarClienteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipo_cliente: "Igreja" as string,
    nome_igreja: "",
    nome_responsavel: "",
    email_superintendente: "",
    senha: "",
    telefone: "",
    possui_cnpj: true,
    documento: "",
    endereco_cep: "",
    endereco_rua: "",
    endereco_numero: "",
    endereco_complemento: "",
    endereco_bairro: "",
    endereco_cidade: "",
    endereco_estado: "",
    pode_faturar: false,
  });
  const [loadingCep, setLoadingCep] = useState(false);

  const isEditMode = !!clienteParaEditar;

  // Populate form when editing
  useEffect(() => {
    if (clienteParaEditar && open) {
      const documento = clienteParaEditar.possui_cnpj 
        ? formatCNPJ(clienteParaEditar.cnpj || "")
        : formatCPF(clienteParaEditar.cpf || "");
      
      setFormData({
        tipo_cliente: clienteParaEditar.tipo_cliente || "Igreja",
        nome_igreja: clienteParaEditar.nome_igreja || "",
        nome_responsavel: clienteParaEditar.nome_responsavel || "",
        email_superintendente: clienteParaEditar.email_superintendente || "",
        senha: "",
        telefone: formatPhone(clienteParaEditar.telefone || ""),
        possui_cnpj: clienteParaEditar.possui_cnpj ?? true,
        documento: documento,
        endereco_cep: formatCEP(clienteParaEditar.endereco_cep || ""),
        endereco_rua: clienteParaEditar.endereco_rua || "",
        endereco_numero: clienteParaEditar.endereco_numero || "",
        endereco_complemento: clienteParaEditar.endereco_complemento || "",
        endereco_bairro: clienteParaEditar.endereco_bairro || "",
        endereco_cidade: clienteParaEditar.endereco_cidade || "",
        endereco_estado: clienteParaEditar.endereco_estado || "",
        pode_faturar: clienteParaEditar.pode_faturar ?? false,
      });
    }
  }, [clienteParaEditar, open]);

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 18);
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .substring(0, 14);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 10) {
      return numbers
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .substring(0, 15);
  };

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.replace(/(\d{5})(\d)/, "$1-$2").substring(0, 9);
  };

  const handleCepChange = async (value: string) => {
    const formattedCep = formatCEP(value);
    setFormData({ ...formData, endereco_cep: formattedCep });

    const cepNumbers = value.replace(/\D/g, "");
    if (cepNumbers.length === 8) {
      setLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepNumbers}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            endereco_cep: formattedCep,
            endereco_rua: data.logradouro || "",
            endereco_bairro: data.bairro || "",
            endereco_cidade: data.localidade || "",
            endereco_estado: data.uf || "",
          }));
        }
      } catch (error) {
        console.error("Error fetching CEP:", error);
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleDocumentoChange = (value: string) => {
    const formatted = formData.possui_cnpj ? formatCNPJ(value) : formatCPF(value);
    setFormData({ ...formData, documento: formatted });
  };

  const resetForm = () => {
    setFormData({
      tipo_cliente: "Igreja",
      nome_igreja: "",
      nome_responsavel: "",
      email_superintendente: "",
      senha: "",
      telefone: "",
      possui_cnpj: true,
      documento: "",
      endereco_cep: "",
      endereco_rua: "",
      endereco_numero: "",
      endereco_complemento: "",
      endereco_bairro: "",
      endereco_cidade: "",
      endereco_estado: "",
      pode_faturar: false,
    });
  };

  const generateRandomPassword = () => {
    return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome_igreja || !formData.documento || !formData.email_superintendente) {
      toast.error("Nome, Documento e E-mail são obrigatórios");
      return;
    }

    if (!formData.endereco_cep || !formData.endereco_numero) {
      toast.error("CEP e Número do endereço são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const documentoLimpo = formData.documento.replace(/\D/g, "");
      const senhaGerada = formData.senha || generateRandomPassword();
      
      const clienteData = {
        tipo_cliente: formData.tipo_cliente,
        nome_igreja: formData.nome_igreja,
        nome_responsavel: formData.nome_responsavel || null,
        email_superintendente: formData.email_superintendente,
        telefone: formData.telefone.replace(/\D/g, "") || null,
        possui_cnpj: formData.possui_cnpj,
        cnpj: formData.possui_cnpj ? documentoLimpo : "",
        cpf: !formData.possui_cnpj ? documentoLimpo : null,
        endereco_cep: formData.endereco_cep.replace(/\D/g, ""),
        endereco_rua: formData.endereco_rua,
        endereco_numero: formData.endereco_numero,
        endereco_complemento: formData.endereco_complemento || null,
        endereco_bairro: formData.endereco_bairro,
        endereco_cidade: formData.endereco_cidade,
        endereco_estado: formData.endereco_estado,
        pode_faturar: formData.pode_faturar,
        senha_temporaria: senhaGerada,
      };

      if (isEditMode && clienteParaEditar) {
        const { error } = await supabase
          .from("ebd_clientes")
          .update(clienteData)
          .eq("id", clienteParaEditar.id);

        if (error) throw error;
        toast.success("Cliente atualizado com sucesso!");
      } else {
        // First, create the cliente record
        const { data: novoCliente, error: insertError } = await supabase
          .from("ebd_clientes")
          .insert({
            ...clienteData,
            vendedor_id: vendedorId,
            status_ativacao_ebd: false,
          })
          .select()
          .single();

        if (insertError) {
          if (insertError.message.includes("duplicate key")) {
            toast.error("Já existe um cliente com este documento");
          } else {
            throw insertError;
          }
          return;
        }

        // Then, create the auth user automatically
        try {
          const { data: authResponse, error: authError } = await supabase.functions.invoke('create-ebd-user', {
            body: {
              email: formData.email_superintendente,
              password: senhaGerada,
              fullName: formData.nome_responsavel || formData.nome_igreja,
              clienteId: novoCliente.id,
            }
          });

          if (authError) {
            console.error('Error creating auth user:', authError);
            toast.warning("Cliente cadastrado, mas houve um erro ao criar o acesso. Use a função de ativação.");
          } else {
            console.log('Auth user created successfully:', authResponse);
          }
        } catch (authFuncError) {
          console.error('Error calling create-ebd-user:', authFuncError);
          toast.warning("Cliente cadastrado, mas houve um erro ao criar o acesso. Use a função de ativação.");
        }

        toast.success("Cliente cadastrado com sucesso! Senha: " + senhaGerada);
      }

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error saving cliente:", error);
      toast.error(isEditMode ? "Erro ao atualizar cliente" : "Erro ao cadastrar cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) resetForm(); onOpenChange(open); }}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <Pencil className="h-5 w-5" />
                Editar Cliente
              </>
            ) : (
              <>
                <Building className="h-5 w-5" />
                Cadastrar Novo Cliente
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Atualize os dados do cliente conforme necessário."
              : "Preencha os dados do novo cliente. O cliente será atribuído automaticamente a você."
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Tipo de Cliente */}
              <div className="space-y-2">
                <Label>Tipo de Cliente *</Label>
                <Select
                  value={formData.tipo_cliente}
                  onValueChange={(value) => setFormData({ ...formData, tipo_cliente: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CLIENTE.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dados Básicos */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome_igreja">
                    {formData.tipo_cliente === "Pessoa Física" ? "Nome *" : "Nome da Igreja/Empresa *"}
                  </Label>
                  <Input
                    id="nome_igreja"
                    value={formData.nome_igreja}
                    onChange={(e) => setFormData({ ...formData, nome_igreja: e.target.value })}
                    placeholder={formData.tipo_cliente === "Pessoa Física" ? "Nome completo" : "Igreja Assembleia de Deus..."}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nome_responsavel">
                    <User className="inline h-4 w-4 mr-1" />
                    Nome do Responsável
                  </Label>
                  <Input
                    id="nome_responsavel"
                    value={formData.nome_responsavel}
                    onChange={(e) => setFormData({ ...formData, nome_responsavel: e.target.value })}
                    placeholder="Nome do responsável"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail (Login) *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email_superintendente}
                    onChange={(e) => setFormData({ ...formData, email_superintendente: e.target.value })}
                    placeholder="email@igreja.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha">
                    <Lock className="inline h-4 w-4 mr-1" />
                    {isEditMode ? "Nova Senha (deixe vazio para manter)" : "Senha de Acesso"}
                  </Label>
                  <Input
                    id="senha"
                    type="password"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    placeholder={isEditMode ? "Nova senha (opcional)" : "Senha temporária"}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">
                  <Phone className="inline h-4 w-4 mr-1" />
                  WhatsApp
                </Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: formatPhone(e.target.value) })}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <Separator />

              {/* Documento */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Possui CNPJ?</Label>
                  <Switch
                    checked={formData.possui_cnpj}
                    onCheckedChange={(checked) => setFormData({ ...formData, possui_cnpj: checked, documento: "" })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="documento">
                    {formData.possui_cnpj ? "CNPJ *" : "RG / CPF *"}
                  </Label>
                  <Input
                    id="documento"
                    value={formData.documento}
                    onChange={(e) => handleDocumentoChange(e.target.value)}
                    placeholder={formData.possui_cnpj ? "00.000.000/0000-00" : "000.000.000-00"}
                    required
                  />
                </div>
              </div>

              <Separator />

              {/* Faturamento B2B */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <div>
                    <Label className="text-base font-semibold text-blue-700 dark:text-blue-400">Pode Faturar (B2B)</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite pagamento em 30/60/90 dias via boleto
                    </p>
                  </div>
                  <Switch
                    checked={formData.pode_faturar}
                    onCheckedChange={(checked) => setFormData({ ...formData, pode_faturar: checked })}
                  />
                </div>
              </div>

              <Separator />

              {/* Endereço de Entrega */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <MapPin className="h-5 w-5 text-primary" />
                  Endereço de Entrega
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP * {loadingCep && "(Buscando...)"}</Label>
                    <Input
                      id="cep"
                      value={formData.endereco_cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      placeholder="00000-000"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número *</Label>
                    <Input
                      id="numero"
                      value={formData.endereco_numero}
                      onChange={(e) => setFormData({ ...formData, endereco_numero: e.target.value })}
                      placeholder="123"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="complemento">Complemento</Label>
                    <Input
                      id="complemento"
                      value={formData.endereco_complemento}
                      onChange={(e) => setFormData({ ...formData, endereco_complemento: e.target.value })}
                      placeholder="Apt 101"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rua">Rua</Label>
                  <Input
                    id="rua"
                    value={formData.endereco_rua}
                    onChange={(e) => setFormData({ ...formData, endereco_rua: e.target.value })}
                    placeholder="Rua / Avenida"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      value={formData.endereco_bairro}
                      onChange={(e) => setFormData({ ...formData, endereco_bairro: e.target.value })}
                      placeholder="Bairro"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={formData.endereco_cidade}
                      onChange={(e) => setFormData({ ...formData, endereco_cidade: e.target.value })}
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado (UF)</Label>
                    <Select
                      value={formData.endereco_estado}
                      onValueChange={(value) => setFormData({ ...formData, endereco_estado: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BR.map((uf) => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading 
                ? (isEditMode ? "Salvando..." : "Cadastrando...") 
                : (isEditMode ? "Salvar Alterações" : "Cadastrar Cliente")
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
