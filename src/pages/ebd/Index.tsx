import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  School, 
  Brain, 
  Calendar, 
  BookOpen 
} from "lucide-react";

export default function EBDIndex() {
  const navigate = useNavigate();

  const menuItems = [
    {
      title: "Dashboard",
      description: "Visão geral do superintendente",
      icon: LayoutDashboard,
      path: "/ebd/dashboard",
      color: "text-blue-500",
      bgColor: "bg-blue-50"
    },
    {
      title: "Cadastro Aluno/Professor",
      description: "Gerencie alunos e professores",
      icon: Users,
      path: "/ebd/students",
      color: "text-green-500",
      bgColor: "bg-green-50"
    },
    {
      title: "Cadastrar Salas",
      description: "Gerencie turmas e salas",
      icon: School,
      path: "/ebd/classrooms",
      color: "text-purple-500",
      bgColor: "bg-purple-50"
    },
    {
      title: "Cadastrar Quiz",
      description: "Crie questionários",
      icon: Brain,
      path: "/ebd/quizzes",
      color: "text-orange-500",
      bgColor: "bg-orange-50"
    },
    {
      title: "Criar Escala",
      description: "Programe professores",
      icon: Calendar,
      path: "/ebd/schedule",
      color: "text-pink-500",
      bgColor: "bg-pink-50"
    }
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BookOpen className="w-12 h-12 text-primary" />
            <h1 className="text-4xl font-bold">EBD</h1>
          </div>
          <p className="text-xl text-muted-foreground">Escola Bíblica Dominical</p>
          <p className="text-sm text-muted-foreground mt-2">Sistema de Gerenciamento Completo</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <Card 
              key={item.path}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(item.path)}
            >
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${item.bgColor} flex items-center justify-center mb-4`}>
                  <item.icon className={`w-6 h-6 ${item.color}`} />
                </div>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Acessar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}