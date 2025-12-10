import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  MapPin, 
  Mail, 
  MailOpen, 
  Phone, 
  Calendar, 
  Play, 
  Pencil,
  Search,
  Flame,
  Thermometer,
  Snowflake,
  Clock
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AtualizarLeadDialog } from "./AtualizarLeadDialog";

interface Lead {
  id: string;
  nome_igreja: string;
  email: string | null;
  telefone: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  status_lead: string;
  lead_score: string;
  email_aberto: boolean;
  ultimo_login_ebd: string | null;
  data_followup: string | null;
  motivo_perda: string | null;
  observacoes: string | null;
}

interface VendedorLeadsTabProps {
  vendedorId: string;
}

export function VendedorLeadsTab({ vendedorId }: VendedorLeadsTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [leadToUpdate, setLeadToUpdate] = useState<Lead | null>(null);

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["vendedor-leads", vendedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_leads_reativacao")
        .select("*")
        .eq("vendedor_id", vendedorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!vendedorId,
  });

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = 
      lead.nome_igreja.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesStatus = statusFilter === "all" || lead.status_lead === statusFilter;
    const matchesScore = scoreFilter === "all" || lead.lead_score === scoreFilter;

    return matchesSearch && matchesStatus && matchesScore;
  });

  const getScoreBadge = (score: string) => {
    switch (score) {
      case "Quente":
        return (
          <Badge className="bg-red-500 hover:bg-red-600">
            <Flame className="h-3 w-3 mr-1" />
            Quente
          </Badge>
        );
      case "Morno":
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">
            <Thermometer className="h-3 w-3 mr-1" />
            Morno
          </Badge>
        );
      case "Frio":
      default:
        return (
          <Badge variant="secondary">
            <Snowflake className="h-3 w-3 mr-1" />
            Frio
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Reativado":
        return <Badge className="bg-green-500 hover:bg-green-600">Reativado</Badge>;
      case "Em Negociação":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Em Negociação</Badge>;
      case "Perdido":
        return <Badge variant="destructive">Perdido</Badge>;
      case "Não Contatado":
      default:
        return <Badge variant="secondary">Não Contatado</Badge>;
    }
  };

  const handleAtivarPainel = (lead: Lead) => {
    // Navigate to activation page with lead data
    navigate(`/vendedor/ativacao?leadId=${lead.id}&leadNome=${encodeURIComponent(lead.nome_igreja)}`);
  };

  const getLocalizacao = (lead: Lead) => {
    if (lead.endereco_cidade && lead.endereco_estado) {
      return `${lead.endereco_cidade}/${lead.endereco_estado}`;
    }
    return "-";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Leads de Reativação ({filteredLeads.length})</span>
          </CardTitle>
          <CardDescription>
            Leads de clientes inativos para reativação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por igreja ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="Não Contatado">Não Contatado</SelectItem>
                <SelectItem value="Em Negociação">Em Negociação</SelectItem>
                <SelectItem value="Reativado">Reativado</SelectItem>
                <SelectItem value="Perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Scores</SelectItem>
                <SelectItem value="Quente">Quente</SelectItem>
                <SelectItem value="Morno">Morno</SelectItem>
                <SelectItem value="Frio">Frio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {filteredLeads.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum lead encontrado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Igreja</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Último Login</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        <div>
                          {lead.nome_igreja}
                          {lead.telefone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Phone className="h-3 w-3" />
                              {lead.telefone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {getLocalizacao(lead)}
                        </span>
                      </TableCell>
                      <TableCell>{getScoreBadge(lead.lead_score)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2" title={lead.email_aberto ? "Email aberto" : "Email não aberto"}>
                          {lead.email_aberto ? (
                            <MailOpen className="h-4 w-4 text-green-500" />
                          ) : (
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {lead.email || "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDateTime(lead.ultimo_login_ebd)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(lead.status_lead)}</TableCell>
                      <TableCell>
                        {lead.data_followup && (
                          <span className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {formatDate(lead.data_followup)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAtivarPainel(lead)}
                            title="Ativar Painel EBD"
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Ativar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLeadToUpdate(lead)}
                            title="Atualizar Status"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AtualizarLeadDialog
        open={!!leadToUpdate}
        onOpenChange={(open) => !open && setLeadToUpdate(null)}
        lead={leadToUpdate}
        onSuccess={() => refetch()}
      />
    </>
  );
}
