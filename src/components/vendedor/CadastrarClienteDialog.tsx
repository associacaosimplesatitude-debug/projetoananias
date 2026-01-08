import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { MapPin, User, Building, Lock, Phone, Pencil, Search, CheckCircle2, Loader2 } from "lucide-react";
import { DescontosCategoriaSection } from "./DescontosCategoriaSection";

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
  status_ativacao_ebd?: boolean;
  superintendente_user_id?: string | null;
  bling_cliente_id?: number | null;
}

interface CadastrarClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendedorId: string;
  onSuccess: () => void;
  clienteParaEditar?: Cliente | null;
  isRepresentante?: boolean;
}

// Opções padronizadas - EXATAS conforme solicitação
const TIPOS_CLIENTE = [
  { value: "", label: "Não classificado" },
  { value: "ADVECS", label: "ADVECS" },
  { value: "IGREJA CNPJ", label: "IGREJA CNPJ" },
  { value: "IGREJA CPF", label: "IGREJA CPF" },
  { value: "LOJISTA", label: "LOJISTA" },
  { value: "PESSOA FÍSICA", label: "PESSOA FÍSICA" },
  { value: "REVENDEDOR", label: "REVENDEDOR" },
];

// Tipos que usam CPF ao invés de CNPJ (forçado)
const TIPOS_COM_CPF = ["IGREJA CPF", "PESSOA FÍSICA"];
// Tipos que podem escolher entre CPF ou CNPJ
const TIPOS_COM_DOCUMENTO_FLEXIVEL = ["REVENDEDOR", ""];
// Tipos que podem ter documento opcional ou não definido
const TIPOS_SEM_DOCUMENTO_OBRIGATORIO = [""];

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
  isRepresentante = false,
}: CadastrarClienteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingBling, setLoadingBling] = useState(false);
  const [blingClienteEncontrado, setBlingClienteEncontrado] = useState(false);
  const [blingClienteId, setBlingClienteId] = useState<number | null>(null);
  const [documentoJaBuscado, setDocumentoJaBuscado] = useState("");
  const [formData, setFormData] = useState({
    tipo_cliente: isRepresentante ? "REPRESENTANTE" : "none" as string,
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
  const [clienteExistenteAlert, setClienteExistenteAlert] = useState<{
    open: boolean;
    nomeVendedor: string;
    nomeCliente: string;
  }>({ open: false, nomeVendedor: "", nomeCliente: "" });

  const isEditMode = !!clienteParaEditar;

  // Populate form when editing
  useEffect(() => {
    if (clienteParaEditar && open) {
      // Determinar possui_cnpj baseado no tipo ou nos dados existentes
      const tipoCliente = clienteParaEditar.tipo_cliente || "";
      const usaCpf = TIPOS_COM_CPF.includes(tipoCliente);
      const possuiCnpj = usaCpf ? false : (clienteParaEditar.possui_cnpj ?? true);
      
      // Formatar documento baseado no tipo de documento
      const documento = possuiCnpj 
        ? formatCNPJ(clienteParaEditar.cnpj || "")
        : formatCPF(clienteParaEditar.cpf || "");
      
      // Converter tipos antigos para os novos (compatibilidade)
      let tipoClienteNormalizado = tipoCliente;
      if (tipoCliente === "IGREJA ADVECS") tipoClienteNormalizado = "ADVECS";
      if (tipoCliente === "IGREJA (Não-ADVECS)") {
        tipoClienteNormalizado = possuiCnpj ? "IGREJA CNPJ" : "IGREJA CPF";
      }
      if (tipoCliente === "Igreja CNPJ") tipoClienteNormalizado = "IGREJA CNPJ";
      if (tipoCliente === "Igreja CPF") tipoClienteNormalizado = "IGREJA CPF";
      if (tipoCliente === "VAREJO") tipoClienteNormalizado = "LOJISTA";
      if (tipoCliente === "LIVRARIA") tipoClienteNormalizado = "LOJISTA";
      
      // Se o tipo não existe nas novas opções, usar "none" (não classificado)
      const tiposValidos = TIPOS_CLIENTE.map(t => t.value);
      if (!tiposValidos.includes(tipoClienteNormalizado)) {
        tipoClienteNormalizado = "none";
      }
      
      setFormData({
        tipo_cliente: tipoClienteNormalizado,
        nome_igreja: clienteParaEditar.nome_igreja || "",
        nome_responsavel: clienteParaEditar.nome_responsavel || "",
        email_superintendente: clienteParaEditar.email_superintendente || "",
        senha: "",
        telefone: formatPhone(clienteParaEditar.telefone || ""),
        possui_cnpj: possuiCnpj,
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
    
    // Reset Bling status when document changes
    if (formatted !== documentoJaBuscado) {
      setBlingClienteEncontrado(false);
      setBlingClienteId(null);
    }
  };

  // Busca cliente no Bling quando o documento está completo
  const buscarClienteNoBling = useCallback(async () => {
    const documentoLimpo = formData.documento.replace(/\D/g, "");
    const tamanhoEsperado = formData.possui_cnpj ? 14 : 11;
    
    // Só busca se o documento está completo e ainda não foi buscado
    if (documentoLimpo.length !== tamanhoEsperado || documentoLimpo === documentoJaBuscado || isEditMode) {
      return;
    }
    
    setLoadingBling(true);
    setDocumentoJaBuscado(documentoLimpo);
    
    try {
      console.log('Buscando cliente no Bling:', documentoLimpo);
      
      const { data, error } = await supabase.functions.invoke('bling-search-client', {
        body: { cpf_cnpj: documentoLimpo },
      });
      
      if (error) {
        console.error('Erro ao buscar cliente no Bling:', error);
        return;
      }
      
      if (data?.found && data?.cliente) {
        console.log('Cliente encontrado no Bling:', data.cliente);
        setBlingClienteEncontrado(true);
        setBlingClienteId(data.cliente.bling_cliente_id);
        
        // Preencher formulário com dados do Bling
        const clienteBling = data.cliente;
        
        setFormData(prev => ({
          ...prev,
          nome_igreja: clienteBling.nome || clienteBling.fantasia || prev.nome_igreja,
          nome_responsavel: clienteBling.fantasia || prev.nome_responsavel,
          email_superintendente: clienteBling.email || prev.email_superintendente,
          telefone: formatPhone(clienteBling.telefone || clienteBling.celular || prev.telefone),
          endereco_cep: formatCEP(clienteBling.endereco_cep || prev.endereco_cep),
          endereco_rua: clienteBling.endereco_rua || prev.endereco_rua,
          endereco_numero: clienteBling.endereco_numero || prev.endereco_numero,
          endereco_complemento: clienteBling.endereco_complemento || prev.endereco_complemento,
          endereco_bairro: clienteBling.endereco_bairro || prev.endereco_bairro,
          endereco_cidade: clienteBling.endereco_cidade || prev.endereco_cidade,
          endereco_estado: clienteBling.endereco_estado || prev.endereco_estado,
          // Não sobrescrever tipo_cliente para representantes
          tipo_cliente: isRepresentante ? "REPRESENTANTE" : (clienteBling.tipo_pessoa === 'F' ? 'PESSOA FÍSICA' : 'ADVECS'),
        }));
        
        toast.success('Cliente encontrado no Bling! Dados preenchidos automaticamente.');
      } else {
        console.log('Cliente não encontrado no Bling');
        setBlingClienteEncontrado(false);
        setBlingClienteId(null);
      }
    } catch (err) {
      console.error('Erro ao buscar cliente no Bling:', err);
    } finally {
      setLoadingBling(false);
    }
  }, [formData.documento, formData.possui_cnpj, documentoJaBuscado, isEditMode]);

  // Efeito para buscar no Bling quando documento está completo
  useEffect(() => {
    const documentoLimpo = formData.documento.replace(/\D/g, "");
    const tamanhoEsperado = formData.possui_cnpj ? 14 : 11;
    
    if (documentoLimpo.length === tamanhoEsperado && documentoLimpo !== documentoJaBuscado && !isEditMode) {
      const timeoutId = setTimeout(() => {
        buscarClienteNoBling();
      }, 500); // Debounce de 500ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [formData.documento, formData.possui_cnpj, buscarClienteNoBling, documentoJaBuscado, isEditMode]);

  const resetForm = () => {
    setFormData({
      tipo_cliente: isRepresentante ? "REPRESENTANTE" : "none",
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
    setBlingClienteEncontrado(false);
    setBlingClienteId(null);
    setDocumentoJaBuscado("");
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
      
      // Normaliza tipo_cliente: "none" significa não classificado
      const tipoClienteParaSalvar = formData.tipo_cliente === "none" ? null : formData.tipo_cliente;
      
      const clienteData = {
        tipo_cliente: tipoClienteParaSalvar,
        nome_igreja: formData.nome_igreja,
        nome_responsavel: formData.nome_responsavel || null,
        email_superintendente: formData.email_superintendente,
        telefone: formData.telefone.replace(/\D/g, "") || null,
        possui_cnpj: formData.possui_cnpj,
        cnpj: formData.possui_cnpj ? documentoLimpo : null,
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
        // Inclui ID do cliente no Bling se foi encontrado
        ...(blingClienteId && { bling_cliente_id: blingClienteId }),
      };

      if (isEditMode && clienteParaEditar) {
        // Atualiza os dados do cliente
        const { error } = await supabase
          .from("ebd_clientes")
          .update(clienteData)
          .eq("id", clienteParaEditar.id);

        if (error) throw error;

        // Escolhe a senha a ser usada para o acesso do superintendente
        const senhaParaLogin = formData.senha || clienteParaEditar.senha_temporaria || senhaGerada;

        // Sempre garante que exista/atualize o usuário de login quando houver e-mail de superintendente
        if (formData.email_superintendente) {
          try {
            const { data: authResp, error: authError } = await supabase.functions.invoke('create-ebd-user', {
              body: {
                email: formData.email_superintendente,
                password: senhaParaLogin,
                fullName: formData.nome_responsavel || formData.nome_igreja,
                clienteId: clienteParaEditar.id,
              },
            });

            if (authError) {
              console.error('Erro ao criar/atualizar usuário do cliente (edição):', authError, authResp);
              toast.warning('Dados do cliente atualizados, mas houve erro ao atualizar o acesso de login.');
            } else if (!clienteParaEditar.senha_temporaria || formData.senha) {
              // Só mostramos a senha se ela for nova ou se antes não havia senha temporária
              toast.success('Cliente atualizado! Nova senha de acesso: ' + senhaParaLogin);
            } else {
              toast.success('Cliente atualizado com sucesso!');
            }
          } catch (authFuncError) {
            console.error('Erro ao chamar create-ebd-user na edição:', authFuncError);
            toast.warning('Dados do cliente atualizados, mas houve erro ao atualizar o acesso de login.');
          }
        } else {
          toast.success('Cliente atualizado com sucesso!');
        }
      } else {
        let novoCliente: any;
        
        // Primeiro tenta inserir o cliente
        const { data: clienteCriado, error: insertError } = await supabase
          .from("ebd_clientes")
          .insert({
            ...clienteData,
            vendedor_id: vendedorId,
            status_ativacao_ebd: false,
          })
          .select()
          .single();

        if (insertError) {
          // Se for erro de duplicidade, o cliente já existe
          if (insertError.code === "23505") {
            // Busca o cliente existente para ver quem é o vendedor
            // Usando RPC ou query direta para verificar
            const { data: clienteExistente } = await supabase
              .from("ebd_clientes")
              .select(`
                id, 
                vendedor_id, 
                nome_igreja,
                vendedor:vendedores!ebd_clientes_vendedor_id_fkey(id, nome)
              `)
              .or(`cnpj.eq.${documentoLimpo},cpf.eq.${documentoLimpo}`)
              .maybeSingle();
            
            if (clienteExistente) {
              if (clienteExistente.vendedor_id === vendedorId) {
                toast.error("Este cliente já está na sua carteira");
                setLoading(false);
                return;
              }
              
              if (clienteExistente.vendedor_id) {
                const nomeVendedor = (clienteExistente.vendedor as any)?.nome || "outro vendedor";
                setClienteExistenteAlert({
                  open: true,
                  nomeVendedor,
                  nomeCliente: clienteExistente.nome_igreja || "Cliente",
                });
                setLoading(false);
                return;
              }
              
              // Cliente existe sem vendedor - vincular
              const { data: clienteAtualizado, error: updateError } = await supabase
                .from("ebd_clientes")
                .update({
                  ...clienteData,
                  vendedor_id: vendedorId,
                })
                .eq("id", clienteExistente.id)
                .select()
                .single();

              if (updateError) {
                console.error("Erro ao vincular cliente:", updateError);
                throw updateError;
              }

              novoCliente = clienteAtualizado;
              toast.success(`Cliente "${clienteExistente.nome_igreja}" vinculado à sua carteira!`);
            } else {
              // Cliente existe mas não conseguimos buscar (RLS) - informar que já existe
              setClienteExistenteAlert({
                open: true,
                nomeVendedor: "outro vendedor",
                nomeCliente: formData.nome_igreja || "Este cliente",
              });
              setLoading(false);
              return;
            }
          } else {
            console.error("Erro ao cadastrar cliente:", insertError);
            throw insertError;
          }
        } else {
          novoCliente = clienteCriado;
        }

        // Cria/atualiza o usuário de autenticação
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
            console.error('Error creating auth user:', authError, authResponse);
            toast.warning("Cliente cadastrado, mas houve um erro ao criar o acesso. Use a função de ativação.");
          } else {
            console.log('Auth user created successfully:', authResponse);
          }
        } catch (authFuncError) {
          console.error('Error calling create-ebd-user:', authFuncError);
          toast.warning("Cliente cadastrado, mas houve um erro ao criar o acesso. Use a função de ativação.");
        }

        // Só mostra mensagem de senha se foi cadastrado (novo cliente)
        if (novoCliente && clienteCriado) {
          toast.success("Cliente cadastrado com sucesso! Senha: " + senhaGerada);
        }
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
    <>
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
              {/* 1. Documento (CNPJ/CPF) - PRIMEIRO */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="documento">
                      {formData.possui_cnpj ? "CNPJ *" : "CPF *"}
                    </Label>
                    {/* Switch para escolher entre CPF/CNPJ - apenas para tipos flexíveis */}
                    {(TIPOS_COM_DOCUMENTO_FLEXIVEL.includes(formData.tipo_cliente) || formData.tipo_cliente === "none") && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor="usar-cpf" className="text-sm text-muted-foreground cursor-pointer">
                          Usar CPF
                        </Label>
                        <Switch
                          id="usar-cpf"
                          checked={!formData.possui_cnpj}
                          onCheckedChange={(usarCpf) => {
                            setFormData(prev => ({
                              ...prev,
                              possui_cnpj: !usarCpf,
                              documento: "" // Limpa o documento ao trocar o tipo
                            }));
                            // Resetar busca do Bling
                            setBlingClienteEncontrado(false);
                            setBlingClienteId(null);
                            setDocumentoJaBuscado("");
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="documento"
                      value={formData.documento}
                      onChange={(e) => handleDocumentoChange(e.target.value)}
                      placeholder={formData.possui_cnpj ? "00.000.000/0000-00" : "000.000.000-00"}
                      required
                      className={blingClienteEncontrado ? "border-green-500 pr-10" : ""}
                    />
                    {loadingBling && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {blingClienteEncontrado && !loadingBling && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Feedback de busca no Bling */}
                {loadingBling && (
                  <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                    <Search className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-700 dark:text-blue-400">
                      Buscando cliente no sistema de faturamento...
                    </AlertDescription>
                  </Alert>
                )}
                
                {blingClienteEncontrado && !loadingBling && (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      Cliente encontrado no Bling! Dados preenchidos automaticamente.
                      {blingClienteId && <span className="text-xs ml-2">(ID: {blingClienteId})</span>}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* 2. Tipo de Cliente - SEGUNDO */}
              {/* Ocultar para representantes - tipo é fixo como REPRESENTANTE */}
              {!isRepresentante && (
                <div className="space-y-2">
                  <Label>Tipo de Cliente *</Label>
                  <Select
                    value={formData.tipo_cliente}
                    onValueChange={(value) => {
                      const usaCpfForcado = TIPOS_COM_CPF.includes(value);
                      const podeEscolher = TIPOS_COM_DOCUMENTO_FLEXIVEL.includes(value) || value === "none";
                      
                      // Se for tipo que força CPF, definir possui_cnpj = false
                      // Se for tipo flexível, manter a escolha atual
                      // Se for outro tipo (força CNPJ), definir possui_cnpj = true
                      let novoPossuiCnpj = formData.possui_cnpj;
                      if (usaCpfForcado) {
                        novoPossuiCnpj = false;
                      } else if (!podeEscolher) {
                        novoPossuiCnpj = true;
                      }
                      
                      setFormData({ 
                        ...formData, 
                        tipo_cliente: value,
                        possui_cnpj: novoPossuiCnpj,
                        documento: formData.possui_cnpj !== novoPossuiCnpj ? "" : formData.documento
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_CLIENTE.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value || "none"}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />


              {/* Dados Básicos */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome_igreja">Nome da Igreja/Empresa *</Label>
                  <Input
                    id="nome_igreja"
                    value={formData.nome_igreja}
                    onChange={(e) => setFormData({ ...formData, nome_igreja: e.target.value })}
                    placeholder="Igreja Assembleia de Deus..."
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

              {/* Seção de Descontos por Categoria (apenas para representantes) */}
              {isRepresentante && (
                <>
                  <Separator />
                  <DescontosCategoriaSection 
                    clienteId={clienteParaEditar?.id || null}
                    isRepresentante={isRepresentante}
                  />
                </>
              )}

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

    {/* Alert Dialog para cliente já pertencente a outro vendedor */}
    <AlertDialog 
      open={clienteExistenteAlert.open} 
      onOpenChange={(open) => setClienteExistenteAlert(prev => ({ ...prev, open }))}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive flex items-center gap-2">
            ⚠️ Cliente já cadastrado
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            O cliente <strong>"{clienteExistenteAlert.nomeCliente}"</strong> já está cadastrado 
            e pertence ao vendedor <strong>{clienteExistenteAlert.nomeVendedor}</strong>.
            <br /><br />
            Não é possível cadastrar este cliente na sua carteira.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setClienteExistenteAlert({ open: false, nomeVendedor: "", nomeCliente: "" })}>
            Entendi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
