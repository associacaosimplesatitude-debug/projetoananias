import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Power, PowerOff, Dice5, Trophy, Users, Download,
  CheckCircle, Clock, Search, Loader2, Gift, Crown, Camera, ImageOff,
} from "lucide-react";

// ─── Sessões Tab ───────────────────────────────────────────
function SessoesTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [newSession, setNewSession] = useState({
    nome: "", data_inicio: "", data_fim: "", intervalo_minutos: 60,
  });

  const { data: sessoes, isLoading } = useQuery({
    queryKey: ["admin-sorteio-sessoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sorteio_sessoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sorteio_sessoes").insert({
        nome: newSession.nome,
        data_inicio: newSession.data_inicio,
        data_fim: newSession.data_fim,
        intervalo_minutos: newSession.intervalo_minutos,
        ativo: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sorteio-sessoes"] });
      setModalOpen(false);
      setNewSession({ nome: "", data_inicio: "", data_fim: "", intervalo_minutos: 60 });
      toast.success("Sessão criada!");
    },
    onError: () => toast.error("Erro ao criar sessão"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativar }: { id: string; ativar: boolean }) => {
      if (ativar) {
        // Deactivate all first
        await supabase.from("sorteio_sessoes").update({ ativo: false }).neq("id", "00000000-0000-0000-0000-000000000000");
      }
      const { error } = await supabase.from("sorteio_sessoes").update({ ativo: ativar }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sorteio-sessoes"] });
      toast.success("Status atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Sessões de Sorteio</h3>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova Sessão</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Sessão de Sorteio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder='Nome da sessão (ex: "Evento Sábado 21/03")'
                value={newSession.nome}
                onChange={(e) => setNewSession({ ...newSession, nome: e.target.value })}
              />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Data e hora início</label>
                <Input
                  type="datetime-local"
                  value={newSession.data_inicio}
                  onChange={(e) => setNewSession({ ...newSession, data_inicio: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Data e hora fim</label>
                <Input
                  type="datetime-local"
                  value={newSession.data_fim}
                  onChange={(e) => setNewSession({ ...newSession, data_fim: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Intervalo entre sorteios (minutos)</label>
                <Input
                  type="number"
                  min={1}
                  value={newSession.intervalo_minutos}
                  onChange={(e) => setNewSession({ ...newSession, intervalo_minutos: parseInt(e.target.value) || 60 })}
                />
              </div>
              <Button
                className="w-full"
                disabled={!newSession.nome || !newSession.data_inicio || !newSession.data_fim || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Sessão"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessoes?.map((s) => (
            <Card key={s.id} className={s.ativo ? "border-emerald-500/50 bg-emerald-50/50" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{s.nome}</CardTitle>
                  <Badge variant={s.ativo ? "default" : "secondary"} className={s.ativo ? "bg-emerald-600" : ""}>
                    {s.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>📅 {format(new Date(s.data_inicio), "dd/MM/yy HH:mm")} → {format(new Date(s.data_fim), "dd/MM/yy HH:mm")}</p>
                <p>⏱️ Intervalo: {s.intervalo_minutos} min</p>
                <Button
                  size="sm"
                  variant={s.ativo ? "destructive" : "default"}
                  className="w-full mt-2"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate({ id: s.id, ativar: !s.ativo })}
                >
                  {s.ativo ? <><PowerOff className="w-4 h-4 mr-1" />Desativar</> : <><Power className="w-4 h-4 mr-1" />Ativar</>}
                </Button>
              </CardContent>
            </Card>
          ))}
          {sessoes?.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-8">Nenhuma sessão criada ainda.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Realizar Sorteio Tab ───────────────────────────────────
function RealizarSorteioTab() {
  const queryClient = useQueryClient();
  const [premio, setPremio] = useState("");
  const [sorteando, setSorteando] = useState(false);
  const [animNome, setAnimNome] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  const { data: sessaoAtiva } = useQuery({
    queryKey: ["admin-sessao-ativa"],
    queryFn: async () => {
      const { data } = await supabase.from("sorteio_sessoes").select("*").eq("ativo", true).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: ultimasGanhadoras, refetch: refetchGanhadoras } = useQuery({
    queryKey: ["admin-ultimas-ganhadoras"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sorteio_ganhadores")
        .select("*, sorteio_participantes(nome, whatsapp)")
        .order("sorteado_em", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const [retiradaModal, setRetiradaModal] = useState<any>(null);
  const [retiradaFoto, setRetiradaFoto] = useState<File | null>(null);
  const [retiradaFotoPreview, setRetiradaFotoPreview] = useState<string | null>(null);
  const [recusouFoto, setRecusouFoto] = useState(false);
  const [confirmandoRetirada, setConfirmandoRetirada] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRetiradaFoto(file);
      setRetiradaFotoPreview(URL.createObjectURL(file));
    }
  };

  const confirmarRetirada = async () => {
    if (!retiradaModal) return;
    if (!retiradaFoto && !recusouFoto) return;

    setConfirmandoRetirada(true);
    try {
      let fotoUrl: string | null = null;

      if (retiradaFoto && !recusouFoto) {
        const ext = retiradaFoto.name.split(".").pop() || "jpg";
        const path = `${retiradaModal.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("sorteio-fotos")
          .upload(path, retiradaFoto, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("sorteio-fotos")
          .getPublicUrl(path);
        fotoUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from("sorteio_ganhadores")
        .update({
          status: "retirado",
          confirmado_em: new Date().toISOString(),
          foto_url: fotoUrl,
          recusou_foto: recusouFoto,
        })
        .eq("id", retiradaModal.id);
      if (error) throw error;

      refetchGanhadoras();
      toast.success("Retirada confirmada!");
      setRetiradaModal(null);
      setRetiradaFoto(null);
      setRetiradaFotoPreview(null);
      setRecusouFoto(false);
    } catch {
      toast.error("Erro ao confirmar retirada");
    } finally {
      setConfirmandoRetirada(false);
    }
  };

  const realizarSorteio = async () => {
    if (!sessaoAtiva) return toast.error("Nenhuma sessão ativa");
    if (!premio.trim()) return toast.error("Preencha o prêmio deste sorteio");

    setSorteando(true);
    setResultado(null);
    try {
      // Get eligible participants
      const { data: participantes } = await supabase
        .from("sorteio_participantes")
        .select("id, nome")
        .eq("sessao_id", sessaoAtiva.id);

      if (!participantes || participantes.length === 0) {
        toast.error("Nenhum participante nesta sessão");
        setSorteando(false);
        return;
      }

      // Get already won (not expired)
      const { data: jaGanharam } = await supabase
        .from("sorteio_ganhadores")
        .select("participante_id")
        .neq("status", "expirado");

      const idsGanharam = new Set((jaGanharam ?? []).map((g) => g.participante_id));
      const elegiveis = participantes.filter((p) => !idsGanharam.has(p.id));

      if (elegiveis.length === 0) {
        toast.error("Todos os participantes já ganharam!");
        setSorteando(false);
        return;
      }

      // Roulette animation
      const animDuration = 3000;
      const animInterval = 80;
      const steps = Math.floor(animDuration / animInterval);
      for (let i = 0; i < steps; i++) {
        const randomIdx = Math.floor(Math.random() * elegiveis.length);
        setAnimNome(elegiveis[randomIdx].nome);
        await new Promise((r) => setTimeout(r, animInterval + i * 2));
      }

      // Pick winner
      const winnerIdx = Math.floor(Math.random() * elegiveis.length);
      const winner = elegiveis[winnerIdx];
      setAnimNome(winner.nome);

      const expiraEm = new Date(Date.now() + 3 * 3600000).toISOString();
      const { error } = await supabase.from("sorteio_ganhadores").insert({
        participante_id: winner.id,
        sessao_id: sessaoAtiva.id,
        status: "aguardando",
        premio_descricao: premio.trim(),
        expira_em: expiraEm,
      });

      if (error) throw error;
      setResultado(winner.nome);
      refetchGanhadoras();
      queryClient.invalidateQueries({ queryKey: ["sorteio-ganhador-atual"] });
      toast.success(`🎉 ${winner.nome} foi sorteada!`);
    } catch {
      toast.error("Erro ao realizar sorteio");
    } finally {
      setSorteando(false);
    }
  };

  return (
    <div className="space-y-6">
      {!sessaoAtiva ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhuma sessão ativa. Ative uma sessão na aba "Sessões".</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-emerald-500/30 bg-emerald-50/30">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">Sessão ativa</p>
              <p className="font-semibold text-lg">{sessaoAtiva.nome}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-6 space-y-4">
              <Input
                placeholder="🎁 Prêmio deste sorteio (ex: Kit de Revistas EBD)"
                value={premio}
                onChange={(e) => setPremio(e.target.value)}
                maxLength={200}
              />

              {/* Animation area */}
              {sorteando && animNome && (
                <div className="bg-primary/5 rounded-xl py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Sorteando...</p>
                  <p className="text-3xl font-bold text-primary animate-pulse">{animNome}</p>
                </div>
              )}

              {resultado && !sorteando && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-8 text-center space-y-2">
                  <Trophy className="w-10 h-10 text-amber-500 mx-auto" />
                  <p className="text-sm text-muted-foreground">Ganhadora!</p>
                  <p className="text-3xl font-bold text-emerald-700">{resultado}</p>
                  <p className="text-sm text-muted-foreground">Prêmio: {premio}</p>
                </div>
              )}

              <Button
                size="lg"
                className="w-full h-14 text-lg font-bold"
                disabled={sorteando || !premio.trim()}
                onClick={realizarSorteio}
              >
                {sorteando ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Dice5 className="w-6 h-6 mr-2" />
                    Realizar Sorteio Agora
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Last winners */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimas Ganhadoras</CardTitle>
            </CardHeader>
            <CardContent>
              {ultimasGanhadoras?.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Nenhuma ganhadora ainda</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Prêmio</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ultimasGanhadoras?.map((g: any) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.sorteio_participantes?.nome ?? "—"}</TableCell>
                        <TableCell className="text-sm">{g.premio_descricao ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={g.status === "retirado" ? "default" : g.status === "expirado" ? "destructive" : "secondary"}
                            className={g.status === "retirado" ? "bg-emerald-600" : ""}>
                            {g.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {g.status === "aguardando" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRetiradaModal(g);
                                setRetiradaFoto(null);
                                setRetiradaFotoPreview(null);
                                setRecusouFoto(false);
                              }}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />Confirmar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Modal de Confirmação de Retirada */}
          <Dialog open={!!retiradaModal} onOpenChange={(open) => { if (!open) setRetiradaModal(null); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  Confirmar Retirada — {retiradaModal?.sorteio_participantes?.nome ?? "Ganhadora"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Upload de foto */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Foto da ganhadora com o prêmio</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFotoChange}
                    disabled={recusouFoto}
                    className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 disabled:opacity-50"
                  />
                  {retiradaFotoPreview && !recusouFoto && (
                    <div className="mt-2 rounded-lg overflow-hidden border">
                      <img src={retiradaFotoPreview} alt="Preview" className="w-full max-h-48 object-cover" />
                    </div>
                  )}
                </div>

                {/* Checkbox recusou foto */}
                <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                  <Checkbox
                    id="recusou-foto"
                    checked={recusouFoto}
                    onCheckedChange={(checked) => {
                      setRecusouFoto(checked === true);
                      if (checked) {
                        setRetiradaFoto(null);
                        setRetiradaFotoPreview(null);
                      }
                    }}
                  />
                  <label htmlFor="recusou-foto" className="text-sm cursor-pointer">
                    Ganhadora recusou a foto
                  </label>
                </div>

                <Button
                  className="w-full"
                  disabled={confirmandoRetirada || (!retiradaFoto && !recusouFoto)}
                  onClick={confirmarRetirada}
                >
                  {confirmandoRetirada ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <><CheckCircle className="w-4 h-4 mr-2" />Confirmar Retirada</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

// ─── Participantes Tab ──────────────────────────────────────
function ParticipantesTab() {
  const [search, setSearch] = useState("");

  const { data: participantes, isLoading } = useQuery({
    queryKey: ["admin-sorteio-participantes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sorteio_participantes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!participantes) return [];
    if (!search) return participantes;
    const q = search.toLowerCase();
    return participantes.filter(
      (p) => p.nome.toLowerCase().includes(q) || p.whatsapp.includes(q)
    );
  }, [participantes, search]);

  const exportCSV = () => {
    if (!participantes || participantes.length === 0) return;
    const headers = ["Nome", "WhatsApp", "Email", "Cidade", "Igreja", "Data Cadastro"];
    const rows = participantes.map((p) => [
      p.nome, p.whatsapp, p.email, p.cidade ?? "", p.igreja ?? "",
      format(new Date(p.created_at), "dd/MM/yyyy HH:mm"),
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participantes_sorteio_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          <span className="font-semibold">{participantes?.length ?? 0} participantes</span>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou WhatsApp"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" />CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Igreja</TableHead>
                  <TableHead>Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>{p.whatsapp}</TableCell>
                    <TableCell className="text-sm">{p.email}</TableCell>
                    <TableCell>{p.cidade ?? "—"}</TableCell>
                    <TableCell>{p.igreja ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(p.created_at), "dd/MM/yy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum participante encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Embaixadoras Tab ───────────────────────────────────────
function EmbaixadorasTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const { data: embaixadoras, isLoading } = useQuery({
    queryKey: ["admin-embaixadoras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("embaixadoras")
        .select("*, embaixadoras_tiers(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const ativarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("embaixadoras").update({ status: "ativa" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-embaixadoras"] });
      toast.success("Embaixadora ativada!");
    },
  });

  const filtered = useMemo(() => {
    if (!embaixadoras) return [];
    if (statusFilter === "todos") return embaixadoras;
    return embaixadoras.filter((e) => e.status === statusFilter);
  }, [embaixadoras, statusFilter]);

  const tierBadge = (tierNome: string | null) => {
    if (!tierNome) return <Badge variant="secondary">—</Badge>;
    const colors: Record<string, string> = {
      Iniciante: "bg-amber-700 text-white",
      Ativa: "bg-gray-500 text-white",
      Premium: "bg-[#C9A84C] text-white",
    };
    return <Badge className={colors[tierNome] ?? ""}>{tierNome}</Badge>;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      pendente: { variant: "secondary" },
      ativa: { variant: "default", className: "bg-emerald-600" },
      inativa: { variant: "outline" },
      bloqueada: { variant: "destructive" },
    };
    const conf = map[status] ?? { variant: "secondary" as const };
    return <Badge variant={conf.variant} className={conf.className}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-muted-foreground" />
          <span className="font-semibold">{embaixadoras?.length ?? 0} embaixadoras</span>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="ativa">Ativa</SelectItem>
            <SelectItem value="inativa">Inativa</SelectItem>
            <SelectItem value="bloqueada">Bloqueada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.nome}</TableCell>
                    <TableCell className="text-sm">{e.email}</TableCell>
                    <TableCell><code className="bg-muted px-2 py-0.5 rounded text-xs">{e.codigo_unico}</code></TableCell>
                    <TableCell>{statusBadge(e.status)}</TableCell>
                    <TableCell>{tierBadge(e.embaixadoras_tiers?.nome)}</TableCell>
                    <TableCell className="text-right">R${Number(e.total_vendas ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">R${Number(e.total_comissao ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      {e.status === "pendente" && (
                        <Button
                          size="sm"
                          disabled={ativarMutation.isPending}
                          onClick={() => ativarMutation.mutate(e.id)}
                        >
                          Ativar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma embaixadora encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function SorteioAdmin() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Gift className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Sorteio & Embaixadoras</h1>
          <p className="text-sm text-muted-foreground">Gerencie sessões de sorteio e programa de embaixadoras</p>
        </div>
      </div>

      <Tabs defaultValue="sessoes">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sessoes">Sessões</TabsTrigger>
          <TabsTrigger value="sorteio">Realizar Sorteio</TabsTrigger>
          <TabsTrigger value="participantes">Participantes</TabsTrigger>
          <TabsTrigger value="embaixadoras">Embaixadoras</TabsTrigger>
        </TabsList>
        <TabsContent value="sessoes"><SessoesTab /></TabsContent>
        <TabsContent value="sorteio"><RealizarSorteioTab /></TabsContent>
        <TabsContent value="participantes"><ParticipantesTab /></TabsContent>
        <TabsContent value="embaixadoras"><EmbaixadorasTab /></TabsContent>
      </Tabs>
    </div>
  );
}
