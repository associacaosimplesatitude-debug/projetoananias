import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Lock, CheckCircle2, Clock, Circle, Play, ScrollText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { generateDeviceFingerprint, getDeviceInfo } from "@/lib/deviceFingerprint";
import DeviceBloqueado from "./DeviceBloqueado";

export default function AlunoRevistaVirtual() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  const [deviceChecked, setDeviceChecked] = useState(false);

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

  const { data: licencaAluno } = useQuery({
    queryKey: ["minha-licenca-aluno", user?.id, user?.email],
    queryFn: async () => {
      if (!user) return null;
      // Try by user_id first
      const { data: byUserId } = await supabase
        .from("revista_licenca_alunos")
        .select("id, status, comprovante_url, troca_dispositivo_solicitada, device_token, tipo_revista, licenca_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byUserId) return byUserId;
      // Fallback by email
      if (!user.email) return null;
      const { data: byEmail } = await supabase
        .from("revista_licenca_alunos")
        .select("id, status, comprovante_url, troca_dispositivo_solicitada, device_token, tipo_revista, licenca_id, created_at")
        .eq("aluno_email", user.email.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return byEmail;
    },
    enabled: !!user,
  });

  // Get subscription - try via license first, then direct subscription
  const { data: licencaDetails } = useQuery({
    queryKey: ["minha-licenca-details", licencaAluno?.licenca_id],
    queryFn: async () => {
      if (!licencaAluno?.licenca_id) return null;
      const { data } = await supabase
        .from("revista_licencas")
        .select("revista_aluno_id, revista_professor_id")
        .eq("id", licencaAluno.licenca_id)
        .maybeSingle();
      return data;
    },
    enabled: !!licencaAluno?.licenca_id,
  });

  // Determine which revista to show based on tipo_revista
  const resolvedRevistaId = (() => {
    if (licencaDetails) {
      const tipo = (licencaAluno as any)?.tipo_revista || "aluno";
      if (tipo === "professor" && licencaDetails.revista_professor_id) return licencaDetails.revista_professor_id;
      if (licencaDetails.revista_aluno_id) return licencaDetails.revista_aluno_id;
    }
    return null;
  })();

  const { data: assinatura } = useQuery({
    queryKey: ["minha-assinatura", cliente?.id, resolvedRevistaId],
    queryFn: async () => {
      // If we have a resolved revista from license, create a pseudo-subscription
      if (resolvedRevistaId) {
        const { data: revista } = await supabase
          .from("revistas_digitais")
          .select("*")
          .eq("id", resolvedRevistaId)
          .maybeSingle();
        if (revista) {
          return { revista_id: revista.id, revista, status: "ativa" } as any;
        }
      }
      // Fallback to direct subscription
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
    enabled: !!cliente?.id || !!resolvedRevistaId,
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

  // Device fingerprint validation
  useEffect(() => {
    if (!licencaAluno || licencaAluno.status !== "ativo") {
      setDeviceChecked(true);
      return;
    }

    const checkDevice = async () => {
      try {
        const currentToken = await generateDeviceFingerprint();
        const deviceInfo = getDeviceInfo();

        if (licencaAluno.device_token && licencaAluno.device_token !== currentToken) {
          setDeviceBlocked(true);
          await supabase.from("revista_acessos_bloqueados").insert({
            aluno_id: licencaAluno.id,
            device_token_tentativa: currentToken,
            device_info_tentativa: deviceInfo,
          });
        } else if (!licencaAluno.device_token) {
          await supabase
            .from("revista_licenca_alunos")
            .update({
              device_token: currentToken,
              device_info: deviceInfo,
              device_autorizado_em: new Date().toISOString(),
            })
            .eq("id", licencaAluno.id);
        }
      } catch (err) {
        console.error("Device check error:", err);
      } finally {
        setDeviceChecked(true);
      }
    };

    checkDevice();
  }, [licencaAluno]);

  // Loading device check
  if (!deviceChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Verificando dispositivo...</p>
      </div>
    );
  }

  // Device blocked
  if (deviceBlocked && licencaAluno) {
    return (
      <DeviceBloqueado
        licencaAlunoId={licencaAluno.id}
        trocaJaSolicitada={!!licencaAluno.troca_dispositivo_solicitada}
      />
    );
  }

  // License pending timeline
  if (!assinatura && licencaAluno && licencaAluno.status !== "ativo") {
    const status = licencaAluno.status;
    const cadastroDone = true;
    const comprovanteDone = !!licencaAluno.comprovante_url;
    const aprovado = status === "ativo";

    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-12 px-4">
          <Card className="border border-border/40 shadow-sm max-w-lg mx-auto">
            <CardContent className="py-12 text-center space-y-8">
              <BookOpen className="mx-auto h-16 w-16 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Revista Virtual</h2>
              <div className="flex items-center justify-between px-2">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">{cadastroDone ? "✅" : "⬜"}</span>
                  <span className="text-[11px] font-medium text-foreground">Cadastro</span>
                </div>
                <div className={`flex-1 h-0.5 mx-1 ${cadastroDone ? "bg-green-400" : "bg-border"}`} />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">{comprovanteDone ? "✅" : "🟡"}</span>
                  <span className="text-[11px] font-medium text-foreground">Comprovante</span>
                </div>
                <div className={`flex-1 h-0.5 mx-1 ${comprovanteDone ? "bg-green-400" : "bg-border"}`} />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">{status === "aguardando_aprovacao" ? "⏳" : aprovado ? "✅" : "⬜"}</span>
                  <span className="text-[11px] font-medium text-foreground">Aprovação</span>
                </div>
                <div className={`flex-1 h-0.5 mx-1 ${aprovado ? "bg-green-400" : "bg-border"}`} />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">{aprovado ? "✅" : "🔒"}</span>
                  <span className="text-[11px] font-medium text-foreground">Acesso</span>
                </div>
              </div>
              {status === "pendente" && (
                <p className="text-muted-foreground text-sm">
                  Seu cadastro foi realizado. Envie o comprovante de pagamento para liberar o acesso.
                </p>
              )}
              {status === "aguardando_aprovacao" && (
                <p className="text-muted-foreground text-sm">
                  Seu comprovante foi recebido. Aguarde a aprovação do seu Superintendente.
                </p>
              )}
              {status === "bloqueado" && (
                <div className="space-y-2">
                  <Badge variant="destructive">Acesso Bloqueado</Badge>
                  <p className="text-muted-foreground text-sm">
                    Seu acesso foi suspenso. Entre em contato com seu Superintendente.
                  </p>
                </div>
              )}
              {status === "expirado" && (
                <div className="space-y-2">
                  <Badge variant="secondary">Licença Expirada</Badge>
                  <p className="text-muted-foreground text-sm">
                    Sua licença expirou. Entre em contato com seu Superintendente para renovação.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // No subscription
  if (!assinatura) {
    return (
      <div className="min-h-screen bg-background">
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span>📖</span> Revista Virtual
          </h1>
          <p className="text-muted-foreground mt-1">Acompanhe seu estudo bíblico trimestral</p>
        </div>
        <Separator />
        <Card className="border border-border/40 shadow-sm bg-card">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="relative flex-shrink-0">
                {revista?.capa_url ? (
                  <img src={revista.capa_url} alt={revista.titulo} className="w-[120px] h-[160px] object-cover rounded-xl shadow-md" />
                ) : (
                  <div className="w-[120px] h-[160px] rounded-xl shadow-md bg-muted flex items-center justify-center">
                    <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground border-0 shadow-sm text-[10px] px-2">
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
                    <span className="text-primary font-semibold">{Math.round(progressPercent)}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-between">
          <div />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              const rev = revista as any;
              if (rev?.leitura_continua === true) {
                navigate(`/ebd/livro/${assinatura.revista_id}/ler`);
              } else {
                navigate(`/ebd/revista/${assinatura.revista_id}/leitura-continua`);
              }
            }}
          >
            <ScrollText className="h-4 w-4" /> Leitura Contínua
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {licoes?.map((licao) => {
            const status = getLicaoStatus(licao.id);
            const paginas = licao.paginas as string[] || [];
            const thumbnail = paginas[0] || `https://placehold.co/400x550/1e293b/f97316?text=Li%C3%A7%C3%A3o+${licao.numero}`;

            return (
              <Card key={licao.id} className="overflow-hidden border border-border/40 bg-card shadow-sm hover:shadow-md transition-shadow group">
                <div className="relative aspect-[3/4] bg-muted overflow-hidden">
                  <img src={thumbnail} alt={`Lição ${licao.numero}`} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                  <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground border-0 shadow text-[11px] px-2.5 py-0.5">
                    Lição {licao.numero}
                  </Badge>
                  <div className="absolute top-2 right-2">
                    {status === "concluida" && (
                      <div className="h-7 w-7 rounded-full bg-green-500 flex items-center justify-center shadow">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                    )}
                    {status === "em_andamento" && (
                      <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shadow">
                        <Clock className="h-4 w-4 text-primary-foreground" />
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
                  <p className="font-semibold text-sm text-foreground truncate">{licao.titulo || `Lição ${licao.numero}`}</p>
                  <Button size="sm" className="w-full text-xs font-medium" onClick={() => { if (paginas.length > 0) navigate(`/ebd/revista/${assinatura.revista_id}/licao/${licao.numero}`); }}>
                    <Play className="h-3.5 w-3.5 mr-1" /> Ler Lição
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
