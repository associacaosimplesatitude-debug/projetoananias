import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Lock, CheckCircle2, Clock, Circle, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

export default function AlunoRevistaVirtual() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: cliente } = useQuery({
    queryKey: ["meu-cliente", user?.id],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja")
        .eq("email_superintendente", user.email)
        .maybeSingle();
      if (!data) {
        const { data: aluno } = await supabase
          .from("ebd_alunos")
          .select("church_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        if (aluno) return { id: aluno.church_id, nome_igreja: "" };
      }
      return data;
    },
    enabled: !!user,
  });

  // Check student license status
  const { data: licencaAluno } = useQuery({
    queryKey: ["minha-licenca-aluno", user?.id],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("revista_licenca_alunos")
        .select("id, status, comprovante_url, troca_dispositivo_solicitada, created_at")
        .eq("aluno_email", user.email.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: assinatura } = useQuery({
    queryKey: ["minha-assinatura", cliente?.id],
    queryFn: async () => {
      if (!cliente?.id) return null;
      const { data } = await supabase
        .from("revista_assinaturas")
        .select("*, revista:revistas_digitais(*)")
        .eq("cliente_id", cliente.id)
        .eq("status", "ativa")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!cliente?.id,
  });

  const { data: licoes } = useQuery({
    queryKey: ["revista-licoes-leitor", assinatura?.revista_id],
    queryFn: async () => {
      if (!assinatura?.revista_id) return [];
      const { data, error } = await supabase
        .from("revista_licoes")
        .select("*")
        .eq("revista_id", assinatura.revista_id)
        .order("numero");
      if (error) throw error;
      return data;
    },
    enabled: !!assinatura?.revista_id,
  });

  const { data: progressos } = useQuery({
    queryKey: ["meus-progressos", cliente?.id, assinatura?.revista_id],
    queryFn: async () => {
      if (!cliente?.id || !licoes) return {};
      const licaoIds = licoes.map(l => l.id);
      const { data } = await supabase
        .from("revista_progresso")
        .select("*")
        .eq("cliente_id", cliente.id)
        .in("licao_id", licaoIds);
      const map: Record<string, any> = {};
      data?.forEach(p => { map[p.licao_id] = p; });
      return map;
    },
    enabled: !!cliente?.id && !!licoes && licoes.length > 0,
  });

  if (!assinatura) {
    return (
      <div className="min-h-screen bg-[#f8f8f8]">
        <div className="container mx-auto py-12 px-4">
          <Card className="border border-border/40 shadow-sm">
            <CardContent className="py-16 text-center">
              <Lock className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">Revista Virtual</h2>
              <p className="text-muted-foreground mb-6">
                Você ainda não possui uma assinatura ativa de revista digital.
              </p>
              <p className="text-sm text-muted-foreground">
                Entre em contato com o administrador para obter acesso.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const revista = assinatura.revista as any;
  const concluidas = licoes?.filter(l => progressos?.[l.id]?.concluida).length || 0;
  const total = licoes?.length || 0;
  const progressPercent = total > 0 ? (concluidas / total) * 100 : 0;

  const getLicaoStatus = (licaoId: string) => {
    const p = progressos?.[licaoId];
    if (!p) return "nao_lida";
    if (p.concluida) return "concluida";
    return "em_andamento";
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <div className="container mx-auto py-6 px-4 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span>📖</span> Revista Virtual
          </h1>
          <p className="text-muted-foreground mt-1">Acompanhe seu estudo bíblico trimestral</p>
        </div>

        <Separator />

        {/* Revista Card */}
        <Card className="border border-border/40 shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="relative flex-shrink-0">
                {revista?.capa_url ? (
                  <img
                    src={revista.capa_url}
                    alt={revista.titulo}
                    className="w-[120px] h-[160px] object-cover rounded-xl shadow-md"
                  />
                ) : (
                  <div className="w-[120px] h-[160px] rounded-xl shadow-md bg-muted flex items-center justify-center">
                    <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                <Badge className="absolute -top-2 -right-2 bg-[#f97316] text-white border-0 shadow-sm text-[10px] px-2">
                  {revista?.tipo === "professor" ? "Professor" : "Aluno"}
                </Badge>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{revista?.titulo}</h2>
                  <p className="text-muted-foreground text-sm">{revista?.trimestre}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-foreground">{concluidas} de {total} lições concluídas</span>
                    <span className="text-[#f97316] font-semibold">{Math.round(progressPercent)}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" indicatorClassName="bg-[#f97316]" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lições Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {licoes?.map((licao) => {
            const status = getLicaoStatus(licao.id);
            const paginas = licao.paginas as string[] || [];
            const thumbnail = paginas[0] || `https://placehold.co/400x550/1e293b/f97316?text=Li%C3%A7%C3%A3o+${licao.numero}`;

            return (
              <Card
                key={licao.id}
                className="overflow-hidden border border-border/40 bg-white shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="relative aspect-[3/4] bg-muted overflow-hidden">
                  <img
                    src={thumbnail}
                    alt={`Lição ${licao.numero}`}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                  <Badge className="absolute top-2 left-2 bg-[#f97316] text-white border-0 shadow text-[11px] px-2.5 py-0.5">
                    Lição {licao.numero}
                  </Badge>
                  <div className="absolute top-2 right-2">
                    {status === "concluida" && (
                      <div className="h-7 w-7 rounded-full bg-green-500 flex items-center justify-center shadow">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                    )}
                    {status === "em_andamento" && (
                      <div className="h-7 w-7 rounded-full bg-[#f97316] flex items-center justify-center shadow">
                        <Clock className="h-4 w-4 text-white" />
                      </div>
                    )}
                    {status === "nao_lida" && (
                      <div className="h-7 w-7 rounded-full bg-muted-foreground/30 flex items-center justify-center shadow">
                        <Circle className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
                <CardContent className="p-4 space-y-3">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {licao.titulo || `Lição ${licao.numero}`}
                  </p>
                  <Button
                    size="sm"
                    className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-medium"
                    onClick={() => {
                      if (paginas.length > 0) {
                        navigate(`/ebd/revista/${assinatura.revista_id}/licao/${licao.numero}`);
                      }
                    }}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Ler Lição
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
