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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">⚙️ Administração EBD</h1>
          <p className="text-muted-foreground">
            Cadastros secundários e configurações do sistema
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {adminSections.map((section) => (
            <Card key={section.title} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <section.icon className="w-5 h-5" />
                  {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => section.path !== "#" && navigate(section.path)}
                  variant="outline"
                  className="w-full"
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
