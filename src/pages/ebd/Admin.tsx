import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Users, BookOpen, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function EBDAdmin() {
  const navigate = useNavigate();

  const adminSections = [
    {
      title: "Faixas Etárias",
      description: "Configure as faixas etárias das turmas",
      icon: Users,
      path: "/ebd/age-ranges",
    },
    {
      title: "Configurações Gerais",
      description: "Ajuste configurações do sistema EBD",
      icon: Settings,
      path: "#",
    },
    {
      title: "Gestão de Conteúdo",
      description: "Gerencie materiais e recursos pedagógicos",
      icon: BookOpen,
      path: "#",
    },
    {
      title: "Metas e Objetivos",
      description: "Defina metas de aprendizado e frequência",
      icon: Target,
      path: "#",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">⚙️ Administração EBD</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Cadastros secundários e configurações do sistema
          </p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {adminSections.map((section) => (
            <Card key={section.title} className="hover:shadow-lg transition-shadow overflow-hidden">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <section.icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="truncate">{section.title}</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm line-clamp-2">
                  {section.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <Button
                  onClick={() => section.path !== "#" && navigate(section.path)}
                  variant="outline"
                  className="w-full text-sm"
                  disabled={section.path === "#"}
                >
                  {section.path === "#" ? "Em breve" : "Acessar"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
