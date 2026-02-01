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
import { Search, UserCheck, UserX, Loader2, AlertCircle } from "lucide-react";
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
  
  const [formData, setFormData] = useState({
    nome_completo: "",
    email: "",
    cpf_cnpj: "",
    telefone: "",
    endereco: "",
    banco: "",
    agencia: "",
    conta: "",
    tipo_conta: "corrente",
    pix: "",
    is_active: true,
    user_id: null as string | null,
    desconto_livros_proprios: 0,
  });

  useEffect(() => {
    if (autor) {
      setFormData({
        nome_completo: autor.nome_completo || "",
        email: autor.email || "",
        cpf_cnpj: autor.cpf_cnpj || "",
        telefone: autor.telefone || "",
        endereco: typeof autor.endereco === 'string' ? autor.endereco : "",
        banco: autor.dados_bancarios?.banco || "",
        agencia: autor.dados_bancarios?.agencia || "",
        conta: autor.dados_bancarios?.conta || "",
        tipo_conta: autor.dados_bancarios?.tipo_conta || "corrente",
        pix: autor.dados_bancarios?.pix || "",
        is_active: autor.is_active ?? true,
        user_id: autor.user_id || null,
        desconto_livros_proprios: autor.desconto_livros_proprios || 0,
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
        banco: "",
        agencia: "",
        conta: "",
        tipo_conta: "corrente",
        pix: "",
        is_active: true,
        user_id: null,
        desconto_livros_proprios: 0,
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
        setFormData({ ...formData, user_id: data.id });
        toast({ title: "Usuário encontrado!" });
      } else {
        setFoundUser(null);
        setFormData({ ...formData, user_id: null });
        toast({
          title: "Usuário não encontrado",
          description: "Nenhum usuário com este email foi encontrado.",
          variant: "destructive",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dados_bancarios = {
        banco: formData.banco,
        agencia: formData.agencia,
        conta: formData.conta,
        tipo_conta: formData.tipo_conta,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {autor ? "Editar Autor" : "Novo Autor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Link Section */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              {foundUser ? (
                <UserCheck className="h-4 w-4 text-green-600" />
              ) : (
                <UserX className="h-4 w-4 text-muted-foreground" />
              )}
              Vincular a Usuário (Acesso ao Portal)
            </h4>
            
            {foundUser ? (
              <div className="flex items-center justify-between p-3 bg-background rounded-md border">
                <div>
                  <p className="font-medium">{foundUser.full_name || "Sem nome"}</p>
                  <p className="text-sm text-muted-foreground">{foundUser.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600">Vinculado</Badge>
                  <Button type="button" variant="outline" size="sm" onClick={unlinkUser}>
                    Desvincular
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o email do usuário..."
                  value={userSearchEmail}
                  onChange={(e) => setUserSearchEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchUserByEmail())}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={searchUserByEmail}
                  disabled={searchingUser}
                >
                  {searchingUser ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Vincule este autor a um usuário existente para que ele tenha acesso ao portal de autores.
            </p>
          </div>

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

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Dados Bancários</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="banco">Banco</Label>
                <Input
                  id="banco"
                  value={formData.banco}
                  onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                  placeholder="Ex: 001 - Banco do Brasil"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agencia">Agência</Label>
                <Input
                  id="agencia"
                  value={formData.agencia}
                  onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="conta">Conta</Label>
                <Input
                  id="conta"
                  value={formData.conta}
                  onChange={(e) => setFormData({ ...formData, conta: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo_conta">Tipo de Conta</Label>
                <select
                  id="tipo_conta"
                  value={formData.tipo_conta}
                  onChange={(e) => setFormData({ ...formData, tipo_conta: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="corrente">Conta Corrente</option>
                  <option value="poupanca">Conta Poupança</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pix">Chave PIX</Label>
                <Input
                  id="pix"
                  value={formData.pix}
                  onChange={(e) => setFormData({ ...formData, pix: e.target.value })}
                  placeholder="CPF, CNPJ, Email, Telefone ou Chave Aleatória"
                />
              </div>
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
