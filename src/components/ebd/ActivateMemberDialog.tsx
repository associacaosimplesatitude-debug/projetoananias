import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ActivateMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: any;
  churchId: string;
  onSuccess: () => void;
}

export default function ActivateMemberDialog({
  open,
  onOpenChange,
  member,
  churchId,
  onSuccess,
}: ActivateMemberDialogProps) {
  const [isAluno, setIsAluno] = useState(false);
  const [isProfessor, setIsProfessor] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const hasEmail = !!member?.email;

  const handleActivate = async () => {
    if (!isAluno && !isProfessor) {
      toast.error("Selecione pelo menos uma função (Aluno ou Professor)");
      return;
    }

    if (hasEmail && !password) {
      toast.error("Digite uma senha para criar as credenciais de acesso");
      return;
    }

    setIsLoading(true);

    try {
      let userId = null;

      // Create user credentials if email exists and password provided
      if (hasEmail && password) {
        const { data, error } = await supabase.functions.invoke("create-ebd-user", {
          body: {
            email: member.email,
            password,
            fullName: member.nome_completo,
          },
        });

        if (error) throw error;
        userId = data.userId;
      }

      // Activate as Aluno
      if (isAluno) {
        const { error } = await supabase.from("ebd_alunos").insert({
          church_id: churchId,
          member_id: member.id,
          user_id: userId,
          nome_completo: member.nome_completo,
          email: member.email,
          telefone: member.whatsapp,
          data_nascimento: member.data_aniversario,
          is_active: true,
        });

        if (error) {
          if (error.code === "23505") {
            toast.error("Este membro já está cadastrado como aluno");
          } else {
            throw error;
          }
        }
      }

      // Activate as Professor
      if (isProfessor) {
        const { error } = await supabase.from("ebd_professores").insert({
          church_id: churchId,
          member_id: member.id,
          user_id: userId,
          nome_completo: member.nome_completo,
          email: member.email,
          telefone: member.whatsapp,
          is_active: true,
        });

        if (error) {
          if (error.code === "23505") {
            toast.error("Este membro já está cadastrado como professor");
          } else {
            throw error;
          }
        }
      }

      toast.success(
        `Membro ativado como ${[isAluno && "Aluno", isProfessor && "Professor"]
          .filter(Boolean)
          .join(" e ")}!`
      );
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error activating member:", error);
      toast.error(error.message || "Erro ao ativar membro");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ativar Membro na EBD</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Nome:</strong> {member?.nome_completo}
            </p>
            {member?.email && (
              <p className="text-sm text-muted-foreground">
                <strong>Email:</strong> {member.email}
              </p>
            )}
            {member?.whatsapp && (
              <p className="text-sm text-muted-foreground">
                <strong>WhatsApp:</strong> {member.whatsapp}
              </p>
            )}
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="aluno-toggle">Ativar como Aluno EBD</Label>
              <Switch
                id="aluno-toggle"
                checked={isAluno}
                onCheckedChange={setIsAluno}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="professor-toggle">Ativar como Professor EBD</Label>
              <Switch
                id="professor-toggle"
                checked={isProfessor}
                onCheckedChange={setIsProfessor}
              />
            </div>
          </div>

          {hasEmail && (isAluno || isProfessor) && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="password">
                Senha de Acesso
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite a senha para criar credenciais"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Uma conta será criada para este membro acessar o sistema
              </p>
            </div>
          )}

          {!hasEmail && (isAluno || isProfessor) && (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm text-muted-foreground">
                Este membro não possui email cadastrado. Será criado o cadastro EBD sem credenciais de acesso.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleActivate} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Ativar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}