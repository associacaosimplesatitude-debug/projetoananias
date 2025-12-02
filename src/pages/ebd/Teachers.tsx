import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Users, UserPlus, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function EBDTeachers() {
  const { clientId } = useParams();
  const [searchTerm, setSearchTerm] = useState("");

  // Get church ID
  const { data: churchData } = useQuery({
    queryKey: ["user-church", clientId],
    queryFn: async () => {
      if (clientId) {
        return { id: clientId };
      }

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

  // Get EBD teachers only
  const { data: professores } = useQuery({
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

  if (!churchData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cadastro de Professores</h1>
            <p className="text-muted-foreground">Gerencie professores da EBD</p>
          </div>
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
                <p className="text-sm">Use o menu CADASTRO para adicionar professores</p>
              </div>
            ) : (
              <div className="space-y-3">
                {professores.map((professor) => (
                  <Card key={professor.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={professor.avatar_url} />
                          <AvatarFallback>
                            <User className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{professor.nome_completo}</h3>
                            <Badge variant="secondary">
                              Professor
                            </Badge>
                            {professor.user_id && (
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
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
