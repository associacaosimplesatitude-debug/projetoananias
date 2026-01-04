import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Users, UserPlus, User, Pencil, Trash2, Shield, MoreVertical } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditProfessorDialog } from "@/components/ebd/EditProfessorDialog";
import { CreateProfessorDialog } from "@/components/ebd/CreateProfessorDialog";
import { GrantSuperintendenteDialog } from "@/components/ebd/GrantSuperintendenteDialog";
import { useCanManageEbdRoles } from "@/hooks/useEbdUserRoles";
import { toast } from "sonner";

interface Professor {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  user_id: string | null;
  member_id: string | null;
}

interface ProfessorWithRoles extends Professor {
  hasSuperintendenteRole: boolean;
}

export default function EBDTeachers() {
  const { clientId } = useParams();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [creatingProfessor, setCreatingProfessor] = useState(false);
  const [editingProfessor, setEditingProfessor] = useState<Professor | null>(null);
  const [deletingProfessor, setDeletingProfessor] = useState<Professor | null>(null);
  const [managingAccess, setManagingAccess] = useState<Professor | null>(null);

  const { data: churchData, isLoading: isLoadingChurch } = useQuery({
    queryKey: ["user-church", clientId],
    queryFn: async () => {
      if (clientId) {
        return { id: clientId };
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Primeiro tentar buscar em ebd_clientes (superintendentes EBD)
      const { data: ebdCliente } = await supabase
        .from("ebd_clientes")
        .select("id")
        .eq("superintendente_user_id", user.id)
        .eq("status_ativacao_ebd", true)
        .maybeSingle();

      if (ebdCliente) {
        return { id: ebdCliente.id };
      }

      // Fallback para churches (clientes tradicionais)
      const { data: church } = await supabase
        .from("churches")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (church) {
        return { id: church.id };
      }

      throw new Error("Nenhuma igreja encontrada para este usuário");
    },
  });

  // Check if current user can manage roles
  const { canManage: canManageRoles, isLoading: isLoadingRoles } = useCanManageEbdRoles(churchData?.id);
  const { data: professores } = useQuery({
    queryKey: ["ebd-professores", churchData?.id, searchTerm],
    queryFn: async () => {
      if (!churchData?.id) return [];

      let query = supabase
        .from("ebd_professores")
        .select("id, nome_completo, email, telefone, avatar_url, is_active, user_id, member_id")
        .eq("church_id", churchData.id);

      if (searchTerm) {
        query = query.ilike("nome_completo", `%${searchTerm}%`);
      }

      const { data, error } = await query.order("nome_completo");
      if (error) throw error;
      
      // Fetch superintendente roles for professors with user_id
      const professorUserIds = data
        .filter((p: Professor) => p.user_id)
        .map((p: Professor) => p.user_id);

      let roleMap: Record<string, boolean> = {};
      
      if (professorUserIds.length > 0) {
        const { data: roles } = await supabase
          .from("ebd_user_roles")
          .select("user_id")
          .eq("church_id", churchData.id)
          .eq("role", "superintendente")
          .in("user_id", professorUserIds);

        if (roles) {
          roles.forEach((r) => {
            roleMap[r.user_id] = true;
          });
        }
      }

      return data.map((p: Professor) => ({
        ...p,
        hasSuperintendenteRole: p.user_id ? !!roleMap[p.user_id] : false,
      })) as ProfessorWithRoles[];
    },
    enabled: !!churchData?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (professorId: string) => {
      const { error } = await supabase
        .from("ebd_professores")
        .delete()
        .eq("id", professorId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebd-professores"] });
      toast.success("Professor excluído com sucesso!");
      setDeletingProfessor(null);
    },
    onError: (error) => {
      console.error("Erro ao excluir professor:", error);
      toast.error("Erro ao excluir professor. Verifique se não está vinculado a escalas.");
    },
  });

  if (isLoadingChurch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!churchData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Nenhuma igreja encontrada</p>
        </div>
      </div>
    );
  }

  // DEBUG: Log role management status
  console.log("[ROLES DEBUG]", { 
    churchId: churchData?.id, 
    canManageRoles, 
    isLoadingRoles 
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* DEBUG: Status temporário */}
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded text-sm">
          <strong>DEBUG:</strong> Você está como superintendente: <strong>{canManageRoles ? "SIM" : "NÃO"}</strong>
          {isLoadingRoles && " (carregando...)"}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cadastro de Professores</h1>
            <p className="text-muted-foreground">Gerencie professores da EBD</p>
          </div>

          <Button onClick={() => setCreatingProfessor(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Cadastrar professor
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Lista de Professores
            </CardTitle>
            <CardDescription>Professores cadastrados no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {!professores || professores.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum professor encontrado</p>
                <p className="text-sm mb-4">Cadastre o primeiro professor para começar</p>
                <Button onClick={() => setCreatingProfessor(true)} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Cadastrar professor
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {professores.map((professor) => (
                  <Card key={professor.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={professor.avatar_url || undefined} />
                          <AvatarFallback>
                            <User className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{professor.nome_completo}</h3>
                            <Badge variant="secondary">Professor</Badge>
                            {professor.hasSuperintendenteRole && (
                              <Badge className="bg-primary/10 text-primary border-primary/20">
                                <Shield className="w-3 h-3 mr-1" />
                                Superintendente
                              </Badge>
                            )}
                            {professor.user_id && !professor.hasSuperintendenteRole && (
                              <Badge variant="outline" className="text-xs">
                                <UserPlus className="w-3 h-3 mr-1" />
                                Acesso
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            {professor.email && <p>Email: {professor.email}</p>}
                            {professor.telefone && <p>Telefone: {professor.telefone}</p>}
                            {professor.member_id && (
                              <Badge variant="outline" className="text-xs">
                                Vinculado ao Cadastro de Membros
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setEditingProfessor(professor)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          
                          {/* Botão visível para gerenciar superintendente */}
                          {canManageRoles && professor.user_id && (
                            <Button
                              variant={professor.hasSuperintendenteRole ? "destructive" : "default"}
                              size="sm"
                              onClick={() => setManagingAccess(professor)}
                              className="gap-1"
                            >
                              <Shield className="h-4 w-4" />
                              {professor.hasSuperintendenteRole 
                                ? "Remover Superintendente" 
                                : "Tornar Superintendente"}
                            </Button>
                          )}

                          {/* Mensagem se professor não tem user_id */}
                          {canManageRoles && !professor.user_id && (
                            <span className="text-xs text-muted-foreground">
                              (sem acesso ao sistema)
                            </span>
                          )}
                          
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingProfessor(professor)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateProfessorDialog
        open={creatingProfessor}
        onOpenChange={setCreatingProfessor}
        churchId={churchData.id}
      />

      <EditProfessorDialog
        open={!!editingProfessor}
        onOpenChange={(open) => !open && setEditingProfessor(null)}
        professor={editingProfessor}
        churchId={churchData.id}
      />

      <AlertDialog open={!!deletingProfessor} onOpenChange={(open) => !open && setDeletingProfessor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Professor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o professor "{deletingProfessor?.nome_completo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingProfessor && deleteMutation.mutate(deletingProfessor.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GrantSuperintendenteDialog
        open={!!managingAccess}
        onOpenChange={(open) => !open && setManagingAccess(null)}
        professor={managingAccess}
        churchId={churchData.id}
      />
    </div>
  );
}