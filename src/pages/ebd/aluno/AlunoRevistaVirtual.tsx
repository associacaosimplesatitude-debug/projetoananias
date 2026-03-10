import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Lock, CheckCircle2, Clock, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AlunoRevistaVirtual() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get client ID from ebd_clientes via user email
  const { data: cliente } = useQuery({
    queryKey: ["meu-cliente", user?.id],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja")
        .eq("email_superintendente", user.email)
        .maybeSingle();
      // Also try as aluno linked user
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
      <div className="container mx-auto py-6 px-4">
        <Card>
          <CardContent className="py-16 text-center">
            <Lock className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Revista Virtual</h2>
            <p className="text-muted-foreground mb-6">
              Você ainda não possui uma assinatura ativa de revista digital.
            </p>
            <p className="text-sm text-muted-foreground">
              Entre em contato com o administrador para obter acesso.
            </p>
          </CardContent>
        </Card>
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
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Revista Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {revista?.capa_url && (
              <img
                src={revista.capa_url}
                alt={revista.titulo}
                className="w-32 h-44 object-cover rounded-lg shadow-lg"
              />
            )}
            <div className="flex-1 space-y-3">
              <div>
                <Badge variant="outline" className="mb-2">{revista?.tipo === "professor" ? "Professor" : "Aluno"}</Badge>
                <h1 className="text-2xl font-bold">{revista?.titulo}</h1>
                <p className="text-muted-foreground">{revista?.trimestre}</p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{concluidas} de {total} lições concluídas</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" indicatorClassName="bg-orange-500" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lições Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {licoes?.map((licao) => {
          const status = getLicaoStatus(licao.id);
          const paginas = licao.paginas as string[] || [];
          const thumbnail = paginas[0] || `https://placehold.co/400x550/1e293b/f97316?text=Li%C3%A7%C3%A3o+${licao.numero}`;

          return (
            <Card
              key={licao.id}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => {
                if (paginas.length > 0) {
                  navigate(`/ebd/aluno/revista/${assinatura.revista_id}/licao/${licao.numero}`);
                }
              }}
            >
              <div className="relative aspect-[3/4] bg-muted overflow-hidden">
                <img src={thumbnail} alt={`Lição ${licao.numero}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="h-12 w-12 text-white" />
                </div>
                <div className="absolute top-2 right-2">
                  {status === "concluida" && (
                    <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Concluída</Badge>
                  )}
                  {status === "em_andamento" && (
                    <Badge className="bg-orange-500"><Clock className="h-3 w-3 mr-1" /> Em andamento</Badge>
                  )}
                </div>
              </div>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Lição {licao.numero}</p>
                <p className="font-medium text-sm truncate">{licao.titulo || `Lição ${licao.numero}`}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
