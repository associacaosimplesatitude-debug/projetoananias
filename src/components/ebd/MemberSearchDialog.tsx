import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MemberSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMember: (member: any) => void;
  churchId: string;
}

export default function MemberSearchDialog({
  open,
  onOpenChange,
  onSelectMember,
  churchId,
}: MemberSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: members, isLoading } = useQuery({
    queryKey: ["church-members-search", churchId, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("church_members")
        .select("*")
        .eq("church_id", churchId);

      if (searchTerm) {
        query = query.or(
          `nome_completo.ilike.%${searchTerm}%,whatsapp.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query.order("nome_completo");
      if (error) throw error;
      return data;
    },
    enabled: open && !!churchId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Buscar Membro Existente</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por nome ou WhatsApp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : members?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum membro encontrado</p>
            </div>
          ) : (
            members?.map((member) => (
              <Card
                key={member.id}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => {
                  onSelectMember(member);
                  onOpenChange(false);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold">{member.nome_completo}</h3>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {member.email && <p>Email: {member.email}</p>}
                        {member.whatsapp && <p>WhatsApp: {member.whatsapp}</p>}
                        {member.data_aniversario && (
                          <p>
                            Data de Nascimento:{" "}
                            {new Date(member.data_aniversario).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline">{member.cargo}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}