import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function RevistasAssinaturas() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [revistaId, setRevistaId] = useState("");
  const [plano, setPlano] = useState("trimestral");
  const [inicioEm, setInicioEm] = useState("");
  const [expiraEm, setExpiraEm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: assinaturas, isLoading } = useQuery({
    queryKey: ["revista-assinaturas", filterStatus],
    queryFn: async () => {
      let q = supabase
        .from("revista_assinaturas")
        .select("*, cliente:ebd_clientes(nome_igreja), revista:revistas_digitais(titulo)")
        .order("created_at", { ascending: false });
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["ebd-clientes-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ebd_clientes").select("id, nome_igreja").order("nome_igreja");
      if (error) throw error;
      return data;
    },
  });

  const { data: revistas } = useQuery({
    queryKey: ["revistas-digitais-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("revistas_digitais").select("id, titulo, tipo_conteudo").eq("ativo", true);
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("revista_assinaturas").insert({
        cliente_id: clienteId,
        revista_id: revistaId,
        plano,
        status: "ativa",
        inicio_em: inicioEm,
        expira_em: expiraEm,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revista-assinaturas"] });
      toast.success("Assinatura criada!");
      setShowForm(false);
      setClienteId(""); setRevistaId(""); setPlano("trimestral"); setInicioEm(""); setExpiraEm("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getStatusBadge = (status: string, expiraEm: string | null) => {
    if (status === "cancelada") return <Badge variant="destructive">Cancelada</Badge>;
    if (status === "expirada") return <Badge variant="secondary">Expirada</Badge>;
    if (expiraEm) {
      const days = Math.ceil((new Date(expiraEm).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days < 0) return <Badge variant="destructive">Expirada</Badge>;
      if (days <= 30) return <Badge className="bg-yellow-500">Expira em {days}d</Badge>;
    }
    return <Badge className="bg-green-600">Ativa</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" /> Assinaturas de Revistas
          </h2>
          <p className="text-muted-foreground">Gestão de assinaturas de revistas digitais</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova Assinatura
        </Button>
      </div>

      <div className="flex gap-2">
        {["all", "ativa", "expirada", "cancelada"].map((s) => (
          <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)}>
            {s === "all" ? "Todas" : s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Assinatura</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clientes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_igreja}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Revista</Label>
              <Select value={revistaId} onValueChange={setRevistaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a revista" /></SelectTrigger>
                <SelectContent>
                  {revistas?.map((r) => <SelectItem key={r.id} value={r.id}>{r.titulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plano</Label>
              <Select value={plano} onValueChange={setPlano}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Início</Label><Input type="date" value={inicioEm} onChange={(e) => setInicioEm(e.target.value)} /></div>
              <div><Label>Expiração</Label><Input type="date" value={expiraEm} onChange={(e) => setExpiraEm(e.target.value)} /></div>
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={!clienteId || !revistaId || createMutation.isPending} className="w-full">
              {createMutation.isPending ? "Salvando..." : "Criar Assinatura"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Revista</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Expiração</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : assinaturas?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma assinatura</TableCell></TableRow>
              ) : assinaturas?.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell>{a.cliente?.nome_igreja || "—"}</TableCell>
                  <TableCell>{a.revista?.titulo || "—"}</TableCell>
                  <TableCell className="capitalize">{a.plano}</TableCell>
                  <TableCell>{a.inicio_em ? format(new Date(a.inicio_em), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>{a.expira_em ? format(new Date(a.expira_em), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>{getStatusBadge(a.status, a.expira_em)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
