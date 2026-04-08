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
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Search, Filter, Users, CreditCard, TrendingUp, Send, Ban, ShoppingCart, Trophy, Monitor, WifiOff, BookOpen, Mail, Loader2, CheckCircle2, XCircle, MessageSquare, MailIcon, Clock, User, Phone, AtSign, BookMarked, ShieldCheck, Hash, CalendarDays } from "lucide-react";
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
  ultimo_acesso_em: string | null;
  versao_preferida: string | null;
  revistas_digitais?: { titulo: string; capa_url: string | null; tipo_conteudo?: string | null } | null;
};

type CardFilterType = "vendas" | "ativas" | "cg_digital" | "leitor_cg" | "livros" | null;

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

// === EDIT DRAWER ===
function formatWhatsappMask(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function LicencaEditDrawer({ licenca, open, onClose, onSaved }: {
  licenca: ShopifyLicencaRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editNome, setEditNome] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAtivo, setEditAtivo] = useState(true);

  const licId = licenca?.id;
  const [prevId, setPrevId] = useState<string | null>(null);
  if (licId && licId !== prevId) {
    setPrevId(licId);
    setEditNome(licenca?.nome_comprador || "");
    setEditWhatsapp(formatWhatsappMask(licenca?.whatsapp || ""));
    setEditEmail(licenca?.email || "");
    setEditAtivo(licenca?.ativo ?? true);
  }

  const { data: whatsappLogs = [] } = useQuery({
    queryKey: ["licenca-whatsapp-logs", licenca?.whatsapp],
    enabled: !!licenca?.whatsapp && open,
    queryFn: async () => {
      const phone = licenca!.whatsapp.replace(/\D/g, "");
      const phone8 = phone.slice(-8);
      const phone55 = phone.startsWith("55") ? phone : `55${phone}`;
      const { data } = await supabase
        .from("whatsapp_mensagens")
        .select("id, created_at, status, tipo_mensagem")
        .or(`telefone.like.%${phone}%,telefone.like.%${phone55}%,telefone.like.%${phone8}%`)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const { data: emailLogs = [] } = useQuery({
    queryKey: ["licenca-email-logs", licenca?.email],
    enabled: !!licenca?.email && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("ebd_email_logs")
        .select("id, created_at, status, assunto")
        .eq("destinatario", licenca!.email!)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "revista-licencas-shopify-admin",
        {
          body: {
            action: "update",
            id: licenca!.id,
            nome_comprador: editNome,
            whatsapp: editWhatsapp.replace(/\D/g, ""),
            email: editEmail,
            ativo: editAtivo,
          },
        }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Licença atualizada");
      onSaved();
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
    onSuccess: () => toast.success("Acesso reenviado com sucesso"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!licenca) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Detalhes da Licença
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="space-y-6">
            {/* SEÇÃO 1 — Dados editáveis */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados do cliente</h3>
              <div className="space-y-3">
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5"><User className="h-3.5 w-3.5" />Nome completo</Label>
                  <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5"><Phone className="h-3.5 w-3.5" />WhatsApp</Label>
                  <Input value={editWhatsapp} onChange={(e) => setEditWhatsapp(formatWhatsappMask(e.target.value))} placeholder="(11) 98765-4321" maxLength={15} />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5"><AtSign className="h-3.5 w-3.5" />Email</Label>
                  <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5"><BookMarked className="h-3.5 w-3.5" />Revista vinculada</Label>
                  <Input value={licenca.revistas_digitais?.titulo || "—"} disabled className="bg-muted" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Status</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{editAtivo ? "Ativo" : "Inativo"}</span>
                    <Switch checked={editAtivo} onCheckedChange={setEditAtivo} />
                  </div>
                </div>
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full">
                  {updateMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : "Salvar alterações"}
                </Button>
              </div>
            </div>

            <Separator />

            {/* SEÇÃO 2 — Histórico de acessos */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Histórico de acessos</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">Primeiro acesso</p>
                  <p className="font-medium">{licenca.primeiro_acesso_em ? format(new Date(licenca.primeiro_acesso_em), "dd/MM/yyyy HH:mm") : "Nunca acessou"}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">Último acesso</p>
                  <p className="font-medium">{licenca.ultimo_acesso_em ? format(new Date(licenca.ultimo_acesso_em), "dd/MM/yyyy HH:mm") : "Nunca acessou"}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">Versão preferida</p>
                  <Badge variant={licenca.versao_preferida === "leitor_cg" ? "secondary" : "default"}>
                    {licenca.versao_preferida === "leitor_cg" ? "Leitor CG" : "CG Digital"}
                  </Badge>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">Pedido Shopify</p>
                  <p className="font-medium font-mono">{licenca.shopify_order_number ? `#${licenca.shopify_order_number}` : "Manual"}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 col-span-2">
                  <p className="text-muted-foreground text-xs mb-1">Data da compra</p>
                  <p className="font-medium">{format(new Date(licenca.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* SEÇÃO 3 — Envio de acesso */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Envio de acesso</h3>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => resendMutation.mutate(licenca.id)} disabled={!licenca.ativo || resendMutation.isPending}>
                  {resendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  Reenviar via WhatsApp
                </Button>
                {licenca.email && (
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => resendMutation.mutate(licenca.id)} disabled={!licenca.ativo || resendMutation.isPending}>
                    {resendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailIcon className="h-4 w-4" />}
                    Reenviar via Email
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* SEÇÃO 4 — Log de envios */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Log de envios</h3>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" />WhatsApp</p>
                {whatsappLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic pl-5">Nenhum envio registrado</p>
                ) : (
                  <div className="space-y-1">
                    {whatsappLogs.map((log: any) => (
                      <div key={log.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/30">
                        {["enviado", "sent", "delivered"].includes(log.status) ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                        )}
                        <span className="text-muted-foreground">{format(new Date(log.created_at), "dd/MM HH:mm")}</span>
                        <span className="truncate">{log.tipo_mensagem || log.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><MailIcon className="h-3.5 w-3.5" />Email</p>
                {emailLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic pl-5">Nenhum envio registrado</p>
                ) : (
                  <div className="space-y-1">
                    {emailLogs.map((log: any) => (
                      <div key={log.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/30">
                        {["enviado", "sent", "delivered"].includes(log.status) ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                        )}
                        <span className="text-muted-foreground">{format(new Date(log.created_at), "dd/MM HH:mm")}</span>
                        <span className="truncate">{log.assunto || log.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// === SHOPIFY TAB ===
function ShopifyTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState("all");
  const [cardFilter, setCardFilter] = useState<CardFilterType>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRevistaId, setFormRevistaId] = useState("");
  const [formExpira, setFormExpira] = useState("");
  const [selectedLicenca, setSelectedLicenca] = useState<ShopifyLicencaRow | null>(null);

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

  const { data: versionCounts } = useQuery({
    queryKey: ["admin-revista-version-counts"],
    queryFn: async () => {
      const [cgRes, leitorRes, livrosRes] = await Promise.all([
        supabase.rpc("execute_readonly_query", {
          sql_query: `SELECT COUNT(DISTINCT whatsapp)::int as total FROM revista_licencas_shopify WHERE ativo = true AND (versao_preferida = 'cg_digital' OR versao_preferida IS NULL)`,
        }),
        supabase.rpc("execute_readonly_query", {
          sql_query: `SELECT COUNT(DISTINCT whatsapp)::int as total FROM revista_licencas_shopify WHERE ativo = true AND versao_preferida = 'leitor_cg'`,
        }),
        supabase.rpc("execute_readonly_query", {
          sql_query: `SELECT COUNT(*)::int as total FROM revista_licencas_shopify rls INNER JOIN revistas_digitais rd ON rd.id = rls.revista_id WHERE rls.ativo = true AND rd.tipo_conteudo = 'livro_digital'`,
        }),
      ]);
      return {
        cgDigital: (cgRes.data as any)?.[0]?.total ?? 0,
        leitorCg: (leitorRes.data as any)?.[0]?.total ?? 0,
        livros: (livrosRes.data as any)?.[0]?.total ?? 0,
      };
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

  const toggleCardFilter = (f: CardFilterType) => {
    setCardFilter(prev => prev === f ? null : (f === "vendas" || f === "ativas" ? null : f));
  };

  const cardStyle = (f: CardFilterType) =>
    cardFilter === f ? "cursor-pointer ring-2 ring-[#FFC107] border-[#FFC107]" : "cursor-pointer hover:shadow-md transition-shadow";

  const filtered = (() => {
    let result = licencas.filter((l) => {
      if (filterAtivo === "ativo" && !l.ativo) return false;
      if (filterAtivo === "inativo" && l.ativo) return false;

      if (cardFilter === "cg_digital") {
        if (!l.ativo) return false;
        if (l.versao_preferida !== "cg_digital" && l.versao_preferida !== null) return false;
      }
      if (cardFilter === "leitor_cg") {
        if (!l.ativo) return false;
        if (l.versao_preferida !== "leitor_cg") return false;
      }
      if (cardFilter === "livros") {
        if (!l.ativo) return false;
        const tipo = l.revistas_digitais?.tipo_conteudo;
        if (tipo !== "livro_digital") return false;
      }

      if (!search) return true;
      const s = search.toLowerCase();
      return (
        l.nome_comprador?.toLowerCase().includes(s) ||
        l.whatsapp?.includes(s) ||
        l.email?.toLowerCase().includes(s) ||
        l.shopify_order_number?.includes(s)
      );
    });

    // For version cards, deduplicate by whatsapp (keep most recent)
    if (cardFilter === "cg_digital" || cardFilter === "leitor_cg") {
      const seen = new Set<string>();
      result = result.filter((l) => {
        if (seen.has(l.whatsapp)) return false;
        seen.add(l.whatsapp);
        return true;
      });
    }

    return result;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1">
          <Card className={cardStyle("vendas")} onClick={() => toggleCardFilter("vendas")}>
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
          <Card className={cardStyle("ativas")} onClick={() => toggleCardFilter("ativas")}>
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
          <Card className={cardStyle("cg_digital")} onClick={() => toggleCardFilter("cg_digital")}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Monitor className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{versionCounts?.cgDigital ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">CG Digital</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={cardStyle("leitor_cg")} onClick={() => toggleCardFilter("leitor_cg")}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <WifiOff className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{versionCounts?.leitorCg ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">Leitor CG</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={cardStyle("livros")} onClick={() => toggleCardFilter("livros")}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{versionCounts?.livros ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">Livros</p>
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
                <TableHead>Último acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada</TableCell></TableRow>
              ) : (
                filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <button
                        className="font-medium text-primary hover:underline cursor-pointer text-left"
                        onClick={() => setSelectedLicenca(l)}
                      >
                        {l.nome_comprador || "—"}
                      </button>
                    </TableCell>
                    <TableCell>{l.whatsapp}</TableCell>
                    <TableCell className="text-sm">{l.email || "—"}</TableCell>
                    <TableCell>{l.revistas_digitais?.titulo || "—"}</TableCell>
                    <TableCell>
                      {l.shopify_order_number ? (
                        <Badge variant="outline" className="font-mono text-xs">#{l.shopify_order_number}</Badge>
                      ) : "Manual"}
                    </TableCell>
                    <TableCell>{format(new Date(l.created_at), "dd/MM/yyyy 'às' HH:mm")}</TableCell>
                    <TableCell className="text-xs">{l.primeiro_acesso_em ? format(new Date(l.primeiro_acesso_em), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                    <TableCell className="text-xs">{l.ultimo_acesso_em ? format(new Date(l.ultimo_acesso_em), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
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

      <LicencaEditDrawer
        licenca={selectedLicenca}
        open={!!selectedLicenca}
        onClose={() => setSelectedLicenca(null)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-revista-licencas-shopify"] });
          setSelectedLicenca(null);
        }}
      />

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

// === QUIZ RESPOSTAS TAB ===
type RankingRow = {
  id: string;
  whatsapp: string;
  revista_id: string | null;
  nome_comprador: string | null;
  total_pontos: number;
  total_quizzes: number;
  updated_at: string;
  revista_titulo?: string | null;
  nome_licenca?: string | null;
};

function QuizRespostasTab() {
  const [search, setSearch] = useState("");
  const [filterRevista, setFilterRevista] = useState("all");

  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ["admin-quiz-respostas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revista_ranking_publico")
        .select("*")
        .order("total_pontos", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];

      // Fetch revista titles
      const revistaIds = [...new Set(rows.map(r => r.revista_id).filter(Boolean))];
      let revistasMap: Record<string, string> = {};
      if (revistaIds.length > 0) {
        const { data: revs } = await supabase
          .from("revistas_digitais")
          .select("id, titulo")
          .in("id", revistaIds);
        if (revs) revs.forEach((r: any) => { revistasMap[r.id] = r.titulo; });
      }

      // Fetch buyer names from licencas
      const whatsapps = [...new Set(rows.map(r => r.whatsapp).filter(Boolean))];
      let nomesMap: Record<string, string> = {};
      if (whatsapps.length > 0) {
        const { data: lics } = await supabase
          .from("revista_licencas_shopify")
          .select("whatsapp, nome_comprador")
          .in("whatsapp", whatsapps);
        if (lics) lics.forEach((l: any) => {
          if (l.nome_comprador && !nomesMap[l.whatsapp]) nomesMap[l.whatsapp] = l.nome_comprador;
        });
      }

      return rows.map(r => ({
        ...r,
        revista_titulo: r.revista_id ? revistasMap[r.revista_id] || null : null,
        nome_licenca: nomesMap[r.whatsapp] || r.nome_comprador || null,
      })) as RankingRow[];
    },
  });

  const revistasDistintas = [...new Set(rankings.map(r => r.revista_titulo).filter(Boolean))] as string[];

  const filtered = rankings.filter((r) => {
    if (filterRevista !== "all" && r.revista_titulo !== filterRevista) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.nome_licenca?.toLowerCase().includes(s) ||
      r.nome_comprador?.toLowerCase().includes(s) ||
      r.whatsapp?.includes(s) ||
      r.revista_titulo?.toLowerCase().includes(s)
    );
  });

  const totalAlunos = new Set(rankings.map(r => r.whatsapp)).size;
  const totalQuizzes = rankings.reduce((sum, r) => sum + r.total_quizzes, 0);
  const mediaPontos = totalAlunos > 0
    ? Math.round(rankings.reduce((sum, r) => sum + r.total_pontos, 0) / totalAlunos)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalAlunos}</p>
                <p className="text-sm text-muted-foreground">Alunos que responderam</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalQuizzes}</p>
                <p className="text-sm text-muted-foreground">Quizzes respondidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{mediaPontos}</p>
                <p className="text-sm text-muted-foreground">Média de pontos por aluno</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, WhatsApp ou revista..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterRevista} onValueChange={setFilterRevista}>
          <SelectTrigger className="w-[220px]"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Revista" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as revistas</SelectItem>
            {revistasDistintas.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
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
                <TableHead>Revista</TableHead>
                <TableHead>Total de Pontos</TableHead>
                <TableHead>Quizzes Respondidos</TableHead>
                <TableHead>Última Atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma resposta encontrada</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nome_licenca || r.nome_comprador || "—"}</TableCell>
                    <TableCell>{r.whatsapp}</TableCell>
                    <TableCell>{r.revista_titulo || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="default" className="font-mono">{r.total_pontos} pts</Badge>
                    </TableCell>
                    <TableCell>{r.total_quizzes}</TableCell>
                    <TableCell>{r.updated_at ? format(new Date(r.updated_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// === MAIN COMPONENT ===
export default function RevistaLicencasAdmin() {
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [campaignSending, setCampaignSending] = useState(false);

  const handleCampaignClick = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("enviar-campanha-revista", {
        body: { dry_run: true },
      });
      if (error) throw error;
      setCampaignTotal(data.total);
      setShowCampaignModal(true);
    } catch (e: any) {
      toast.error("Erro ao verificar destinatários: " + e.message);
    }
  };

  const handleCampaignSend = async () => {
    setCampaignSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("enviar-campanha-revista", {
        body: { dry_run: false },
      });
      if (error) throw error;
      setShowCampaignModal(false);
      toast.success(`${data.enviados} emails enviados com sucesso${data.erros > 0 ? ` | ${data.erros} erros` : ""}`);
    } catch (e: any) {
      toast.error("Erro ao enviar campanha: " + e.message);
    } finally {
      setCampaignSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Licenças Revista Virtual</h1>
          <p className="text-sm text-muted-foreground">Gerencie todas as licenças de revistas digitais</p>
        </div>
        <Button onClick={handleCampaignClick} variant="outline" className="gap-2">
          <Mail className="h-4 w-4" />
          Enviar campanha por email
        </Button>
      </div>

      <Dialog open={showCampaignModal} onOpenChange={setShowCampaignModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar campanha por email</DialogTitle>
          </DialogHeader>
          {campaignSending ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Enviando emails... aguarde</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Serão enviados emails para <strong>{campaignTotal}</strong> destinatários únicos.
                <br />Deseja continuar?
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCampaignModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCampaignSend} className="gap-2">
                  <Send className="h-4 w-4" />
                  Enviar agora
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
          <TabsTrigger value="quiz">
            <Trophy className="h-4 w-4 mr-2" />
            Respostas Quiz
          </TabsTrigger>
        </TabsList>
        <TabsContent value="superintendente">
          <SuperintendentTab />
        </TabsContent>
        <TabsContent value="shopify">
          <ShopifyTab />
        </TabsContent>
        <TabsContent value="quiz">
          <QuizRespostasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
