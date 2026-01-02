import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Church, User, Mail, Phone, Calendar, MessageCircle, Globe, Target } from "lucide-react";

interface Lead {
  id: string;
  nome_igreja: string;
  nome_responsavel: string | null;
  email: string | null;
  telefone: string | null;
  created_at: string;
  como_conheceu: string | null;
  origem_lead: string | null;
  tipo_lead: string | null;
  status_lead: string;
}

export default function LeadsLandingPage() {
  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads-landing-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_leads_reativacao")
        .select("*")
        .eq("origem_lead", "Landing Page")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Convertido":
        return "bg-green-100 text-green-800 border-green-200";
      case "Em Negociação":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Contatado":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Não Contatado":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "Perdido":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getCampanhaFromComoConheceu = (como: string | null) => {
    if (!como) return null;
    if (["Google", "YouTube", "Meta Ads"].includes(como)) {
      return como;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lead de Landing Page</h1>
        <p className="text-muted-foreground">
          Leads cadastrados através da landing page ({leads?.length || 0} leads)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {leads?.map((lead) => {
          const campanha = getCampanhaFromComoConheceu(lead.como_conheceu);
          
          return (
            <Card key={lead.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                {/* Nome da Igreja */}
                <div className="flex items-start gap-2">
                  <Church className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">{lead.nome_igreja}</p>
                  </div>
                </div>

                {/* Nome do Responsável */}
                {lead.nome_responsavel && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4 shrink-0" />
                    <span>{lead.nome_responsavel}</span>
                  </div>
                )}

                {/* E-mail */}
                {lead.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{lead.email}</span>
                  </div>
                )}

                {/* WhatsApp */}
                {lead.telefone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{lead.telefone}</span>
                  </div>
                )}

                {/* Data do cadastro */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>

                {/* Como nos conheceu */}
                {lead.como_conheceu && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageCircle className="h-4 w-4 shrink-0" />
                    <span>{lead.como_conheceu}</span>
                  </div>
                )}

                {/* Badges */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {/* Campanha */}
                  {campanha && (
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                      <Target className="h-3 w-3 mr-1" />
                      {campanha}
                    </Badge>
                  )}

                  {/* Status */}
                  <Badge className={`text-xs ${getStatusColor(lead.status_lead)}`}>
                    {lead.status_lead}
                  </Badge>

                  {/* Origem */}
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    <Globe className="h-3 w-3 mr-1" />
                    Landing Page
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {leads?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum lead de landing page encontrado.
        </div>
      )}
    </div>
  );
}
