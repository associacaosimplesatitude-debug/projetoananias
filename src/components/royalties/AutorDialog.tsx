import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Search, UserCheck, UserX, Loader2, AlertCircle, Eye, EyeOff, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCPFCNPJ, getDocumentError } from "@/lib/royaltiesValidators";
import { AutorDescontosSection } from "./AutorDescontosSection";
import { Separator } from "@/components/ui/separator";

interface AutorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autor?: {
    id: string;
    nome_completo: string;
    email: string;
    cpf_cnpj: string | null;
    telefone: string | null;
    endereco: string | null;
    dados_bancarios: any | null;
    is_active: boolean;
    user_id: string | null;
    desconto_livros_proprios?: number | null;
  } | null;
}

interface UserSearchResult {
  id: string;
  email: string;
  full_name: string | null;
}

export function AutorDialog({ open, onOpenChange, autor }: AutorDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [searchingUser, setSearchingUser] = useState(false);
  const [foundUser, setFoundUser] = useState<UserSearchResult | null>(null);
  const [userSearchEmail, setUserSearchEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  
  const [formData, setFormData] = useState({
    nome_completo: "",
    email: "",
    cpf_cnpj: "",
    telefone: "",
    endereco: "",
    pix: "",
    is_active: true,
    user_id: null as string | null,
    desconto_livros_proprios: 0,
    senha: "",
  });

  useEffect(() => {
    if (autor) {
      setFormData({
        nome_completo: autor.nome_completo || "",
        email: autor.email || "",
        cpf_cnpj: autor.cpf_cnpj || "",
        telefone: autor.telefone || "",
        endereco: typeof autor.endereco === 'string' ? autor.endereco : "",
        pix: autor.dados_bancarios?.pix || "",
        is_active: autor.is_active ?? true,
        user_id: autor.user_id || null,
        desconto_livros_proprios: autor.desconto_livros_proprios || 0,
        senha: "",
      });
      setUserSearchEmail(autor.email || "");
      
      // Load linked user info if exists
      if (autor.user_id) {
        loadUserInfo(autor.user_id);
      } else {
        setFoundUser(null);
      }
    } else {
      setFormData({
        nome_completo: "",
        email: "",
        cpf_cnpj: "",
        telefone: "",
        endereco: "",
        pix: "",
        is_active: true,
        user_id: null,
        desconto_livros_proprios: 0,
        senha: "",
      });
      setUserSearchEmail("");
      setFoundUser(null);
    }
  }, [autor, open]);

  const loadUserInfo = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", userId)
      .single();
    
    if (data) {
      setFoundUser({
        id: data.id,
        email: data.email || "",
        full_name: data.full_name,
      });
    }
  };

  const searchUserByEmail = async () => {
    if (!userSearchEmail.trim()) {
      toast({
        title: "Digite um email",
        description: "Informe o email do usuário para buscar.",
        variant: "destructive",
      });
      return;
    }

    setSearchingUser(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .ilike("email", userSearchEmail.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Check if this user is already linked to another author
        const { data: existingAutor } = await supabase
          .from("royalties_autores")
          .select("id, nome_completo")
          .eq("user_id", data.id)
          .neq("id", autor?.id || "00000000-0000-0000-0000-000000000000")
          .maybeSingle();

        if (existingAutor) {
          toast({
            title: "Usuário já vinculado",
            description: `Este usuário já está vinculado ao autor "${existingAutor.nome_completo}".`,
            variant: "destructive",
          });
          setFoundUser(null);
          return;
        }

        setFoundUser({
          id: data.id,
          email: data.email || "",
          full_name: data.full_name,
        });
        setFormData({ ...formData, user_id: data.id, senha: "" });
        toast({ title: "Usuário encontrado!" });
      } else {
        setFoundUser(null);
        setFormData({ ...formData, user_id: null });
        toast({
          title: "Usuário não encontrado",
          description: "Nenhum usuário com este email foi encontrado. Você pode criar um novo informando a senha.",
        });
      }
    } catch (error: any) {
      console.error("Erro ao buscar usuário:", error);
      toast({
        title: "Erro na busca",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSearchingUser(false);
    }
  };

  const unlinkUser = () => {
    setFoundUser(null);
    setFormData({ ...formData, user_id: null });
    toast({ title: "Vínculo removido" });
  };

  const createUserAccount = async () => {
    if (!formData.email.trim()) {
      toast({
        title: "Email obrigatório",
        description: "Informe o email do autor.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.senha || formData.senha.length < 6) {
      toast({
        title: "Senha inválida",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setCreatingUser(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-autor-user', {
        body: {
          email: formData.email.trim().toLowerCase(),
          password: formData.senha,
          fullName: formData.nome_completo.trim(),
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      const userId = response.data.userId;
      
      setFoundUser({
        id: userId,
        email: formData.email.trim().toLowerCase(),
        full_name: formData.nome_completo.trim(),
      });
      setFormData({ ...formData, user_id: userId, senha: "" });
      
      toast({ 
        title: "Conta criada com sucesso!", 
        description: "O autor já pode acessar o portal com o email e senha informados." 
      });
    } catch (error: any) {
      console.error("Erro ao criar conta:", error);
      toast({
        title: "Erro ao criar conta",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // If password is provided and no user linked yet, create user first
      if (formData.senha && formData.senha.length >= 6 && !formData.user_id) {
        await createUserAccount();
        // If createUserAccount was successful, formData.user_id will be set
        // but we need to get the updated value
      }

      const dados_bancarios = {
        pix: formData.pix,
      };

      const payload = {
        nome_completo: formData.nome_completo.trim(),
        email: formData.email.trim().toLowerCase(),
        cpf_cnpj: formData.cpf_cnpj || null,
        telefone: formData.telefone || null,
        endereco: formData.endereco || null,
        dados_bancarios,
        is_active: formData.is_active,
        user_id: formData.user_id,
        desconto_livros_proprios: formData.desconto_livros_proprios,
      };

      if (autor?.id) {
        const { error } = await supabase
          .from("royalties_autores")
          .update(payload)
          .eq("id", autor.id);

        if (error) throw error;
        
        // If user is linked, update their role to 'autor'
        if (formData.user_id && formData.is_active) {
          await ensureAutorRole(formData.user_id);
        }
        
        toast({ title: "Autor atualizado com sucesso!" });
      } else {
        const { data, error } = await supabase
          .from("royalties_autores")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        
        // If user is linked, update their role to 'autor'
        if (formData.user_id && data) {
          await ensureAutorRole(formData.user_id);
        }
        
        toast({ title: "Autor cadastrado com sucesso!" });

        // Disparo automático de email de dados de acesso em background
        if (data && formData.email && formData.senha) {
          supabase.functions.invoke("send-royalties-email", {
            body: {
              autorId: data.id,
              templateCode: "autor_acesso",
              tipoEnvio: "automatico",
              dados: {
                senha_temporaria: formData.senha,
                link_login: "https://gestaoebd.com.br/login/autor",
              },
            },
          }).then(() => {
            toast({ title: "Email de acesso enviado ao autor." });
          }).catch((err) => {
            console.error("Erro ao enviar email de acesso:", err);
            toast({
              title: "Autor cadastrado, mas houve erro ao enviar email de acesso.",
              variant: "destructive",
            });
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["royalties-autores"] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar autor:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const ensureAutorRole = async (userId: string) => {
    // Check if user already has the 'autor' role
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "autor")
      .maybeSingle();

    if (!existingRole) {
      // Add autor role
      await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "autor" });
    }
  };

  const isEditing = !!autor?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {autor ? "Editar Autor" : "Novo Autor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome_completo">Nome Completo *</Label>
              <Input
                id="nome_completo"
                value={formData.nome_completo}
                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
              <div className="space-y-1">
                <Input
                  id="cpf_cnpj"
                  value={formData.cpf_cnpj}
                  onChange={(e) => {
                    const formatted = formatCPFCNPJ(e.target.value);
                    setFormData({ ...formData, cpf_cnpj: formatted });
                  }}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  maxLength={18}
                  className={getDocumentError(formData.cpf_cnpj) ? "border-destructive" : ""}
                />
                {getDocumentError(formData.cpf_cnpj) && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getDocumentError(formData.cpf_cnpj)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Textarea
              id="endereco"
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              rows={2}
            />
          </div>

          {/* User Access Section */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Acesso ao Portal do Autor
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Defina uma senha para que o autor possa acessar o portal. O email de acesso será o mesmo cadastrado acima.
            </p>
            
            {foundUser ? (
              <div className="flex items-center justify-between p-3 bg-background rounded-md border">
                <div>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-green-600" />
                    <p className="font-medium">{foundUser.full_name || "Sem nome"}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{foundUser.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600">Conta Ativa</Badge>
                  <Button type="button" variant="outline" size="sm" onClick={unlinkUser}>
                    Desvincular
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">

                {/* Create new user with password */}
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha de Acesso</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="senha"
                        type={showPassword ? "text" : "password"}
                        value={formData.senha}
                        onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                        placeholder="Mínimo 6 caracteres"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={createUserAccount}
                      disabled={creatingUser || !formData.senha || formData.senha.length < 6 || !formData.email}
                    >
                      {creatingUser ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Criar Conta"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ao informar uma senha, uma conta será criada automaticamente para o autor acessar o portal.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Dados Bancários</h4>
            <div className="space-y-2">
              <Label htmlFor="pix">Chave PIX</Label>
              <Input
                id="pix"
                value={formData.pix}
                onChange={(e) => setFormData({ ...formData, pix: e.target.value })}
                placeholder="CPF, CNPJ, Email, Telefone ou Chave Aleatória"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Autor ativo</Label>
          </div>

          <Separator className="my-4" />

          {/* Seção de Descontos */}
          <AutorDescontosSection
            autorId={autor?.id || null}
            descontoLivrosProprios={formData.desconto_livros_proprios}
            onDescontoLivrosPropriosChange={(val) => setFormData({ ...formData, desconto_livros_proprios: val })}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : autor ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
