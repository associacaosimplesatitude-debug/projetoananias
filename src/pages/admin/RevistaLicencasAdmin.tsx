import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { ptBR } from "date-fns/locale";

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
  cliente?: { nome_igreja: string; email_superintendente: string | null } | null;
  revista?: { titulo: string } | null;
};

export default function RevistaLicencasAdmin() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlano, setFilterPlano] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Form state for manual add
  const [formClienteId, setFormClienteId] = useState("");
  const [formPlano, setFormPlano] = useState("trimestral");
  const [formQtd, setFormQtd] = useState("10");
  const [formExpira, setFormExpira] = useState("");

  const { data: licencas = [], isLoading } = useQuery({
    queryKey: ["admin-revista-licencas", filterStatus, filterPlano],
    queryFn: async () => {
      let q = supabase
        .from("revista_licencas")
        .select("*, cliente:ebd_clientes(nome_igreja, email_superintendente), revista:revistas_digitais(titulo)")
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

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("revista_licencas").insert({
        superintendente_id: formClienteId,
        plano: formPlano,
        quantidade_total: parseInt(formQtd),
        quantidade_usada: 0,
        status: "ativa",
        inicio_em: new Date().toISOString().split("T")[0],
        expira_em: formExpira,
      });
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
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = licencas.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.cliente?.nome_igreja?.toLowerCase().includes(s) ||
      l.cliente?.email_superintendente?.toLowerCase().includes(s)
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

      {/* KPI Cards */}
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por igreja ou email..."
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Igreja</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Licenças</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Expiração</TableHead>
                <TableHead>Revista</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                    <TableCell className="capitalize">{l.plano}</TableCell>
                    <TableCell>
                      {l.quantidade_usada}/{l.quantidade_total}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor(l.status)}>{l.status}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(l.inicio_em), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{format(new Date(l.expira_em), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{l.revista?.titulo || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add License Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Licença Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Igreja / Superintendente</Label>
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
            <div>
              <Label>Data de expiração</Label>
              <Input type="date" value={formExpira} onChange={(e) => setFormExpira(e.target.value)} />
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
