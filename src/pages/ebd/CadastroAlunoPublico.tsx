import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { GraduationCap, Loader2, CheckCircle } from "lucide-react";

export default function CadastroAlunoPublico() {
  const { churchId } = useParams();
  const navigate = useNavigate();
  
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cadastroSucesso, setCadastroSucesso] = useState(false);

  // Buscar dados da igreja
  const { data: igreja, isLoading: isLoadingIgreja, error: igrejaError } = useQuery({
    queryKey: ["igreja-publica", churchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, status_ativacao_ebd")
        .eq("id", churchId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!churchId,
  });

  // Buscar turmas ativas da igreja
  const { data: turmas } = useQuery({
    queryKey: ["turmas-publicas", churchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_turmas")
        .select("id, nome")
        .eq("church_id", churchId!)
        .eq("is_active", true)
        .order("nome");
      
      if (error) throw error;
      return data;
    },
    enabled: !!churchId && !!igreja?.status_ativacao_ebd,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome || nome.trim().length < 3) {
      toast.error("Nome deve ter pelo menos 3 caracteres");
      return;
    }

    if (!email || !email.includes("@")) {
      toast.error("Email inválido");
      return;
    }

    if (!senha || senha.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-aluno-public", {
        body: {
          churchId,
          nome: nome.trim(),
          email: email.toLowerCase(),
          senha,
          telefone: telefone || null,
          dataNascimento: dataNascimento || null,
          turmaId: turmaId || null,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setCadastroSucesso(true);
      toast.success("Cadastro realizado com sucesso!");
      
    } catch (error: any) {
      console.error("Erro ao cadastrar:", error);
      toast.error(error.message || "Erro ao realizar cadastro");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isLoadingIgreja) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Igreja não encontrada ou inativa
  if (igrejaError || !igreja || !igreja.status_ativacao_ebd) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <CardTitle>Link Inválido</CardTitle>
            <CardDescription>
              Esta página de cadastro não está disponível. 
              Verifique o link com sua igreja.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Cadastro concluído com sucesso
  if (cadastroSucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <CardTitle className="text-green-600">Cadastro Realizado!</CardTitle>
            <CardDescription className="text-base">
              Seu cadastro na EBD de <strong>{igreja.nome_igreja}</strong> foi concluído com sucesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Agora você pode acessar a área do aluno usando seu email e senha.
            </p>
            <Button onClick={() => navigate("/login/ebd")} className="w-full">
              Fazer Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <GraduationCap className="h-12 w-12 mx-auto text-primary mb-2" />
          <CardTitle>Cadastro de Aluno</CardTitle>
          <CardDescription>
            Escola Bíblica Dominical - <strong>{igreja.nome_igreja}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha *</Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">WhatsApp</Label>
              <Input
                id="telefone"
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataNascimento">Data de Nascimento</Label>
              <Input
                id="dataNascimento"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
              />
            </div>

            {turmas && turmas.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="turma">Turma</Label>
                <Select value={turmaId} onValueChange={setTurmaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione sua turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {turmas.map((turma) => (
                      <SelectItem key={turma.id} value={turma.id}>
                        {turma.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                "Cadastrar"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Já possui conta?{" "}
              <button
                type="button"
                onClick={() => navigate("/login/ebd")}
                className="text-primary hover:underline"
              >
                Fazer login
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
