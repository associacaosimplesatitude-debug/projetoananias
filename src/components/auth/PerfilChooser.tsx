import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, LayoutDashboard, GraduationCap, ShoppingBag, ShieldCheck, LogOut, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export interface PerfilOption {
  key: string;
  label: string;
  description: string;
  path: string;
  icon: "multi" | "ebd" | "professor" | "aluno" | "vendedor" | "admin";
}

const ICONS = {
  multi: Users,
  ebd: LayoutDashboard,
  professor: GraduationCap,
  aluno: BookOpen,
  vendedor: ShoppingBag,
  admin: ShieldCheck,
};

interface Props {
  options: PerfilOption[];
}

export default function PerfilChooser({ options }: Props) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl">Escolha onde deseja entrar</CardTitle>
          <CardDescription>
            Sua conta tem múltiplos perfis ativos. Selecione qual painel você quer acessar agora.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {options.map((opt) => {
            const Icon = ICONS[opt.icon];
            return (
              <button
                key={opt.key}
                onClick={() => navigate(opt.path)}
                className="w-full text-left rounded-lg border border-border bg-card hover:bg-accent transition p-4 flex items-start gap-3"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-sm text-muted-foreground">{opt.description}</div>
                </div>
              </button>
            );
          })}
          <Button variant="ghost" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
