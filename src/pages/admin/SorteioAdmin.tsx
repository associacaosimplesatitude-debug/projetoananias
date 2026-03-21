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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Power, PowerOff, Dice5, Trophy, Users, Download,
  CheckCircle, Clock, Search, Loader2, Gift, Crown, Camera, ImageOff, Pencil, Trash2,
  MousePointerClick, DollarSign, TrendingUp, AlertCircle, Medal, MapPin, Share2, Instagram, Facebook, MessageCircle, Globe, Banknote,
  Eye, Copy,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// ─── Sessões Tab ───────────────────────────────────────────
function SessoesTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editSession, setEditSession] = useState<any>(null);
  const [newSession, setNewSession] = useState({
    nome: "", data_inicio: "", data_fim: "", intervalo_minutos: 60, premio_padrao: "",
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
      const dataInicioISO = new Date(newSession.data_inicio).toISOString();
      const dataFimISO = new Date(newSession.data_fim).toISOString();
      const { error } = await supabase.from("sorteio_sessoes").insert({
        nome: newSession.nome,
        data_inicio: dataInicioISO,
        data_fim: dataFimISO,
        intervalo_minutos: newSession.intervalo_minutos,
        premio_padrao: newSession.premio_padrao.trim() || null,
        ativo: false,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sorteio-sessoes"] });
      setModalOpen(false);
      setNewSession({ nome: "", data_inicio: "", data_fim: "", intervalo_minutos: 60, premio_padrao: "" });
      toast.success("Sessão criada!");
    },
    onError: () => toast.error("Erro ao criar sessão"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editSession) return;
      const { error } = await supabase.from("sorteio_sessoes").update({
        nome: newSession.nome,
        data_inicio: newSession.data_inicio,
        data_fim: newSession.data_fim,
        intervalo_minutos: newSession.intervalo_minutos,
        premio_padrao: newSession.premio_padrao.trim() || null,
      }).eq("id", editSession.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sorteio-sessoes"] });
      setModalOpen(false);
      setEditSession(null);
      setNewSession({ nome: "", data_inicio: "", data_fim: "", intervalo_minutos: 60, premio_padrao: "" });
      toast.success("Sessão atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar sessão"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sorteio_ganhadores").delete().eq("sessao_id", id);
      if (error) throw error;
      // Desvincular participantes (preservar dados para futuros contatos)
      const { error: error2 } = await supabase.from("sorteio_participantes").update({ sessao_id: null }).eq("sessao_id", id);
      if (error2) throw error2;
      const { error: error3 } = await supabase.from("sorteio_sessoes").delete().eq("id", id);
      if (error3) throw error3;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sorteio-sessoes"] });
      toast.success("Sessão excluída!");
    },
    onError: () => toast.error("Erro ao excluir sessão"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativar }: { id: string; ativar: boolean }) => {
      if (ativar) {
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

  const openEdit = (s: any) => {
    setEditSession(s);
    setNewSession({
      nome: s.nome,
      data_inicio: s.data_inicio ? s.data_inicio.slice(0, 16) : "",
      data_fim: s.data_fim ? s.data_fim.slice(0, 16) : "",
      intervalo_minutos: s.intervalo_minutos,
      premio_padrao: s.premio_padrao || "",
    });
    setModalOpen(true);
  };

  const handleCloseModal = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setEditSession(null);
      setNewSession({ nome: "", data_inicio: "", data_fim: "", intervalo_minutos: 60, premio_padrao: "" });
    }
  };

  const isEditing = !!editSession;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Sessões de Sorteio</h3>
        <Dialog open={modalOpen} onOpenChange={handleCloseModal}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova Sessão</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditing ? "Editar Sessão" : "Nova Sessão de Sorteio"}</DialogTitle>
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
              <div>
                <label className="text-sm font-medium text-muted-foreground">Prêmio padrão dos sorteios (opcional)</label>
                <Input
                  placeholder='Ex: Kit de Revistas EBD'
                  value={newSession.premio_padrao}
                  onChange={(e) => setNewSession({ ...newSession, premio_padrao: e.target.value })}
                  maxLength={200}
                />
              </div>
              <Button
                className="w-full"
                disabled={!newSession.nome || !newSession.data_inicio || !newSession.data_fim || isSaving}
                onClick={() => isEditing ? updateMutation.mutate() : createMutation.mutate()}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditing ? "Salvar Alterações" : "Criar Sessão"}
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
                {(s as any).premio_padrao && <p>🎁 Prêmio: {(s as any).premio_padrao}</p>}
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(s)}
                  >
                    <Pencil className="w-4 h-4 mr-1" />Editar
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={s.ativo || deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir sessão?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso removerá a sessão "{s.nome}" e todos os participantes/ganhadores vinculados. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteMutation.mutate(s.id)}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button
                    size="sm"
                    variant={s.ativo ? "destructive" : "default"}
                    className="flex-1"
                    disabled={toggleMutation.isPending}
                    onClick={() => toggleMutation.mutate({ id: s.id, ativar: !s.ativo })}
                  >
                    {s.ativo ? <><PowerOff className="w-4 h-4 mr-1" />Desativar</> : <><Power className="w-4 h-4 mr-1" />Ativar</>}
                  </Button>
                </div>
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
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Excluir participante "${nome}"? Isso também removerá ganhadores vinculados.`)) return;
    setDeletingId(id);
    try {
      await supabase.from("sorteio_ganhadores").delete().eq("participante_id", id);
      const { error } = await supabase.from("sorteio_participantes").delete().eq("id", id);
      if (error) throw error;
      toast.success(`Participante "${nome}" excluído.`);
      queryClient.invalidateQueries({ queryKey: ["admin-sorteio-participantes"] });
    } catch {
      toast.error("Erro ao excluir participante.");
    } finally {
      setDeletingId(null);
    }
  };

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
                  <TableHead className="w-12"></TableHead>
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
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(p.id, p.nome)}
                        disabled={deletingId === p.id}
                      >
                        {deletingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
  const [selectedEmb, setSelectedEmb] = useState<any>(null);

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

  // ─── Seção A: Totais consolidados ───
  const { data: totalCliques } = useQuery({
    queryKey: ["admin-emb-total-cliques"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("embaixadoras_cliques")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: vendasAgg } = useQuery({
    queryKey: ["admin-emb-vendas-agg"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("embaixadoras_vendas")
        .select("valor_venda, valor_comissao, status, pago_em");
      if (error) throw error;
      const totalVendas = (data ?? []).reduce((s, v) => s + Number(v.valor_venda ?? 0), 0);
      const totalComissao = (data ?? []).reduce((s, v) => s + Number(v.valor_comissao ?? 0), 0);
      const pendentes = (data ?? [])
        .filter((v) => v.status === "aprovada" && !v.pago_em)
        .reduce((s, v) => s + Number(v.valor_comissao ?? 0), 0);
      return { totalVendas, totalComissao, pendentes };
    },
  });

  // ─── Seção B: Ranking top 5 ───
  const rankingData = useMemo(() => {
    if (!embaixadoras) return [];
    return [...embaixadoras]
      .sort((a, b) => Number(b.total_vendas ?? 0) - Number(a.total_vendas ?? 0))
      .slice(0, 5);
  }, [embaixadoras]);

  // ─── Seção C: Insights ───
  const { data: topEstados } = useQuery({
    queryKey: ["admin-emb-top-estados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("embaixadoras_cliques")
        .select("estado");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((c) => {
        const est = c.estado || "Desconhecido";
        counts[est] = (counts[est] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    },
  });

  const { data: canaisOrigem } = useQuery({
    queryKey: ["admin-emb-canais-origem"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("embaixadoras_cliques")
        .select("canal_origem");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((c) => {
        const canal = c.canal_origem || "Direto";
        counts[canal] = (counts[canal] || 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    },
  });

  const { data: melhorHorario } = useQuery({
    queryKey: ["admin-emb-melhor-horario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("embaixadoras_cliques")
        .select("created_at");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((c) => {
        const hora = new Date(c.created_at).getHours().toString().padStart(2, "0") + ":00";
        counts[hora] = (counts[hora] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    },
  });

  // ─── Seção D: Comissões pendentes ───
  const { data: comissoesPendentes } = useQuery({
    queryKey: ["admin-emb-comissoes-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("embaixadoras_vendas")
        .select("*, embaixadoras(nome, codigo_unico)")
        .eq("status", "aprovada")
        .is("pago_em", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pagarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("embaixadoras_vendas")
        .update({ status: "paga", pago_em: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-emb-comissoes-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-emb-vendas-agg"] });
      toast.success("Comissão marcada como paga!");
    },
    onError: () => toast.error("Erro ao marcar como paga"),
  });

  const pagarTodasMutation = useMutation({
    mutationFn: async () => {
      if (!comissoesPendentes || comissoesPendentes.length === 0) return;
      const ids = comissoesPendentes.map((c) => c.id);
      const { error } = await supabase
        .from("embaixadoras_vendas")
        .update({ status: "paga", pago_em: new Date().toISOString() } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-emb-comissoes-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-emb-vendas-agg"] });
      toast.success("Todas as comissões foram marcadas como pagas!");
    },
    onError: () => toast.error("Erro ao pagar todas"),
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

  const deletarEmbMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase
        .from("embaixadoras")
        .delete({ count: "exact" })
        .eq("id", id);
      if (error) throw error;
      if (!count || count === 0) throw new Error("Nenhum registro removido. Verifique suas permissões.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-embaixadoras"] });
      queryClient.invalidateQueries({ queryKey: ["admin-emb-total-cliques"] });
      queryClient.invalidateQueries({ queryKey: ["admin-emb-vendas-agg"] });
      queryClient.invalidateQueries({ queryKey: ["admin-emb-comissoes-pendentes"] });
      toast.success("Embaixadora excluída com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir: " + err.message);
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

  const canalIcon = (canal: string) => {
    const lower = canal.toLowerCase();
    if (lower.includes("whatsapp")) return <MessageCircle className="w-4 h-4 text-emerald-500" />;
    if (lower.includes("instagram")) return <Instagram className="w-4 h-4 text-purple-500" />;
    if (lower.includes("facebook")) return <Facebook className="w-4 h-4 text-blue-600" />;
    return <Globe className="w-4 h-4 text-muted-foreground" />;
  };

  const rankingColors = ["bg-amber-50 border-amber-300", "bg-gray-50 border-gray-300", "bg-orange-50 border-orange-300"];
  const rankingIcons = ["🥇", "🥈", "🥉"];

  const maxEstado = topEstados?.[0]?.[1] ?? 1;

  return (
    <div className="space-y-6">
      {/* ── Seção A: Totais consolidados ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <MousePointerClick className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Cliques</p>
                <p className="text-2xl font-bold">{totalCliques?.toLocaleString("pt-BR") ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Vendas</p>
                <p className="text-2xl font-bold">R${(vendasAgg?.totalVendas ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Comissões</p>
                <p className="text-2xl font-bold">R${(vendasAgg?.totalComissao ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comissões Pendentes</p>
                <p className="text-2xl font-bold text-amber-600">R${(vendasAgg?.pendentes ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Seção B: Ranking top 5 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Medal className="w-5 h-5 text-amber-500" />
            Ranking de Embaixadoras
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rankingData.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">Sem dados</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {rankingData.map((e: any, i) => (
                <div
                  key={e.id}
                  className={`rounded-lg border p-4 ${i < 3 ? rankingColors[i] : "bg-muted/30 border-border"}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{i < 3 ? rankingIcons[i] : `${i + 1}º`}</span>
                    <span className="font-semibold text-sm truncate">{e.nome}</span>
                  </div>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{e.codigo_unico}</code>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {tierBadge((e as any).embaixadoras_tiers?.nome)}
                  </div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span>Vendas: <strong>R${Number(e.total_vendas ?? 0).toFixed(2)}</strong></span>
                  </div>
                  <div className="text-xs">
                    Comissão: <strong>R${Number(e.total_comissao ?? 0).toFixed(2)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Seção C: Insights ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Top Estados */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" /> Top Estados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topEstados && topEstados.length > 0 ? topEstados.map(([estado, count]) => (
              <div key={estado} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{estado}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <Progress value={(count / maxEstado) * 100} className="h-2" />
              </div>
            )) : <p className="text-sm text-muted-foreground text-center py-2">Sem dados</p>}
          </CardContent>
        </Card>

        {/* Canais de Origem */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Share2 className="w-4 h-4 text-muted-foreground" /> Canais de Origem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canaisOrigem && canaisOrigem.length > 0 ? canaisOrigem.map(([canal, count]) => (
              <div key={canal} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {canalIcon(canal)}
                  <span className="text-sm">{canal}</span>
                </div>
                <span className="text-sm font-medium">{count}</span>
              </div>
            )) : <p className="text-sm text-muted-foreground text-center py-2">Sem dados</p>}
          </CardContent>
        </Card>

        {/* Melhor Horário */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Melhor Horário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {melhorHorario && melhorHorario.length > 0 ? melhorHorario.map(([hora, count], i) => (
              <div key={hora} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{i === 0 ? "🔥" : i === 1 ? "⚡" : "📊"}</span>
                  <span className="text-sm font-medium">{hora}</span>
                </div>
                <span className="text-sm text-muted-foreground">{count} cliques</span>
              </div>
            )) : <p className="text-sm text-muted-foreground text-center py-2">Sem dados</p>}
          </CardContent>
        </Card>
      </div>

      {/* ── Seção D: Comissões pendentes de pagamento ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="w-5 h-5 text-amber-500" />
              Comissões Pendentes de Pagamento
            </CardTitle>
            {comissoesPendentes && comissoesPendentes.length > 0 && (
              <Button
                size="sm"
                onClick={() => pagarTodasMutation.mutate()}
                disabled={pagarTodasMutation.isPending}
              >
                {pagarTodasMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <><CheckCircle className="w-4 h-4 mr-1" />Pagar Todas ({comissoesPendentes.length})</>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!comissoesPendentes || comissoesPendentes.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhuma comissão pendente 🎉</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Embaixadora</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Valor Venda</TableHead>
                  <TableHead className="text-right">% Comissão</TableHead>
                  <TableHead className="text-right">Valor Comissão</TableHead>
                  <TableHead>Data Venda</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comissoesPendentes.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.embaixadoras?.nome ?? "—"}</TableCell>
                    <TableCell><code className="bg-muted px-2 py-0.5 rounded text-xs">{v.embaixadoras?.codigo_unico ?? "—"}</code></TableCell>
                    <TableCell className="text-right">R${Number(v.valor_venda ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(v.percentual_comissao ?? 0)}%</TableCell>
                    <TableCell className="text-right font-medium">R${Number(v.valor_comissao ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {v.created_at ? format(new Date(v.created_at), "dd/MM/yy") : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pagarMutation.isPending}
                        onClick={() => pagarMutation.mutate(v.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />Pagar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Tabela de embaixadoras (existente) ── */}
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
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setSelectedEmb(e)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir embaixadora?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Isso removerá permanentemente <strong>{e.nome}</strong>, todos os registros de cliques e comissões/vendas associados. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={deletarEmbMutation.isPending}
                                onClick={() => deletarEmbMutation.mutate(e.id)}
                              >
                                {deletarEmbMutation.isPending ? "Excluindo..." : "Excluir"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        {e.status === "pendente" && (
                          <Button
                            size="sm"
                            disabled={ativarMutation.isPending}
                            onClick={() => ativarMutation.mutate(e.id)}
                          >
                            Ativar
                          </Button>
                        )}
                      </div>
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

      {/* ── Modal detalhes da embaixadora ── */}
      <Dialog open={!!selectedEmb} onOpenChange={(open) => !open && setSelectedEmb(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Embaixadora</DialogTitle>
          </DialogHeader>
          {selectedEmb && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Nome</p>
                  <p className="font-medium">{selectedEmb.nome}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedEmb.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">WhatsApp</p>
                  <p className="font-medium">{selectedEmb.whatsapp || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Código</p>
                  <code className="bg-muted px-2 py-0.5 rounded text-xs">{selectedEmb.codigo_unico}</code>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  {statusBadge(selectedEmb.status)}
                </div>
                <div>
                  <p className="text-muted-foreground">Tier</p>
                  {tierBadge(selectedEmb.embaixadoras_tiers?.nome)}
                </div>
                <div>
                  <p className="text-muted-foreground">Total Vendas</p>
                  <p className="font-medium">R${Number(selectedEmb.total_vendas ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Comissão</p>
                  <p className="font-medium">R${Number(selectedEmb.total_comissao ?? 0).toFixed(2)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Cadastro</p>
                  <p className="font-medium">{format(new Date(selectedEmb.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Link de compartilhamento</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-xs break-all">
                    {`https://gestaoebd.com.br/r/${selectedEmb.codigo_unico}`}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(`https://gestaoebd.com.br/r/${selectedEmb.codigo_unico}`);
                      toast.success("Link copiado!");
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
