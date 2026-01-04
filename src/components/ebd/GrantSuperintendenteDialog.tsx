import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, ShieldOff, Loader2 } from "lucide-react";

interface GrantSuperintendenteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professor: {
    id: string;
    nome_completo: string;
    user_id: string | null;
  } | null;
  churchId: string;
}

export function GrantSuperintendenteDialog({
  open,
  onOpenChange,
  professor,
  churchId,
}: GrantSuperintendenteDialogProps) {
  const queryClient = useQueryClient();

  // Check if professor already has superintendente role
  const { data: hasRole, isLoading: checkingRole } = useQuery({
    queryKey: ["professor-superintendente-role", professor?.user_id, churchId],
    queryFn: async () => {
      if (!professor?.user_id) return false;

      // Use RPC (security definer) para evitar recursão de RLS no ebd_user_roles
      const { data, error } = await supabase.rpc("has_ebd_role", {
        _user_id: professor.user_id,
        _church_id: churchId,
        _role: "superintendente",
      });

      if (error) {
        console.error("Error checking role:", error);
        return false;
      }

      return !!data;
    },
    enabled: !!professor?.user_id && open,
  });

  // Grant superintendente role
  const grantMutation = useMutation({
    mutationFn: async () => {
      if (!professor?.user_id) throw new Error("Professor sem acesso ao sistema");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from("ebd_user_roles").upsert(
        {
          user_id: professor.user_id,
          church_id: churchId,
          role: "superintendente",
          granted_by: user.id,
        },
        { onConflict: "user_id,church_id,role" }
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professor-superintendente-role"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-professores"] });
      queryClient.invalidateQueries({ queryKey: ["is-superintendente-check"] });
      toast.success(`Acesso de Superintendente concedido a ${professor?.nome_completo}`);
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Error granting role:", error);
      if (error.code === "23505") {
        toast.error("Este professor já possui acesso de Superintendente");
      } else {
        toast.error("Erro ao conceder acesso de Superintendente");
      }
    },
  });

  // Revoke superintendente role
  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (!professor?.user_id) throw new Error("Professor sem acesso ao sistema");

      const { error } = await supabase
        .from("ebd_user_roles")
        .delete()
        .eq("user_id", professor.user_id)
        .eq("church_id", churchId)
        .eq("role", "superintendente");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professor-superintendente-role"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-professores"] });
      queryClient.invalidateQueries({ queryKey: ["is-superintendente-check"] });
      toast.success(`Acesso de Superintendente removido de ${professor?.nome_completo}`);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error revoking role:", error);
      toast.error("Erro ao remover acesso de Superintendente");
    },
  });

  const isLoading = grantMutation.isPending || revokeMutation.isPending;

  if (!professor) return null;

  // Professor doesn't have user_id - can't grant access
  if (!professor.user_id) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Acesso de Superintendente
            </AlertDialogTitle>
            <AlertDialogDescription>
              O professor <strong>{professor.nome_completo}</strong> não possui acesso ao sistema (login).
              <br /><br />
              Para conceder acesso de Superintendente, primeiro crie um acesso de usuário para este professor 
              através do botão "Editar" e preenchendo o campo de senha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (checkingRole) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Verificando permissões...
            </AlertDialogTitle>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // If already has role, show revoke dialog
  if (hasRole) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldOff className="h-5 w-5" />
              Remover Acesso de Superintendente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja <strong>remover</strong> o acesso de Superintendente de{" "}
              <strong>{professor.nome_completo}</strong>?
              <br /><br />
              O professor continuará com acesso normal de professor, mas perderá acesso às 
              funcionalidades administrativas (dashboard, relatórios, gestão de turmas, etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeMutation.mutate()}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                <>
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Remover Acesso
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Show grant dialog
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Conceder Acesso de Superintendente
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja conceder acesso de <strong>Superintendente</strong> a{" "}
            <strong>{professor.nome_completo}</strong>?
            <br /><br />
            <span className="text-foreground font-medium">Com este acesso, o professor poderá:</span>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>Acessar o dashboard administrativo</li>
              <li>Gerenciar todos os alunos e professores</li>
              <li>Visualizar e gerar relatórios</li>
              <li>Acessar a loja e realizar pedidos</li>
              <li>Configurar turmas e escalas</li>
            </ul>
            <br />
            O professor continuará aparecendo na lista de professores e poderá ministrar aulas normalmente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => grantMutation.mutate()}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Concedendo...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Conceder Acesso
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
