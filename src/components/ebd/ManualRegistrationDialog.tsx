import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ManualRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  onSuccess: () => void;
}

export default function ManualRegistrationDialog({
  open,
  onOpenChange,
  churchId,
  onSuccess,
}: ManualRegistrationDialogProps) {
  const [formData, setFormData] = useState({
    nome_completo: "",
    data_nascimento: "",
    email: "",
    whatsapp: "",
    password: "",
  });
  const [isAluno, setIsAluno] = useState(false);
  const [isProfessor, setIsProfessor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAluno && !isProfessor) {
      toast.error("Selecione pelo menos uma função (Aluno ou Professor)");
      return;
    }

    if (!formData.nome_completo || !formData.data_nascimento || !formData.whatsapp) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (formData.email && !formData.password) {
      toast.error("Digite uma senha para criar as credenciais de acesso");
      return;
    }

    setIsLoading(true);

    try {
      let userId = null;

      // Create user credentials if email and password provided
      if (formData.email && formData.password) {
        const { data, error } = await supabase.functions.invoke("create-ebd-user", {
          body: {
            email: formData.email,
            password: formData.password,
            fullName: formData.nome_completo,
          },
        });

        if (error) throw error;
        userId = data.userId;
      }

      // Activate as Aluno
      if (isAluno) {
        const { error } = await supabase.from("ebd_alunos").insert({
          church_id: churchId,
          user_id: userId,
          nome_completo: formData.nome_completo,
          email: formData.email || null,
          telefone: formData.whatsapp,
          data_nascimento: formData.data_nascimento,
          is_active: true,
        });

        if (error) throw error;
      }

      // Activate as Professor
      if (isProfessor) {
        const { error } = await supabase.from("ebd_professores").insert({
          church_id: churchId,
          user_id: userId,
          nome_completo: formData.nome_completo,
          email: formData.email || null,
          telefone: formData.whatsapp,
          is_active: true,
        });

        if (error) throw error;
      }

      toast.success(
        `Cadastro criado como ${[isAluno && "Aluno", isProfessor && "Professor"]
          .filter(Boolean)
          .join(" e ")}!`
      );
      onSuccess();
      onOpenChange(false);
      setFormData({
        nome_completo: "",
        data_nascimento: "",
        email: "",
        whatsapp: "",
        password: "",
      });
      setIsAluno(false);
      setIsProfessor(false);
    } catch (error: any) {
      console.error("Error creating registration:", error);
      toast.error(error.message || "Erro ao criar cadastro");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Cadastro Manual</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome_completo">
              Nome Completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nome_completo"
              value={formData.nome_completo}
              onChange={(e) =>
                setFormData({ ...formData, nome_completo: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_nascimento">
              Data de Nascimento <span className="text-destructive">*</span>
            </Label>
            <Input
              id="data_nascimento"
              type="date"
              value={formData.data_nascimento}
              onChange={(e) =>
                setFormData({ ...formData, data_nascimento: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">
              WhatsApp <span className="text-destructive">*</span>
            </Label>
            <Input
              id="whatsapp"
              value={formData.whatsapp}
              onChange={(e) =>
                setFormData({ ...formData, whatsapp: e.target.value })
              }
              required
            />
          </div>

          {formData.email && (
            <div className="space-y-2">
              <Label htmlFor="password">
                Senha de Acesso <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Necessária para criar credenciais de acesso ao sistema
              </p>
            </div>
          )}

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="aluno-toggle-manual">Cadastrar como Aluno EBD</Label>
              <Switch
                id="aluno-toggle-manual"
                checked={isAluno}
                onCheckedChange={setIsAluno}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="professor-toggle-manual">
                Cadastrar como Professor EBD
              </Label>
              <Switch
                id="professor-toggle-manual"
                checked={isProfessor}
                onCheckedChange={setIsProfessor}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}