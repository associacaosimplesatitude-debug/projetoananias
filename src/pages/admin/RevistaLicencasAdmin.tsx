import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, Filter, Users, CreditCard, TrendingUp } from "lucide-react";
import { format } from "date-fns";

function generateCodigoPagamento() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

type LicencaRow = {
  id: string;
  plano: string;
  quantidade_total: number;
  quantidade_usada: number;
  status: string;
  inicio_em: string;
  expira_em: string;
  created_at: string;
  superintendente_id: string;
  revista_id: string | null;
  revista_aluno_id: string | null;
  revista_professor_id: string | null;
  pacote_id: string | null;
  chave_pix: string | null;
  codigo_pagamento: string | null;
  cliente?: { nome_igreja: string; email_superintendente: string | null } | null;
  revista_aluno?: { titulo: string } | null;
  revista_professor?: { titulo: string } | null;
};

export default function RevistaLicencasAdmin() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlano, setFilterPlano] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [formClienteId, setFormClienteId] = useState("");
  const [formPlano, setFormPlano] = useState("trimestral");
  const [formQtd, setFormQtd] = useState("10");
  const [formExpira, setFormExpira] = useState("");
  const [formInicio, setFormInicio] = useState("");
  const [formRevistaAlunoId, setFormRevistaAlunoId] = useState("");
  const [formRevistaProfId, setFormRevistaProfId] = useState("");

  const { data: licencas = [], isLoading } = useQuery({
    queryKey: ["admin-revista-licencas", filterStatus, filterPlano],
    queryFn: async () => {
      let q = supabase
        .from("revista_licencas")
        .select("*, cliente:ebd_clientes(nome_igreja, email_superintendente), revista_aluno:revistas_digitais!revista_licencas_revista_aluno_id_fkey(titulo), revista_professor:revistas_digitais!revista_licencas_revista_professor_id_fkey(titulo)")
        .order("created_at", { ascending: false });
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      if (filterPlano !== "all") q = q.eq("plano", filterPlano);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as LicencaRow[];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["ebd-clientes-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja")
        .eq("status_ativacao_ebd", true)
        .order("nome_igreja");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: revistas = [] } = useQuery({
    queryKey: ["revistas-digitais-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revistas_digitais")
        .select("id, titulo, tipo, trimestre")
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const codigo = generateCodigoPagamento();
      const { error } = await supabase.from("revista_licencas").insert({
        superintendente_id: formClienteId,
        plano: formPlano,
        quantidade_total: parseInt(formQtd),
        quantidade_usada: 1,
        status: "ativa",
        inicio_em: formInicio || new Date().toISOString().split("T")[0],
        expira_em: formExpira,
        revista_aluno_id: formRevistaAlunoId || null,
        revista_professor_id: formRevistaProfId || null,
        codigo_pagamento: codigo,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Licença adicionada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-revista-licencas"] });
      setShowAddDialog(false);
      setFormClienteId("");
      setFormPlano("trimestral");
      setFormQtd("10");
      setFormExpira("");
      setFormInicio("");
      setFormRevistaAlunoId("");
      setFormRevistaProfId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = licencas.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.cliente?.nome_igreja?.toLowerCase().includes(s) ||
      l.cliente?.email_superintendente?.toLowerCase().includes(s) ||
      l.codigo_pagamento?.toLowerCase().includes(s)
    );
  });

  const totalAlunos = licencas.reduce((sum, l) => sum + l.quantidade_usada, 0);
  const totalLicencas = licencas.reduce((sum, l) => sum + l.quantidade_total, 0);

  const statusColor = (s: string) => {
    switch (s) {
      case "ativa": return "default";
      case "expirada": return "destructive";
      case "cancelada": return "secondary";
      default: return "outline";
    }
  };

  const revistasAluno = revistas.filter(r => r.tipo === "aluno");
  const revistasProfessor = revistas.filter(r => r.tipo === "professor");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Licenças Revista Virtual</h1>
          <p className="text-sm text-muted-foreground">Gerencie todas as licenças de revistas digitais</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Licença
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{licencas.length}</p>
                <p className="text-sm text-muted-foreground">Licenças totais</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalAlunos} / {totalLicencas}</p>
                <p className="text-sm text-muted-foreground">Alunos ativos / Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">
                  {licencas.filter((l) => l.status === "ativa").length}
                </p>
                <p className="text-sm text-muted-foreground">Licenças ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por igreja, email ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="ativa">Ativa</SelectItem>
            <SelectItem value="expirada">Expirada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPlano} onValueChange={setFilterPlano}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos planos</SelectItem>
            <SelectItem value="trimestral">Trimestral</SelectItem>
            <SelectItem value="semestral">Semestral</SelectItem>
            <SelectItem value="anual">Anual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Igreja</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Licenças</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Expiração</TableHead>
                <TableHead>Revista Aluno</TableHead>
                <TableHead>Revista Professor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma licença encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{l.cliente?.nome_igreja || "—"}</p>
                        <p className="text-xs text-muted-foreground">{l.cliente?.email_superintendente}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {l.codigo_pagamento || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{l.plano}</TableCell>
                    <TableCell>
                      {l.quantidade_usada}/{l.quantidade_total}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor(l.status)}>{l.status}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(l.inicio_em), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{format(new Date(l.expira_em), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{l.revista_aluno?.titulo || "—"}</TableCell>
                    <TableCell>{l.revista_professor?.titulo || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Licença</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Igreja / Superintendente *</Label>
              <Select value={formClienteId} onValueChange={setFormClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a igreja" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_igreja}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Revista Aluno</Label>
                <Select value={formRevistaAlunoId} onValueChange={setFormRevistaAlunoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {revistasAluno.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.titulo} ({r.trimestre})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Revista Professor</Label>
                <Select value={formRevistaProfId} onValueChange={setFormRevistaProfId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {revistasProfessor.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.titulo} ({r.trimestre})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Plano</Label>
                <Select value={formPlano} onValueChange={setFormPlano}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantidade de licenças</Label>
                <Input type="number" value={formQtd} onChange={(e) => setFormQtd(e.target.value)} min="1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de início</Label>
                <Input type="date" value={formInicio} onChange={(e) => setFormInicio(e.target.value)} />
              </div>
              <div>
                <Label>Data de expiração *</Label>
                <Input type="date" value={formExpira} onChange={(e) => setFormExpira(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!formClienteId || !formExpira || addMutation.isPending}
            >
              {addMutation.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
