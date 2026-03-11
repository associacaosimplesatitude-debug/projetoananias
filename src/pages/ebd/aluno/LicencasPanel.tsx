import { useState, useRef } from "react";
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
import { toast } from "sonner";
import { Plus, Upload, Users, Check, X, Unlock, Ban, Eye, AlertTriangle, FileText } from "lucide-react";
import { format } from "date-fns";

type AlunoRow = {
  id: string;
  aluno_nome: string;
  aluno_telefone: string | null;
  aluno_email: string | null;
  aluno_turma: string | null;
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
};

export default function LicencasPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [showComprovanteDialog, setShowComprovanteDialog] = useState<string | null>(null);
  const [formNome, setFormNome] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTurma, setFormTurma] = useState("");
  const [csvData, setCsvData] = useState<{ nome: string; telefone: string; email: string; turma: string }[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  // Get cliente for current SE
  const { data: cliente } = useQuery({
    queryKey: ["se-cliente", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ebd_clientes")
        .select("id")
        .eq("superintendente_user_id", user!.id)
        .eq("status_ativacao_ebd", true)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Get licencas for this SE
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

  // Get alunos
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
  const percentUsado = totalDisponivel > 0 ? (totalUsado / totalDisponivel) * 100 : 0;

  // Add aluno mutation
  const addAlunoMutation = useMutation({
    mutationFn: async (data: { nome: string; telefone: string; email: string; turma: string }) => {
      if (!activeLicenca || !cliente) throw new Error("Sem licença ativa");
      if (activeLicenca.quantidade_usada >= activeLicenca.quantidade_total) {
        throw new Error("Todas as licenças já foram utilizadas");
      }
      const { error } = await supabase.from("revista_licenca_alunos").insert({
        licenca_id: activeLicenca.id,
        superintendente_id: cliente.id,
        aluno_nome: data.nome,
        aluno_telefone: data.telefone || null,
        aluno_email: data.email || null,
        aluno_turma: data.turma || null,
        status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aluno adicionado");
      queryClient.invalidateQueries({ queryKey: ["se-licenca-alunos"] });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === "ativo") {
        updates.aprovado_em = new Date().toISOString();
        updates.aprovado_por = cliente?.id;
      }
      const { error } = await supabase.from("revista_licenca_alunos").update(updates).eq("id", id);
      if (error) throw error;

      // Update quantidade_usada on license
      if (status === "ativo" && activeLicenca) {
        await supabase
          .from("revista_licencas")
          .update({ quantidade_usada: activeLicenca.quantidade_usada + 1 })
          .eq("id", activeLicenca.id);
      }
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      queryClient.invalidateQueries({ queryKey: ["se-licenca-alunos"] });
      queryClient.invalidateQueries({ queryKey: ["se-licencas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Device reset mutation
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
        if (idx === 0 && line.toLowerCase().includes("nome")) return; // skip header
        const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
        if (parts.length < 1) {
          errors.push(`Linha ${idx + 1}: dados insuficientes`);
          return;
        }
        const [nome, telefone = "", email = "", turma = ""] = parts;
        if (!nome) {
          errors.push(`Linha ${idx + 1}: nome vazio`);
          return;
        }
        if (email && !email.includes("@")) {
          errors.push(`Linha ${idx + 1}: email inválido (${email})`);
          return;
        }
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
      toast.error(`Apenas ${remaining} licenças disponíveis, mas ${csvData.length} alunos na lista`);
      return;
    }

    const rows = csvData.map((d) => ({
      licenca_id: activeLicenca.id,
      superintendente_id: cliente.id,
      aluno_nome: d.nome,
      aluno_telefone: d.telefone || null,
      aluno_email: d.email || null,
      aluno_turma: d.turma || null,
      status: "pendente",
    }));

    const { error } = await supabase.from("revista_licenca_alunos").insert(rows);
    if (error) {
      toast.error(error.message);
      return;
    }
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Licenças — Revista Virtual</h1>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Resumo de Licenças
          </CardTitle>
          <CardDescription>
            Plano {activeLicenca.plano} • Expira em{" "}
            {format(new Date(activeLicenca.expira_em), "dd/MM/yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>{totalUsado} licenças usadas</span>
            <span>{totalDisponivel - totalUsado} disponíveis</span>
          </div>
          <Progress value={percentUsado} className="h-3" indicatorClassName="bg-orange-500" />
          <p className="text-right text-sm font-medium">
            {totalUsado} / {totalDisponivel}
          </p>
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
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleCsvFile}
        />
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
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : alunos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum aluno cadastrado
                  </TableCell>
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
                    <TableCell>{a.aluno_turma || "—"}</TableCell>
                    <TableCell>{statusBadge(a.status)}</TableCell>
                    <TableCell>
                      {a.comprovante_url ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowComprovanteDialog(a.comprovante_url)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.device_token ? (
                        <Badge variant="outline" className="text-xs">
                          {a.troca_dispositivo_solicitada ? "🔄 Troca solicitada" : "📱 Vinculado"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem dispositivo</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {a.status === "aguardando_aprovacao" && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600"
                              title="Aprovar"
                              onClick={() => updateStatusMutation.mutate({ id: a.id, status: "ativo" })}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-600"
                              title="Rejeitar"
                              onClick={() => updateStatusMutation.mutate({ id: a.id, status: "pendente" })}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {a.troca_dispositivo_solicitada && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-blue-600"
                            title="Liberar troca de dispositivo"
                            onClick={() => resetDeviceMutation.mutate(a.id)}
                          >
                            <Unlock className="h-4 w-4" />
                          </Button>
                        )}
                        {a.status === "ativo" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-600"
                            title="Revogar acesso"
                            onClick={() => updateStatusMutation.mutate({ id: a.id, status: "bloqueado" })}
                          >
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
              <Label>Nome *</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Nome do aluno" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={formTelefone} onChange={(e) => setFormTelefone(e.target.value)} placeholder="11999999999" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="aluno@email.com" type="email" />
            </div>
            <div>
              <Label>Turma</Label>
              <Input value={formTurma} onChange={(e) => setFormTurma(e.target.value)} placeholder="Ex: Jovens" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                addAlunoMutation.mutate({ nome: formNome, telefone: formTelefone, email: formEmail, turma: formTurma })
              }
              disabled={!formNome || addAlunoMutation.isPending}
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
            <DialogDescription>
              Formato: nome, telefone, email, turma
            </DialogDescription>
          </DialogHeader>
          {csvErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded p-3 text-sm space-y-1">
              {csvErrors.map((err, i) => (
                <p key={i} className="text-destructive">{err}</p>
              ))}
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
            <Button variant="outline" onClick={() => { setShowCsvDialog(false); setCsvData([]); setCsvErrors([]); }}>
              Cancelar
            </Button>
            <Button onClick={importCsv} disabled={csvData.length === 0}>
              Importar {csvData.length} aluno(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comprovante Viewer Dialog */}
      <Dialog open={!!showComprovanteDialog} onOpenChange={() => setShowComprovanteDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Comprovante de Pagamento</DialogTitle>
          </DialogHeader>
          {showComprovanteDialog && (
            <img
              src={showComprovanteDialog}
              alt="Comprovante"
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
