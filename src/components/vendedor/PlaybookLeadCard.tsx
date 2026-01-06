import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardList, 
  Eye, 
  ArrowRight,
  Church,
  Mail,
  Phone,
  User,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PlaybookMessageModal } from "./PlaybookMessageModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface Lead {
  id: string;
  nome_igreja: string;
  nome_responsavel: string | null;
  email: string | null;
  telefone: string | null;
  created_at: string;
  status_kanban: string | null;
  como_conheceu: string | null;
  observacoes: string | null;
}

interface PlaybookLeadCardProps {
  lead: Lead;
  onAdvanceStage: (leadId: string, currentStage: string) => void;
  isAdvancing?: boolean;
}

export function PlaybookLeadCard({ lead, onAdvanceStage, isAdvancing }: PlaybookLeadCardProps) {
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [viewDataModalOpen, setViewDataModalOpen] = useState(false);

  // Gerar mensagem de primeiro contato
  const generatePrimeiroContatoMessage = () => {
    return `Olá${lead.nome_responsavel ? `, ${lead.nome_responsavel.split(" ")[0]}` : ""}! 👋

Muito obrigado pelo interesse no Sistema de Gestão EBD!

Vi que você se cadastrou para conhecer nossa plataforma. Será um prazer te ajudar!

O *Sistema de Gestão EBD* é uma ferramenta completa para:
📊 Controlar frequência de alunos
📚 Gerenciar turmas e professores
📅 Organizar escalas e planejamentos
🏆 Acompanhar desempenho da sua EBD

Posso te apresentar como funciona? 
Você já tem uma Escola Bíblica Dominical estruturada ou está começando?

Abraços!`;
  };

  const getNextStage = (currentStage: string) => {
    const stages = ["Contato", "Negociação", "Fechou"];
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex === stages.length - 1) return null;
    return stages[currentIndex + 1];
  };

  const nextStage = getNextStage(lead.status_kanban || "Contato");

  return (
    <>
      <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Church className="h-4 w-4" />
                {lead.nome_igreja}
              </CardTitle>
              <CardDescription className="space-y-1">
                {lead.nome_responsavel && (
                  <span className="flex items-center gap-1 text-xs">
                    <User className="h-3 w-3" />
                    {lead.nome_responsavel}
                  </span>
                )}
                {lead.email && (
                  <span className="flex items-center gap-1 text-xs">
                    <Mail className="h-3 w-3" />
                    {lead.email}
                  </span>
                )}
                {lead.telefone && (
                  <span className="flex items-center gap-1 text-xs">
                    <Phone className="h-3 w-3" />
                    {lead.telefone}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="secondary">
                {lead.status_kanban || "Novo"}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(lead.created_at), "dd/MM/yy", { locale: ptBR })}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Lead cadastrado para testar o sistema
          </p>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setMessageModalOpen(true)}
            >
              <ClipboardList className="mr-1 h-4 w-4" />
              Mensagem de Primeiro Contato
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setViewDataModalOpen(true)}
            >
              <Eye className="mr-1 h-4 w-4" />
              Ver Dados do Lead
            </Button>
            {nextStage && (
              <Button 
                size="sm"
                onClick={() => onAdvanceStage(lead.id, lead.status_kanban || "Contato")}
                disabled={isAdvancing}
              >
                <ArrowRight className="mr-1 h-4 w-4" />
                Avançar para {nextStage}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Mensagem */}
      <PlaybookMessageModal
        open={messageModalOpen}
        onOpenChange={setMessageModalOpen}
        title="Mensagem de Primeiro Contato"
        message={generatePrimeiroContatoMessage()}
      />

      {/* Modal de Dados do Lead */}
      <Dialog open={viewDataModalOpen} onOpenChange={setViewDataModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Dados do Lead
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Igreja</p>
              <p className="font-medium">{lead.nome_igreja}</p>
            </div>

            {lead.nome_responsavel && (
              <div>
                <p className="text-sm text-muted-foreground">Responsável</p>
                <p className="font-medium">{lead.nome_responsavel}</p>
              </div>
            )}

            {lead.email && (
              <div>
                <p className="text-sm text-muted-foreground">E-mail</p>
                <p className="font-medium">{lead.email}</p>
              </div>
            )}

            {lead.telefone && (
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{lead.telefone}</p>
              </div>
            )}

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground">Data de Cadastro</p>
              <p className="font-medium">
                {format(new Date(lead.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Etapa Atual</p>
              <Badge variant="secondary" className="mt-1">
                {lead.status_kanban || "Novo"}
              </Badge>
            </div>

            {lead.como_conheceu && (
              <div>
                <p className="text-sm text-muted-foreground">Como conheceu</p>
                <p className="font-medium">{lead.como_conheceu}</p>
              </div>
            )}

            {lead.observacoes && (
              <div>
                <p className="text-sm text-muted-foreground">Observações</p>
                <p className="font-medium">{lead.observacoes}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setViewDataModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
