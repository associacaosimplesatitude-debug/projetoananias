import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Users, UserPlus, User, Plus, Pencil, Trash2, Link, Copy } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MemberSearchDialog from "@/components/ebd/MemberSearchDialog";
import ActivateMemberDialog from "@/components/ebd/ActivateMemberDialog";
import { CadastrarAlunoDialog } from "@/components/ebd/CadastrarAlunoDialog";
import { EditarAlunoDialog } from "@/components/ebd/EditarAlunoDialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useEbdChurchId } from "@/hooks/useEbdChurchId";
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

export default function EBDStudents() {
  const { clientId } = useParams();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [activateMemberOpen, setActivateMemberOpen] = useState(false);
  const [cadastrarAlunoOpen, setCadastrarAlunoOpen] = useState(false);
  const [editarAlunoOpen, setEditarAlunoOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedAluno, setSelectedAluno] = useState<any>(null);

  const { data: churchData, isLoading: isLoadingChurch } = useEbdChurchId(clientId);


  // Get EBD students only
  const { data: alunos, refetch: refetchAlunos } = useQuery({
    queryKey: ["ebd-alunos", churchData?.id, searchTerm],
    queryFn: async () => {
      if (!churchData?.id) return [];

      let query = supabase
        .from("ebd_alunos")
        .select("*, church_members!member_id(nome_completo, whatsapp), ebd_turmas!turma_id(nome)")
        .eq("church_id", churchData.id);

      if (searchTerm) {
        query = query.ilike("nome_completo", `%${searchTerm}%`);
      }

      const { data, error } = await query.order("nome_completo");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!churchData?.id,
  });

  const deleteAlunoMutation = useMutation({
    mutationFn: async (alunoId: string) => {
      const { error } = await supabase
        .from("ebd_alunos")
        .delete()
        .eq("id", alunoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebd-alunos"] });
      toast.success("Aluno excluído com sucesso!");
      setDeleteDialogOpen(false);
      setSelectedAluno(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao excluir aluno");
    },
  });

  const handleSelectMember = (member: any) => {
    setSelectedMember(member);
    setActivateMemberOpen(true);
  };

  const handleSuccess = () => {
    refetchAlunos();
  };

  const handleEditAluno = (aluno: any) => {
    setSelectedAluno(aluno);
    setEditarAlunoOpen(true);
  };

  const handleDeleteAluno = (aluno: any) => {
    setSelectedAluno(aluno);
    setDeleteDialogOpen(true);
  };

  if (!churchData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  console.log("Church ID para busca de membros:", churchData.id);

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/cadastro-aluno/${churchData.id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link de cadastro copiado!");
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Cadastro de Alunos</h1>
            <p className="text-muted-foreground">Gerencie alunos da EBD</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline"
              onClick={handleCopyLink}
            >
              <Link className="w-4 h-4 mr-2" />
              Copiar Link de Cadastro
            </Button>
            <Button 
              onClick={() => setCadastrarAlunoOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Aluno
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                console.log("Abrindo busca de membros. Church ID:", churchData.id);
                setMemberSearchOpen(true);
              }}
            >
              <Search className="w-4 h-4 mr-2" />
              Buscar Membro
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Lista de Alunos
            </CardTitle>
            <CardDescription>Alunos cadastrados no sistema</CardDescription>
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

            {!alunos || alunos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum aluno encontrado</p>
                <p className="text-sm">Use o menu CADASTRO para adicionar alunos</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alunos.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={record.avatar_url} className="object-cover" />
                          <AvatarFallback>
                            <User className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{record.nome_completo}</h3>
                            <Badge variant="default">
                              Aluno
                            </Badge>
                            {record.user_id && (
                              <Badge variant="outline" className="text-xs">
                                <UserPlus className="w-3 h-3 mr-1" />
                                Acesso
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            {record.email && <p>Email: {record.email}</p>}
                            {record.telefone && <p>Telefone: {record.telefone}</p>}
                            {record.ebd_turmas && (
                              <p>Turma: {record.ebd_turmas.nome}</p>
                            )}
                            {record.member_id && (
                              <Badge variant="outline" className="text-xs">
                                Vinculado ao Cadastro de Membros
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditAluno(record)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteAluno(record)}
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

      <MemberSearchDialog
        open={memberSearchOpen}
        onOpenChange={setMemberSearchOpen}
        onSelectMember={handleSelectMember}
        churchId={churchData.id}
      />

      <ActivateMemberDialog
        open={activateMemberOpen}
        onOpenChange={setActivateMemberOpen}
        member={selectedMember}
        churchId={churchData.id}
        onSuccess={handleSuccess}
      />

      <CadastrarAlunoDialog
        open={cadastrarAlunoOpen}
        onOpenChange={setCadastrarAlunoOpen}
        churchId={churchData.id}
        onSuccess={handleSuccess}
      />

      <EditarAlunoDialog
        open={editarAlunoOpen}
        onOpenChange={setEditarAlunoOpen}
        aluno={selectedAluno}
        onSuccess={handleSuccess}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Aluno</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o aluno "{selectedAluno?.nome_completo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedAluno && deleteAlunoMutation.mutate(selectedAluno.id)}
            >
              {deleteAlunoMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
