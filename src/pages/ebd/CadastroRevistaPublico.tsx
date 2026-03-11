import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { BookOpen, Loader2, CheckCircle, Upload, AlertCircle } from "lucide-react";

export default function CadastroRevistaPublico() {
  const { churchId } = useParams();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [turma, setTurma] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const { data: igreja, isLoading: isLoadingIgreja, error: igrejaError } = useQuery({
    queryKey: ["igreja-revista-publica", churchId],
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

  // Check if there's an active license for this church
  const { data: licenca } = useQuery({
    queryKey: ["licenca-ativa-publica", churchId],
    queryFn: async () => {
      const { data } = await supabase
        .from("revista_licencas")
        .select("id, quantidade_total, quantidade_usada")
        .eq("superintendente_id", churchId!)
        .eq("status", "ativa")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!churchId && !!igreja?.status_ativacao_ebd,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim() || nome.trim().length < 3) {
      toast.error("Nome deve ter pelo menos 3 caracteres");
      return;
    }
    if (!email || !email.includes("@")) {
      toast.error("Email inválido");
      return;
    }
    if (!comprovante) {
      toast.error("Envie o comprovante de pagamento");
      return;
    }
    if (!licenca) {
      toast.error("Não há licenças disponíveis nesta igreja");
      return;
    }
    if (licenca.quantidade_usada >= licenca.quantidade_total) {
      toast.error("Todas as licenças desta igreja já foram utilizadas");
      return;
    }

    setIsLoading(true);

    try {
      // Upload comprovante
      const ext = comprovante.name.split(".").pop() || "jpg";
      const filePath = `comprovantes/${churchId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("comprovantes")
        .upload(filePath, comprovante);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("comprovantes")
        .getPublicUrl(filePath);

      // Insert student record
      const { error: insertError } = await supabase
        .from("revista_licenca_alunos")
        .insert({
          licenca_id: licenca.id,
          superintendente_id: churchId!,
          aluno_nome: nome.trim(),
          aluno_email: email.toLowerCase().trim(),
          aluno_telefone: telefone || null,
          aluno_turma: turma || null,
          status: "aguardando_aprovacao",
          comprovante_url: urlData.publicUrl,
          comprovante_enviado_em: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      setSucesso(true);
      toast.success("Cadastro enviado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao cadastrar:", error);
      toast.error(error.message || "Erro ao realizar cadastro");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingIgreja) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f97316]/10 to-background flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#f97316]" />
      </div>
    );
  }

  if (igrejaError || !igreja || !igreja.status_ativacao_ebd) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f97316]/10 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <CardTitle>Link Inválido</CardTitle>
            <CardDescription>
              Esta página de cadastro não está disponível. Verifique o link com sua igreja.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f97316]/10 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <CardTitle className="text-green-600">Cadastro Enviado!</CardTitle>
            <CardDescription className="text-base">
              Seu cadastro na Revista Virtual de <strong>{igreja.nome_igreja}</strong> foi enviado com sucesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            {/* Status Timeline */}
            <div className="flex items-center justify-between px-4">
              <TimelineStep icon="✅" label="Cadastro" active />
              <TimelineLine done />
              <TimelineStep icon="✅" label="Comprovante" active />
              <TimelineLine />
              <TimelineStep icon="⏳" label="Aguardando SE" />
              <TimelineLine />
              <TimelineStep icon="🔒" label="Acesso" />
            </div>
            <p className="text-muted-foreground text-sm">
              Seu Superintendente irá verificar seu comprovante e liberar o acesso em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f97316]/10 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <BookOpen className="h-12 w-12 mx-auto text-[#f97316] mb-2" />
          <CardTitle>Revista Virtual</CardTitle>
          <CardDescription>
            Cadastro de Aluno — <strong>{igreja.nome_igreja}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">WhatsApp</Label>
              <Input id="telefone" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="turma">Turma</Label>
              <Input id="turma" value={turma} onChange={(e) => setTurma(e.target.value)} placeholder="Ex: Jovens, Adultos..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comprovante">Comprovante de Pagamento *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="comprovante"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setComprovante(e.target.files?.[0] || null)}
                  className="flex-1"
                  required
                />
              </div>
              {comprovante && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Upload className="h-3 w-3" /> {comprovante.name}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Cadastro"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Após o envio, aguarde a aprovação do seu Superintendente para acessar a revista.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineStep({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xl">{icon}</span>
      <span className={`text-[10px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

function TimelineLine({ done }: { done?: boolean }) {
  return <div className={`flex-1 h-0.5 mx-1 ${done ? "bg-green-400" : "bg-border"}`} />;
}
