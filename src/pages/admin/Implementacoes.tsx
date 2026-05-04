import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Rocket, Plus, Pencil, Trash2, Upload, X, FileIcon, Sparkles, Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const BUCKET = "implementacoes-attachments";
const ALL_ROLES = ["admin", "client", "tesoureiro", "secretario", "gerente_ebd", "financeiro", "representante", "autor", "gerente_royalties", "gerente_sorteio"];
const CATEGORIAS = ["vendas", "ebd", "integracao", "admin", "financeiro", "whatsapp", "royalties"];

const categoryColors: Record<string, string> = {
  vendas: "bg-blue-100 text-blue-800",
  ebd: "bg-green-100 text-green-800",
  integracao: "bg-purple-100 text-purple-800",
  admin: "bg-orange-100 text-orange-800",
  financeiro: "bg-yellow-100 text-yellow-800",
  whatsapp: "bg-emerald-100 text-emerald-800",
  royalties: "bg-pink-100 text-pink-800",
};

interface Implementacao {
  id: string;
  tipo: "nova_funcao" | "correcao";
  titulo: string;
  descricao_curta: string;
  descricao_completa: string | null;
  versao: string | null;
  categoria: string | null;
  data_publicacao: string;
  ativo: boolean;
  audience_type: "all" | "roles" | "users";
  audience_roles: string[] | null;
  audience_user_ids: string[] | null;
  created_at: string;
}

interface Anexo {
  id: string;
  implementacao_id: string;
  nome_arquivo: string;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
}

