import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Search, Filter, Users, CreditCard, TrendingUp, Send, Ban, ShoppingCart } from "lucide-react";
import { format } from "date-fns";

// === UTILS ===
function generateCodigoPagamento() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// === TYPES ===
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

type ShopifyLicencaRow = {
  id: string;
  revista_id: string | null;
  shopify_order_id: string | null;
  shopify_order_number: string | null;
  nome_comprador: string | null;
  whatsapp: string;
  email: string | null;
  ativo: boolean;
  expira_em: string | null;
  created_at: string;
  primeiro_acesso_em: string | null;
  revistas_digitais?: { titulo: string; capa_url: string | null } | null;
};

// === SUB-COMPONENTS ===

function SuperintendentTab() {
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
      setFormClienteId(""); setFormPlano("trimestral"); setFormQtd("10");
      setFormExpira(""); setFormInicio(""); setFormRevistaAlunoId(""); setFormRevistaProfId("");
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
        <div />
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
                <p className="text-2xl font-bold">{licencas.filter((l) => l.status === "ativa").length}</p>
                <p className="text-sm text-muted-foreground">Licenças ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por igreja, email ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="ativa">Ativa</SelectItem>
            <SelectItem value="expirada">Expirada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPlano} onValueChange={setFilterPlano}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Plano" /></SelectTrigger>
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
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma licença encontrada</TableCell></TableRow>
              ) : (
                filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{l.cliente?.nome_igreja || "—"}</p>
                        <p className="text-xs text-muted-foreground">{l.cliente?.email_superintendente}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{l.codigo_pagamento || "—"}</Badge></TableCell>
                    <TableCell className="capitalize">{l.plano}</TableCell>
                    <TableCell>{l.quantidade_usada}/{l.quantidade_total}</TableCell>
                    <TableCell><Badge variant={statusColor(l.status)}>{l.status}</Badge></TableCell>
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
          <DialogHeader><DialogTitle>Adicionar Licença</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Igreja / Superintendente *</Label>
              <Select value={formClienteId} onValueChange={setFormClienteId}>
                <SelectTrigger><SelectValue placeholder="Selecione a igreja" /></SelectTrigger>
                <SelectContent>{clientes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome_igreja}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Revista Aluno</Label>
                <Select value={formRevistaAlunoId} onValueChange={setFormRevistaAlunoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{revistasAluno.map((r) => (<SelectItem key={r.id} value={r.id}>{r.titulo} ({r.trimestre})</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Revista Professor</Label>
                <Select value={formRevistaProfId} onValueChange={setFormRevistaProfId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{revistasProfessor.map((r) => (<SelectItem key={r.id} value={r.id}>{r.titulo} ({r.trimestre})</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Plano</Label>
                <Select value={formPlano} onValueChange={setFormPlano}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!formClienteId || !formExpira || addMutation.isPending}>
              {addMutation.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShopifyTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRevistaId, setFormRevistaId] = useState("");
  const [formExpira, setFormExpira] = useState("");

  const { data: licencas = [], isLoading } = useQuery({
    queryKey: ["admin-revista-licencas-shopify"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "revista-licencas-shopify-admin",
        { body: { action: "list" } }
      );
      if (error) throw error;
      return (data?.data || []) as ShopifyLicencaRow[];
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
      const digits = formWhatsapp.replace(/\D/g, "");
      const whatsappLimpo = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
      const { data, error } = await supabase.functions.invoke(
        "revista-licencas-shopify-admin",
        {
          body: {
            action: "insert",
            record: {
              whatsapp: whatsappLimpo,
              nome_comprador: formNome || null,
              email: formEmail || null,
              revista_id: formRevistaId || null,
              expira_em: formExpira || null,
              ativo: true,
            },
          },
        }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Licença adicionada");
      queryClient.invalidateQueries({ queryKey: ["admin-revista-licencas-shopify"] });
      setShowAddDialog(false);
      setFormWhatsapp(""); setFormNome(""); setFormEmail(""); setFormRevistaId(""); setFormExpira("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke(
        "revista-licencas-shopify-admin",
        { body: { action: "deactivate", id } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Licença desativada");
      queryClient.invalidateQueries({ queryKey: ["admin-revista-licencas-shopify"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke(
        "revista-licencas-shopify-admin",
        { body: { action: "resend", id } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => toast.success("Acesso reenviado por WhatsApp"),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = licencas.filter((l) => {
    if (filterAtivo === "ativo" && !l.ativo) return false;
    if (filterAtivo === "inativo" && l.ativo) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.nome_comprador?.toLowerCase().includes(s) ||
      l.whatsapp?.includes(s) ||
      l.email?.toLowerCase().includes(s) ||
      l.shopify_order_number?.includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{licencas.length}</p>
                  <p className="text-sm text-muted-foreground">Vendas totais</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{licencas.filter(l => l.ativo).length}</p>
                  <p className="text-sm text-muted-foreground">Ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="ml-4">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Manual
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, WhatsApp, email ou pedido..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterAtivo} onValueChange={setFilterAtivo}>
          <SelectTrigger className="w-[160px]"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Revista</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Logou</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada</TableCell></TableRow>
              ) : (
                filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.nome_comprador || "—"}</TableCell>
                    <TableCell>{l.whatsapp}</TableCell>
                    <TableCell className="text-sm">{l.email || "—"}</TableCell>
                    <TableCell>{l.revistas_digitais?.titulo || "—"}</TableCell>
                    <TableCell>
                      {l.shopify_order_number ? (
                        <Badge variant="outline" className="font-mono text-xs">#{l.shopify_order_number}</Badge>
                      ) : "Manual"}
                    </TableCell>
                    <TableCell><TableCell>{format(new Date(l.created_at), "dd/MM/yyyy 'às' HH:mm")}</TableCell></TableCell>
                    <TableCell>
                      <Badge variant={l.ativo ? "default" : "secondary"}>{l.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reenviar acesso"
                          onClick={() => resendMutation.mutate(l.id)}
                          disabled={!l.ativo || resendMutation.isPending}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        {l.ativo && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Desativar"
                            onClick={() => deactivateMutation.mutate(l.id)}
                            disabled={deactivateMutation.isPending}
                          >
                            <Ban className="h-4 w-4 text-destructive" />
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

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar Licença Manual</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>WhatsApp (com DDD) *</Label>
              <Input placeholder="11987654321" value={formWhatsapp} onChange={(e) => setFormWhatsapp(e.target.value)} />
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </div>
            <div>
              <Label>Revista</Label>
              <Select value={formRevistaId} onValueChange={setFormRevistaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{revistas.map((r) => (<SelectItem key={r.id} value={r.id}>{r.titulo}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de expiração (opcional)</Label>
              <Input type="date" value={formExpira} onChange={(e) => setFormExpira(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!formWhatsapp || addMutation.isPending}>
              {addMutation.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === MAIN COMPONENT ===
export default function RevistaLicencasAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Licenças Revista Virtual</h1>
        <p className="text-sm text-muted-foreground">Gerencie todas as licenças de revistas digitais</p>
      </div>

      <Tabs defaultValue="superintendente" className="w-full">
        <TabsList>
          <TabsTrigger value="superintendente">
            <CreditCard className="h-4 w-4 mr-2" />
            Licenças Superintendente
          </TabsTrigger>
          <TabsTrigger value="shopify">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Vendas Shopify
          </TabsTrigger>
        </TabsList>
        <TabsContent value="superintendente">
          <SuperintendentTab />
        </TabsContent>
        <TabsContent value="shopify">
          <ShopifyTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
