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
  } | null;
}

export function AutorDialog({ open, onOpenChange, autor }: AutorDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
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
  });

  useEffect(() => {
    if (autor) {
      setFormData({
        nome_completo: autor.nome_completo || "",
        email: autor.email || "",
        cpf_cnpj: autor.cpf_cnpj || "",
        telefone: autor.telefone || "",
        endereco: autor.endereco || "",
        banco: autor.dados_bancarios?.banco || "",
        agencia: autor.dados_bancarios?.agencia || "",
        conta: autor.dados_bancarios?.conta || "",
        tipo_conta: autor.dados_bancarios?.tipo_conta || "corrente",
        pix: autor.dados_bancarios?.pix || "",
        is_active: autor.is_active ?? true,
      });
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
      });
    }
  }, [autor, open]);

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
      };

      if (autor?.id) {
        const { error } = await supabase
          .from("royalties_autores")
          .update(payload)
          .eq("id", autor.id);

        if (error) throw error;
        toast({ title: "Autor atualizado com sucesso!" });
      } else {
        const { error } = await supabase
          .from("royalties_autores")
          .insert(payload);

        if (error) throw error;
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
              <Input
                id="cpf_cnpj"
                value={formData.cpf_cnpj}
                onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
              />
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
