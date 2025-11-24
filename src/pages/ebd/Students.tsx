import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MemberSearchDialog from "@/components/ebd/MemberSearchDialog";
import ActivateMemberDialog from "@/components/ebd/ActivateMemberDialog";
import ManualRegistrationDialog from "@/components/ebd/ManualRegistrationDialog";
import { Badge } from "@/components/ui/badge";

export default function EBDStudents() {
  const { clientId } = useParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [activateMemberOpen, setActivateMemberOpen] = useState(false);
  const [manualRegOpen, setManualRegOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  // Get church ID - use clientId from route if available (admin view), otherwise get user's church
  const { data: churchData } = useQuery({
    queryKey: ["user-church", clientId],
    queryFn: async () => {
      // If clientId is in the route (admin viewing a client), use it directly
      if (clientId) {
        return { id: clientId };
      }

      // Otherwise, get the church for the logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("churches")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Get EBD students and teachers
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

  const { data: professores, refetch: refetchProfessores } = useQuery({
    queryKey: ["ebd-professores", churchData?.id, searchTerm],
    queryFn: async () => {
      if (!churchData?.id) return [];

      let query = supabase
        .from("ebd_professores")
        .select("*, church_members!member_id(nome_completo, whatsapp)")
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

  const handleSelectMember = (member: any) => {
    setSelectedMember(member);
    setActivateMemberOpen(true);
  };

  const handleSuccess = () => {
    refetchAlunos();
    refetchProfessores();
  };

  if (!churchData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const allRecords = [
    ...(alunos?.map((a) => ({ ...a, type: "Aluno" })) || []),
    ...(professores?.map((p) => ({ ...p, type: "Professor" })) || []),
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cadastro de Alunos e Professores</h1>
            <p className="text-muted-foreground">Gerencie alunos e professores da EBD</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setMemberSearchOpen(true)}>
              <Search className="w-4 h-4 mr-2" />
              Buscar Membro
            </Button>
            <Button onClick={() => setManualRegOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Cadastro
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Lista de Cadastros
            </CardTitle>
            <CardDescription>Alunos e professores cadastrados no sistema</CardDescription>
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

            {allRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum cadastro encontrado</p>
                <p className="text-sm">Comece adicionando alunos e professores</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allRecords.map((record) => (
                  <Card key={`${record.type}-${record.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{record.nome_completo}</h3>
                            <Badge variant={record.type === "Aluno" ? "default" : "secondary"}>
                              {record.type}
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
                            {record.type === "Aluno" && (record as any).ebd_turmas && (
                              <p>Turma: {(record as any).ebd_turmas.nome}</p>
                            )}
                            {record.member_id && (
                              <Badge variant="outline" className="text-xs">
                                Vinculado ao Cadastro de Membros
                              </Badge>
                            )}
                          </div>
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

      <ManualRegistrationDialog
        open={manualRegOpen}
        onOpenChange={setManualRegOpen}
        churchId={churchData.id}
        onSuccess={handleSuccess}
      />
    </div>
  );
}