function formatBytes(b: number | null) {
  if (!b) return "";
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export default function Implementacoes() {
  const qc = useQueryClient();
  const { role } = useUserRole();
  const isAdmin = role === "admin";
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Implementacao | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Implementacao | null>(null);

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["implementacoes-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("implementacoes")
        .select("*")
        .order("data_publicacao", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Implementacao[];
    },
  });

  const ativas = useMemo(() => lista.filter((i) => i.ativo), [lista]);

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("implementacoes").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implementacoes-admin"] });
      qc.invalidateQueries({ queryKey: ["implementacoes-feed"] });
      toast.success("Implementação desativada");
      setDeleteTarget(null);
    },
  });

  const hardDelete = useMutation({
    mutationFn: async (id: string) => {
      const { data: anexos } = await (supabase as any)
        .from("implementacoes_attachments")
        .select("storage_path")
        .eq("implementacao_id", id);
      if (anexos && anexos.length > 0) {
        await supabase.storage.from(BUCKET).remove(anexos.map((a: any) => a.storage_path));
      }
      const { error } = await (supabase as any).from("implementacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implementacoes-admin"] });
      qc.invalidateQueries({ queryKey: ["implementacoes-feed"] });
      toast.success("Excluída permanentemente");
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Rocket className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Implementações</h1>
            <p className="text-muted-foreground text-sm">Histórico e gerenciamento de novidades do sistema</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreating(true)} size="lg" className="shadow-md">
            <Plus className="h-4 w-4 mr-2" /> Nova Implementação
          </Button>
        )}
      </div>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList>
          <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
          {isAdmin && <TabsTrigger value="gerenciar">Gerenciar</TabsTrigger>}
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Últimas Implementações</CardTitle>
              <CardDescription>Acompanhe as atualizações e novas funcionalidades do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <Skeleton className="h-10 w-24 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !ativas.length ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma implementação registrada.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-[5.5rem] top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-6">
                    {ativas.map((impl, index) => {
                      const prevDate = index > 0 ? ativas[index - 1].data_publicacao : null;
                      const showDate = impl.data_publicacao !== prevDate;
                      return (
                        <div key={impl.id} className="flex gap-4 items-start relative">
                          <div className="w-20 flex-shrink-0 text-right">
                            {showDate && (
                              <div className="text-xs font-medium text-muted-foreground">
                                {format(new Date(impl.data_publicacao), "dd MMM yyyy", { locale: ptBR })}
                              </div>
                            )}
                          </div>
                          <div className="relative z-10 flex-shrink-0 mt-1.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
                          </div>
                          <div className="flex-1 pb-2">
                            <div className="flex items-start gap-2 flex-wrap">
                              <span className="font-medium text-sm">{impl.titulo}</span>
                              {impl.categoria && (
                                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${categoryColors[impl.categoria] || ""}`}>
                                  {impl.categoria}
                                </Badge>
                              )}
                            </div>
                            {impl.descricao_curta && (
                              <p className="text-xs text-muted-foreground mt-1">{impl.descricao_curta}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="gerenciar">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Versão</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Audiência</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lista.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma implementação.</TableCell></TableRow>
                    ) : lista.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell>
                          <Badge variant="outline" className={n.tipo === "nova_funcao" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-amber-300 text-amber-700 bg-amber-50"}>
                            {n.tipo === "nova_funcao" ? <Sparkles className="h-3 w-3 mr-1" /> : <Wrench className="h-3 w-3 mr-1" />}
                            {n.tipo === "nova_funcao" ? "Nova função" : "Correção"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium max-w-md truncate">{n.titulo}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{n.versao || "—"}</TableCell>
                        <TableCell className="text-sm">{new Date(n.data_publicacao).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-sm">
                          {n.audience_type === "all" ? "Todos" :
                            n.audience_type === "roles" ? `${n.audience_roles?.length || 0} papel(éis)` :
                            `${n.audience_user_ids?.length || 0} usuário(s)`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={n.ativo ? "default" : "secondary"}>{n.ativo ? "Sim" : "Não"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(n)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(n)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {(creating || editing) && (
        <ImplementacaoFormDialog
          open
          impl={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["implementacoes-admin"] });
            qc.invalidateQueries({ queryKey: ["implementacoes-feed"] });
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir implementação?</AlertDialogTitle>
            <AlertDialogDescription>
              Você pode <strong>desativar</strong> (mantém histórico) ou <strong>excluir permanentemente</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => deleteTarget && softDelete.mutate(deleteTarget.id)} disabled={softDelete.isPending}>
              Apenas desativar
            </Button>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && hardDelete.mutate(deleteTarget.id)}
              disabled={hardDelete.isPending}
            >Excluir permanentemente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ImplementacaoFormDialog({ open, impl, onClose, onSaved }: {
  open: boolean; impl: Implementacao | null; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const isEdit = !!impl;
  const [tipo, setTipo] = useState<"nova_funcao" | "correcao">(impl?.tipo || "nova_funcao");
  const [categoria, setCategoria] = useState(impl?.categoria || "");
  const [versao, setVersao] = useState(impl?.versao || "");
  const [titulo, setTitulo] = useState(impl?.titulo || "");
  const [descCurta, setDescCurta] = useState(impl?.descricao_curta || "");
  const [descCompleta, setDescCompleta] = useState(impl?.descricao_completa || "");
  const [dataPub, setDataPub] = useState(
    impl?.data_publicacao ? new Date(impl.data_publicacao).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [ativo, setAtivo] = useState(impl?.ativo ?? true);
  const [audienceType, setAudienceType] = useState<"all" | "roles" | "users">(impl?.audience_type || "all");
  const [audienceRoles, setAudienceRoles] = useState<string[]>(impl?.audience_roles || []);
  const [audienceUserIds, setAudienceUserIds] = useState<string[]>(impl?.audience_user_ids || []);
  const [userSearch, setUserSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: anexos = [], refetch: refetchAnexos } = useQuery({
    queryKey: ["impl-attach-edit", impl?.id],
    queryFn: async () => {
      if (!impl?.id) return [];
      const { data, error } = await (supabase as any)
        .from("implementacoes_attachments").select("*").eq("implementacao_id", impl.id).order("created_at");
      if (error) throw error;
      return (data || []) as Anexo[];
    },
    enabled: !!impl?.id,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["impl-profiles-picker"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; full_name: string | null; email: string }[];
    },
    enabled: audienceType === "users",
    staleTime: 5 * 60_000,
  });

  const filteredProfiles = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (p.full_name || "").toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
    );
  }, [profiles, userSearch]);

  const profilesById = useMemo(() => {
    const m = new Map<string, { id: string; full_name: string | null; email: string }>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter((f) => {
      if (f.size > 50 * 1024 * 1024) { toast.error(`${f.name}: excede 50MB`); return false; }
      return true;
    });
    setPendingFiles((p) => [...p, ...valid]);
  };

  const removeExistingAnexo = async (a: Anexo) => {
    await supabase.storage.from(BUCKET).remove([a.storage_path]);
    await (supabase as any).from("implementacoes_attachments").delete().eq("id", a.id);
    refetchAnexos();
    toast.success("Anexo removido");
  };

  const sanitizeFilename = (name: string) =>
    name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");

  const uploadFiles = async (implId: string, files: File[]) => {
    for (const file of files) {
      const path = `${implId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await (supabase as any).from("implementacoes_attachments").insert({
        implementacao_id: implId, nome_arquivo: file.name, storage_path: path,
        mime_type: file.type, tamanho_bytes: file.size,
      });
      if (insErr) throw insErr;
    }
  };

  const handleSubmit = async () => {
    if (!titulo.trim() || titulo.length > 120) return toast.error("Título obrigatório (máx 120)");
    if (!descCurta.trim() || descCurta.length > 200) return toast.error("Descrição curta obrigatória (máx 200)");

    let userIds: string[] | null = null;
    if (audienceType === "users") {
      userIds = audienceUsers.split(",").map((s) => s.trim()).filter(Boolean);
      if (userIds.length === 0) return toast.error("Informe ao menos 1 user_id");
    }
    let roles: string[] | null = null;
    if (audienceType === "roles") {
      if (audienceRoles.length === 0) return toast.error("Selecione ao menos 1 papel");
      roles = audienceRoles;
    }

    setSaving(true);
    try {
      const payload: any = {
        tipo, titulo, categoria: categoria || null,
        descricao_curta: descCurta,
        descricao_completa: descCompleta || null,
        versao: versao || null,
        data_publicacao: new Date(dataPub).toISOString(),
        ativo, audience_type: audienceType,
        audience_roles: roles, audience_user_ids: userIds,
      };

      let savedId = impl?.id;
      if (isEdit && impl) {
        const { error } = await (supabase as any).from("implementacoes").update(payload).eq("id", impl.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("implementacoes")
          .insert({ ...payload, criado_por: user?.id || null })
          .select("id").single();
        if (error) throw error;
        savedId = data.id;
      }
      if (pendingFiles.length > 0 && savedId) await uploadFiles(savedId, pendingFiles);

      toast.success(isEdit ? "Implementação atualizada" : "Implementação publicada");
      onSaved(); onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar implementação" : "Nova implementação"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nova_funcao">Nova função</SelectItem>
                  <SelectItem value="correcao">Correção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoria || "__none"} onValueChange={(v) => setCategoria(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Versão</Label>
              <Input value={versao} onChange={(e) => setVersao(e.target.value)} placeholder="v2.4.1" />
            </div>
          </div>

          <div>
            <Label>Título * <span className="text-xs text-muted-foreground">({titulo.length}/120)</span></Label>
            <Input value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div>
            <Label>Descrição curta * <span className="text-xs text-muted-foreground">({descCurta.length}/200)</span></Label>
            <Textarea value={descCurta} maxLength={200} onChange={(e) => setDescCurta(e.target.value)} rows={2} />
          </div>

          <div>
            <Label>Descrição completa <span className="text-xs text-muted-foreground">(opcional, suporta markdown)</span></Label>
            <Textarea value={descCompleta} onChange={(e) => setDescCompleta(e.target.value)} rows={6} className="font-mono text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de publicação</Label>
              <Input type="datetime-local" value={dataPub} onChange={(e) => setDataPub(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Switch checked={ativo} onCheckedChange={setAtivo} id="ativo" />
              <Label htmlFor="ativo">Ativo</Label>
            </div>
          </div>

          <div>
            <Label>Audiência</Label>
            <RadioGroup value={audienceType} onValueChange={(v) => setAudienceType(v as any)} className="mt-2">
              <div className="flex items-center gap-2"><RadioGroupItem value="all" id="aud-all" /><Label htmlFor="aud-all">Todos os usuários</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="roles" id="aud-roles" /><Label htmlFor="aud-roles">Por papel/role</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="users" id="aud-users" /><Label htmlFor="aud-users">Usuários específicos</Label></div>
            </RadioGroup>

            {audienceType === "roles" && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border rounded-md">
                {ALL_ROLES.map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    <Checkbox id={`role-${r}`} checked={audienceRoles.includes(r)}
                      onCheckedChange={(c) => setAudienceRoles((prev) => c ? [...prev, r] : prev.filter((x) => x !== r))} />
                    <Label htmlFor={`role-${r}`} className="text-sm">{r}</Label>
                  </div>
                ))}
              </div>
            )}
            {audienceType === "users" && (
              <div className="mt-3">
                <Textarea value={audienceUsers} onChange={(e) => setAudienceUsers(e.target.value)}
                  placeholder="UUIDs de usuários separados por vírgula" rows={3} />
              </div>
            )}
          </div>

          <div>
            <Label>Anexos</Label>
            <div className="mt-2 border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:bg-muted/30"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleAddFiles(e.dataTransfer.files); }}>
              <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-sm mt-1">Arraste arquivos ou clique. Máx 50MB cada.</p>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleAddFiles(e.target.files)} />
            </div>
            <ul className="mt-2 space-y-1">
              {anexos.map((a) => (
                <li key={a.id} className="flex items-center justify-between border rounded px-2 py-1 text-sm">
                  <span className="flex items-center gap-2"><FileIcon className="h-4 w-4" />{a.nome_arquivo} <span className="text-xs text-muted-foreground">{formatBytes(a.tamanho_bytes)}</span></span>
                  <Button size="icon" variant="ghost" onClick={() => removeExistingAnexo(a)}><X className="h-3 w-3" /></Button>
                </li>
              ))}
              {pendingFiles.map((f, i) => (
                <li key={i} className="flex items-center justify-between border border-dashed rounded px-2 py-1 text-sm bg-muted/20">
                  <span className="flex items-center gap-2"><FileIcon className="h-4 w-4" />{f.name} <span className="text-xs text-muted-foreground">{formatBytes(f.size)} (novo)</span></span>
                  <Button size="icon" variant="ghost" onClick={() => setPendingFiles((p) => p.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
