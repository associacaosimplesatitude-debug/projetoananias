import { useState, useRef } from "react";
import { notificarAlunoCadastrado, notificarAcessoAprovado, notificarTrocaDispositivoAprovada, notificarAcessoRevogado } from "@/lib/revistaWhatsappNotifications";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Upload, Users, Check, X, Unlock, Ban, Eye, AlertTriangle, Copy, Share2, Printer, QrCode, Key, Package, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";

type AlunoRow = {
  id: string;
  aluno_nome: string;
  aluno_telefone: string | null;
  aluno_email: string | null;
  aluno_turma: string | null;
  tipo_revista: string | null;
  status: string;
  comprovante_url: string | null;
  device_token: string | null;
  troca_dispositivo_solicitada: boolean;
  created_at: string;
};

type LicencaRow = {
  id: string;
  quantidade_total: number;
  quantidade_usada: number;
  status: string;
  plano: string;
  expira_em: string;
  chave_pix: string | null;
  codigo_pagamento: string | null;
  revista_aluno_id: string | null;
  revista_professor_id: string | null;
};

export default function LicencasPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [showComprovanteDialog, setShowComprovanteDialog] = useState<string | null>(null);
  const [formNome, setFormNome] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTurma, setFormTurma] = useState("");
  const [formTipoRevista, setFormTipoRevista] = useState("aluno");
  const [csvData, setCsvData] = useState<{ nome: string; telefone: string; email: string; turma: string }[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [pixKey, setPixKey] = useState("");
  const [savingPix, setSavingPix] = useState(false);

  const { data: cliente } = useQuery({
    queryKey: ["se-cliente", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja, telefone")
        .eq("superintendente_user_id", user!.id)
        .eq("status_ativacao_ebd", true)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: licencas = [] } = useQuery({
    queryKey: ["se-licencas", cliente?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revista_licencas")
        .select("*")
        .eq("superintendente_id", cliente!.id)
        .eq("status", "ativa");
      if (error) throw error;
      return (data || []) as unknown as LicencaRow[];
    },
    enabled: !!cliente?.id,
  });

  const activeLicenca = licencas[0];

  // Initialize pixKey from active license
  useState(() => {
    if (activeLicenca?.chave_pix) setPixKey(activeLicenca.chave_pix);
  });

  const { data: alunos = [], isLoading } = useQuery({
    queryKey: ["se-licenca-alunos", cliente?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revista_licenca_alunos")
        .select("*")
        .eq("superintendente_id", cliente!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AlunoRow[];
    },
    enabled: !!cliente?.id,
  });

  const totalUsado = activeLicenca?.quantidade_usada || 0;
  const totalDisponivel = activeLicenca?.quantidade_total || 0;
  const ativos = alunos.filter(a => a.status === "ativo").length;
  const pendentes = alunos.filter(a => a.status === "aguardando_aprovacao").length;
  const livres = Math.max(0, totalDisponivel - totalUsado);
  const percentUsado = totalDisponivel > 0 ? (totalUsado / totalDisponivel) * 100 : 0;
  const daysToExpire = activeLicenca ? Math.ceil((new Date(activeLicenca.expira_em).getTime() - Date.now()) / 86400000) : 999;

  const addAlunoMutation = useMutation({
    mutationFn: async (data: { nome: string; telefone: string; email: string; turma: string; tipo_revista: string }) => {
      if (!activeLicenca || !cliente) throw new Error("Sem licença ativa");
      if (activeLicenca.quantidade_usada >= activeLicenca.quantidade_total) {
        throw new Error("Todas as licenças já foram utilizadas");
      }
      if (!data.email) throw new Error("Email é obrigatório");

      // Create auth user
      const { data: authResult, error: authError } = await supabase.functions.invoke("create-auth-user-direct", {
        body: { email: data.email, password: "mudar123", full_name: data.nome },
      });
      if (authError) throw authError;
      if (!authResult?.success) throw new Error(authResult?.error || "Erro ao criar usuário");

      const { error } = await supabase.from("revista_licenca_alunos").insert({
        licenca_id: activeLicenca.id,
        superintendente_id: cliente.id,
        aluno_nome: data.nome,
        aluno_telefone: data.telefone || null,
        aluno_email: data.email.toLowerCase().trim(),
        aluno_turma: data.turma || null,
        tipo_revista: data.tipo_revista,
        senha_provisoria: "mudar123",
        status: "pendente",
        user_id: authResult.userId,
      } as any);
      if (error) throw error;

      // Increment usage
      await supabase
        .from("revista_licencas")
        .update({ quantidade_usada: activeLicenca.quantidade_usada + 1 } as any)
        .eq("id", activeLicenca.id);

      // WhatsApp notification
      if (data.telefone) {
        const link = `${window.location.origin}/ebd/revista-virtual`;
        notificarAlunoCadastrado(data.nome, data.telefone, link, data.email, "mudar123");
      }
    },
    onSuccess: () => {
      toast.success("Aluno adicionado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["se-licenca-alunos"] });
      queryClient.invalidateQueries({ queryKey: ["se-licencas"] });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === "ativo") {
        updates.aprovado_em = new Date().toISOString();
        updates.aprovado_por = cliente?.id;
      }
      const { error } = await supabase.from("revista_licenca_alunos").update(updates).eq("id", id);
      if (error) throw error;

      const aluno = alunos.find(a => a.id === id);
      if (aluno && aluno.aluno_telefone) {
        if (status === "ativo") {
          const link = `${window.location.origin}/ebd/revista-virtual`;
          notificarAcessoAprovado(aluno.aluno_telefone, aluno.aluno_nome, aluno.aluno_email || "", link, "mudar123");
        } else if (status === "bloqueado") {
          notificarAcessoRevogado(aluno.aluno_telefone, aluno.aluno_nome);
        }
      }
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      queryClient.invalidateQueries({ queryKey: ["se-licenca-alunos"] });
      queryClient.invalidateQueries({ queryKey: ["se-licencas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetDeviceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("revista_licenca_alunos")
        .update({
          device_token: null,
          device_info: null,
          device_autorizado_em: null,
          troca_dispositivo_solicitada: false,
          troca_solicitada_em: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      const aluno = alunos.find(a => a.id === id);
      if (aluno?.aluno_telefone) {
        notificarTrocaDispositivoAprovada(aluno.aluno_telefone, aluno.aluno_nome);
      }
    },
    onSuccess: () => {
      toast.success("Dispositivo liberado para troca");
      queryClient.invalidateQueries({ queryKey: ["se-licenca-alunos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setFormNome("");
    setFormTelefone("");
    setFormEmail("");
    setFormTurma("");
    setFormTipoRevista("aluno");
  };

  const handleSavePixKey = async () => {
    if (!activeLicenca || !pixKey.trim()) return;
    setSavingPix(true);
    const { error } = await supabase
      .from("revista_licencas")
      .update({ chave_pix: pixKey.trim() } as any)
      .eq("id", activeLicenca.id);
    setSavingPix(false);
    if (error) {
      toast.error("Erro ao salvar chave PIX");
      return;
    }
    toast.success("Chave PIX salva com sucesso!");
    queryClient.invalidateQueries({ queryKey: ["se-licencas"] });
  };

  const paymentLink = activeLicenca?.codigo_pagamento
    ? `${window.location.origin}/pagar/${activeLicenca.codigo_pagamento}`
    : null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const shareWhatsApp = () => {
    if (!paymentLink || !cliente) return;
    const msg = encodeURIComponent(
      `📖 Revista Virtual - ${cliente.nome_igreja}\n\nAcesse o link abaixo para se cadastrar e enviar seu comprovante de pagamento:\n\n${paymentLink}\n\nChave PIX: ${activeLicenca?.chave_pix || ""}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const printQR = () => {
    if (!qrRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>QR Code PIX</title></head>
      <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif">
        <h2>${cliente?.nome_igreja || "Revista Virtual"}</h2>
        <p>Chave PIX: ${activeLicenca?.chave_pix || ""}</p>
        ${qrRef.current.innerHTML}
        <p style="margin-top:20px">Escaneie o QR Code ou copie a chave PIX para realizar o pagamento</p>
        <p style="font-size:12px;color:#666">Link: ${paymentLink || ""}</p>
      </body></html>
    `);
    win.print();
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const errors: string[] = [];
      const parsed: typeof csvData = [];
      lines.forEach((line, idx) => {
        if (idx === 0 && line.toLowerCase().includes("nome")) return;
        const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
        if (parts.length < 1) { errors.push(`Linha ${idx + 1}: dados insuficientes`); return; }
        const [nome, telefone = "", email = "", turma = ""] = parts;
        if (!nome) { errors.push(`Linha ${idx + 1}: nome vazio`); return; }
        if (email && !email.includes("@")) { errors.push(`Linha ${idx + 1}: email inválido (${email})`); return; }
        parsed.push({ nome, telefone, email, turma });
      });
      setCsvData(parsed);
      setCsvErrors(errors);
      setShowCsvDialog(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const importCsv = async () => {
    if (!activeLicenca || !cliente) return;
    const remaining = activeLicenca.quantidade_total - activeLicenca.quantidade_usada;
    if (csvData.length > remaining) {
      toast.error(`Apenas ${remaining} licenças disponíveis`);
      return;
    }
    const rows = csvData.map((d) => ({
      licenca_id: activeLicenca.id,
      superintendente_id: cliente.id,
      aluno_nome: d.nome,
      aluno_telefone: d.telefone || null,
      aluno_email: d.email || null,
      aluno_turma: d.turma || null,
      tipo_revista: "aluno",
      senha_provisoria: "mudar123",
      status: "pendente",
    }));
    const { error } = await supabase.from("revista_licenca_alunos").insert(rows as any);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} alunos importados`);
    queryClient.invalidateQueries({ queryKey: ["se-licenca-alunos"] });
    setShowCsvDialog(false);
    setCsvData([]);
    setCsvErrors([]);
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "pendente": return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">🟡 Pendente</Badge>;
      case "aguardando_aprovacao": return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">🟠 Aguardando</Badge>;
      case "ativo": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">✅ Ativo</Badge>;
      case "bloqueado": return <Badge variant="destructive">🔴 Bloqueado</Badge>;
      case "expirado": return <Badge variant="secondary">⏰ Expirado</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  if (!cliente) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Carregando dados do superintendente...</p>
      </div>
    );
  }

  if (!activeLicenca) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Licenças — Revista Virtual</h1>
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma licença ativa</h3>
            <p className="text-muted-foreground">
              Você ainda não possui uma licença de revista virtual. Entre em contato com a editora para adquirir.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPixKey = activeLicenca.chave_pix || pixKey;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Licenças — Revista Virtual</h1>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Package className="h-7 w-7 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalDisponivel}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-7 w-7 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{ativos}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Clock className="h-7 w-7 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{pendentes}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <Users className="h-7 w-7 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{livres}</p>
                <p className="text-xs text-muted-foreground">Disponíveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage bar + expiry */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span>{totalUsado} licenças usadas</span>
            <span className="capitalize">Plano {activeLicenca.plano}</span>
          </div>
          <Progress value={percentUsado} className="h-3" indicatorClassName="bg-orange-500" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{totalUsado} / {totalDisponivel}</span>
            <span className={daysToExpire <= 30 ? "text-destructive font-medium" : ""}>
              {daysToExpire <= 0 ? "Expirada" : `Expira em ${format(new Date(activeLicenca.expira_em), "dd/MM/yyyy")} (${daysToExpire} dias)`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* PIX Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5" />
            Minha Chave PIX
          </CardTitle>
          <CardDescription>
            Cadastre sua chave PIX para gerar o QR Code e link de pagamento para seus alunos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="CPF, CNPJ, email, telefone ou chave aleatória"
              value={pixKey || currentPixKey || ""}
              onChange={(e) => setPixKey(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSavePixKey} disabled={savingPix || !pixKey.trim()}>
              {savingPix ? "Salvando..." : "Salvar"}
            </Button>
          </div>

          {currentPixKey && paymentLink && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <span className="text-sm font-mono flex-1 truncate">{paymentLink}</span>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(paymentLink)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <div ref={qrRef} className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG value={currentPixKey} size={200} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(currentPixKey)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Chave PIX
                </Button>
                <Button variant="outline" size="sm" onClick={shareWhatsApp}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartilhar WhatsApp
                </Button>
                <Button variant="outline" size="sm" onClick={printQR}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir QR Code
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Aluno
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          Importar CSV
        </Button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
      </div>

      {/* Troca requests alert */}
      {alunos.some((a) => a.troca_dispositivo_solicitada) && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span className="text-sm text-orange-700 font-medium">
              {alunos.filter((a) => a.troca_dispositivo_solicitada).length} solicitação(ões) de troca de dispositivo pendente(s)
            </span>
          </CardContent>
        </Card>
      )}

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Comprovante</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : alunos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum aluno cadastrado</TableCell>
                </TableRow>
              ) : (
                alunos.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{a.aluno_nome}</p>
                        <p className="text-xs text-muted-foreground">{a.aluno_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {a.tipo_revista || "aluno"}
                      </Badge>
                    </TableCell>
                    <TableCell>{a.aluno_turma || "—"}</TableCell>
                    <TableCell>{statusBadge(a.status)}</TableCell>
                    <TableCell>
                      {a.comprovante_url ? (
                        <Button size="sm" variant="ghost" onClick={() => setShowComprovanteDialog(a.comprovante_url)}>
                          <Eye className="h-4 w-4 mr-1" /> Ver
                        </Button>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {a.device_token ? (
                        <Badge variant="outline" className="text-xs">
                          {a.troca_dispositivo_solicitada ? "🔄 Troca solicitada" : "📱 Vinculado"}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">Sem dispositivo</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {a.status === "aguardando_aprovacao" && (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" title="Aprovar"
                              onClick={() => updateStatusMutation.mutate({ id: a.id, status: "ativo" })}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" title="Rejeitar"
                              onClick={() => updateStatusMutation.mutate({ id: a.id, status: "pendente" })}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {a.troca_dispositivo_solicitada && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" title="Liberar troca"
                            onClick={() => resetDeviceMutation.mutate(a.id)}>
                            <Unlock className="h-4 w-4" />
                          </Button>
                        )}
                        {a.status === "ativo" && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" title="Revogar acesso"
                            onClick={() => updateStatusMutation.mutate({ id: a.id, status: "bloqueado" })}>
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Student Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Aluno</DialogTitle>
            <DialogDescription>Preencha os dados do aluno para criar uma licença</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome completo *</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Nome do aluno" />
            </div>
            <div>
              <Label>WhatsApp *</Label>
              <Input value={formTelefone} onChange={(e) => setFormTelefone(e.target.value)} placeholder="11999999999" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="aluno@email.com" type="email" />
            </div>
            <div>
              <Label>Tipo de Revista</Label>
              <Select value={formTipoRevista} onValueChange={setFormTipoRevista}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aluno">Aluno</SelectItem>
                  <SelectItem value="professor">Professor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Turma</Label>
              <Input value={formTurma} onChange={(e) => setFormTurma(e.target.value)} placeholder="Ex: Jovens" />
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm"><strong>Senha provisória:</strong> <span className="font-mono">mudar123</span></p>
              <p className="text-xs text-muted-foreground mt-1">O aluno usará esta senha no primeiro acesso</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>Cancelar</Button>
            <Button
              onClick={() => addAlunoMutation.mutate({ nome: formNome, telefone: formTelefone, email: formEmail, turma: formTurma, tipo_revista: formTipoRevista })}
              disabled={!formNome || !formEmail || addAlunoMutation.isPending}
            >
              {addAlunoMutation.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={showCsvDialog} onOpenChange={setShowCsvDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar Alunos via CSV</DialogTitle>
            <DialogDescription>Formato: nome, telefone, email, turma</DialogDescription>
          </DialogHeader>
          {csvErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded p-3 text-sm space-y-1">
              {csvErrors.map((err, i) => <p key={i} className="text-destructive">{err}</p>)}
            </div>
          )}
          {csvData.length > 0 && (
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Turma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.nome}</TableCell>
                      <TableCell>{row.telefone}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.turma}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCsvDialog(false); setCsvData([]); setCsvErrors([]); }}>Cancelar</Button>
            <Button onClick={importCsv} disabled={csvData.length === 0}>Importar {csvData.length} aluno(s)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comprovante Viewer */}
      <Dialog open={!!showComprovanteDialog} onOpenChange={() => setShowComprovanteDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Comprovante de Pagamento</DialogTitle>
          </DialogHeader>
          {showComprovanteDialog && (
            <img src={showComprovanteDialog} alt="Comprovante" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
