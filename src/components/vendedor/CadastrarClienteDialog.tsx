import { useState } from "react";
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
import { toast } from "sonner";

interface CadastrarClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendedorId: string;
  onSuccess: () => void;
}

export function CadastrarClienteDialog({
  open,
  onOpenChange,
  vendedorId,
  onSuccess,
}: CadastrarClienteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome_igreja: "",
    cnpj: "",
    nome_superintendente: "",
    email_superintendente: "",
    telefone: "",
  });

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 18);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome_igreja || !formData.cnpj) {
      toast.error("Nome da Igreja e CNPJ são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("ebd_clientes").insert({
        vendedor_id: vendedorId,
        nome_igreja: formData.nome_igreja,
        cnpj: formData.cnpj.replace(/\D/g, ""),
        nome_superintendente: formData.nome_superintendente || null,
        email_superintendente: formData.email_superintendente || null,
        telefone: formData.telefone || null,
        status_ativacao_ebd: false,
      });

      if (error) {
        if (error.message.includes("duplicate key")) {
          toast.error("Já existe um cliente com este CNPJ");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Cliente cadastrado com sucesso!");
      setFormData({
        nome_igreja: "",
        cnpj: "",
        nome_superintendente: "",
        email_superintendente: "",
        telefone: "",
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error creating cliente:", error);
      toast.error("Erro ao cadastrar cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
          <DialogDescription>
            Preencha os dados do novo cliente. O cliente será atribuído automaticamente a você.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome_igreja">Nome da Igreja *</Label>
            <Input
              id="nome_igreja"
              value={formData.nome_igreja}
              onChange={(e) =>
                setFormData({ ...formData, nome_igreja: e.target.value })
              }
              placeholder="Igreja Assembleia de Deus..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ *</Label>
            <Input
              id="cnpj"
              value={formData.cnpj}
              onChange={(e) =>
                setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })
              }
              placeholder="00.000.000/0000-00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome_superintendente">Nome do Superintendente</Label>
            <Input
              id="nome_superintendente"
              value={formData.nome_superintendente}
              onChange={(e) =>
                setFormData({ ...formData, nome_superintendente: e.target.value })
              }
              placeholder="Nome completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_superintendente">E-mail do Superintendente</Label>
            <Input
              id="email_superintendente"
              type="email"
              value={formData.email_superintendente}
              onChange={(e) =>
                setFormData({ ...formData, email_superintendente: e.target.value })
              }
              placeholder="email@igreja.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={formData.telefone}
              onChange={(e) =>
                setFormData({ ...formData, telefone: e.target.value })
              }
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Cadastrando..." : "Cadastrar Cliente"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
