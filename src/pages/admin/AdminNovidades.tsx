import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Sparkles, Upload, X, FileIcon, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const ALL_ROLES = [
  "admin", "client", "tesoureiro", "secretario", "gerente_ebd",
  "financeiro", "representante", "autor", "gerente_royalties", "gerente_sorteio",
];
const BUCKET = "system-news-attachments";

interface News {
  id: string;
  tipo: "nova_funcao" | "correcao";
  titulo: string;
  descricao_curta: string;
  descricao_completa: string;
  versao: string | null;
  data_publicacao: string;
  ativo: boolean;
  audience_type: "all" | "roles" | "users";
  audience_roles: string[] | null;
  audience_user_ids: string[] | null;
}

interface Anexo {
  id: string;
  news_id: string;
  nome_arquivo: string;
  storage_path: string;
  tamanho_bytes: number | null;
  mime_type: string | null;
}

function formatBytes(b: number | null) {
  if (!b) return "";
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export default function AdminNovidades() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [editing, setEditing] = useState<News | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<News | null>(null);

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["admin-system-news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_news")
        .select("*")
        .order("data_publicacao", { ascending: false });
      if (error) throw error;
      return (data || []) as News[];
    },
  });

  const filtered = useMemo(() => {
    return lista.filter((n) => {
      if (tipoFilter !== "all" && n.tipo !== tipoFilter) return false;
      if (search && !n.titulo.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [lista, search, tipoFilter]);

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("system_news").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-system-news"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("system_news").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-system-news"] });
      toast.success("Novidade desativada");
      setDeleteTarget(null);
    },
  });

  const hardDelete = useMutation({
    mutationFn: async (id: string) => {
      // Buscar e remover anexos do storage
      const { data: anexos } = await supabase
        .from("system_news_attachments")
        .select("storage_path")
        .eq("news_id", id);
      if (anexos && anexos.length > 0) {
        await supabase.storage.from(BUCKET).remove(anexos.map((a) => a.storage_path));
      }
      const { error } = await supabase.from("system_news").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-system-news"] });
      toast.success("Novidade excluída permanentemente");
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-emerald-600" />
            Novidades do Sistema
          </h1>
          <p className="text-sm text-muted-foreground">
            Publique novas funções e correções para os usuários.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova novidade
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="nova_funcao">Nova função</SelectItem>
            <SelectItem value="correcao">Correção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Versão</TableHead>
              <TableHead>Publicação</TableHead>
              <TableHead>Audiência</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma novidade encontrada.</TableCell></TableRow>
            ) : filtered.map((n) => (
              <TableRow key={n.id}>
                <TableCell>
                  <Badge variant="outline" className={n.tipo === "nova_funcao" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-amber-300 text-amber-700 bg-amber-50"}>
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
                  <Switch checked={n.ativo} onCheckedChange={(v) => toggleAtivo.mutate({ id: n.id, ativo: v })} />
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(n)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(n)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {(creating || editing) && (
        <NewsFormDialog
          open
          news={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-system-news"] })}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir novidade?</AlertDialogTitle>
            <AlertDialogDescription>
              Você pode <strong>desativar</strong> (mantém histórico) ou <strong>excluir permanentemente</strong> (remove tudo, incluindo anexos).
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
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =================== Form Dialog ===================
function NewsFormDialog({ open, news, onClose, onSaved }: {
  open: boolean; news: News | null; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const isEdit = !!news;
  const [tipo, setTipo] = useState<"nova_funcao" | "correcao">(news?.tipo || "nova_funcao");
  const [versao, setVersao] = useState(news?.versao || "");
  const [titulo, setTitulo] = useState(news?.titulo || "");
  const [descCurta, setDescCurta] = useState(news?.descricao_curta || "");
  const [descCompleta, setDescCompleta] = useState(news?.descricao_completa || "");
  const [dataPub, setDataPub] = useState(
    news?.data_publicacao ? new Date(news.data_publicacao).toISOString().slice(0, 16)
                          : new Date().toISOString().slice(0, 16)
  );
  const [ativo, setAtivo] = useState(news?.ativo ?? true);
  const [audienceType, setAudienceType] = useState<"all" | "roles" | "users">(news?.audience_type || "all");
  const [audienceRoles, setAudienceRoles] = useState<string[]>(news?.audience_roles || []);
  const [audienceUsers, setAudienceUsers] = useState<string>((news?.audience_user_ids || []).join(", "));
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: anexos = [], refetch: refetchAnexos } = useQuery({
    queryKey: ["news-attachments-edit", news?.id],
    queryFn: async () => {
      if (!news?.id) return [];
      const { data, error } = await supabase
        .from("system_news_attachments")
        .select("*").eq("news_id", news.id).order("created_at");
      if (error) throw error;
      return (data || []) as Anexo[];
    },
    enabled: !!news?.id,
  });

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const valid = arr.filter((f) => {
      if (f.size > 50 * 1024 * 1024) {
        toast.error(`${f.name}: excede 50MB`);
        return false;
      }
      return true;
    });
    setPendingFiles((p) => [...p, ...valid]);
  };

  const removeExistingAnexo = async (a: Anexo) => {
    await supabase.storage.from(BUCKET).remove([a.storage_path]);
    await supabase.from("system_news_attachments").delete().eq("id", a.id);
    refetchAnexos();
    toast.success("Anexo removido");
  };

  const sanitizeFilename = (name: string) =>
    name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");

  const uploadFiles = async (newsId: string, files: File[]) => {
    for (const file of files) {
      const safeName = sanitizeFilename(file.name);
      const path = `${newsId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("system_news_attachments").insert({
        news_id: newsId,
        nome_arquivo: file.name,
        storage_path: path,
        mime_type: file.type,
        tamanho_bytes: file.size,
      });
      if (insErr) throw insErr;
    }
  };

  const handleSubmit = async () => {
    // validações simples
    if (!titulo.trim() || titulo.length > 120) return toast.error("Título obrigatório (máx 120)");
    if (!descCurta.trim() || descCurta.length > 200) return toast.error("Descrição curta obrigatória (máx 200)");
    if (!descCompleta.trim()) return toast.error("Descrição completa obrigatória");

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
      const payload = {
        tipo, titulo, descricao_curta: descCurta, descricao_completa: descCompleta,
        versao: versao || null,
        data_publicacao: new Date(dataPub).toISOString(),
        ativo, audience_type: audienceType,
        audience_roles: roles,
        audience_user_ids: userIds,
      };

      let savedId = news?.id;
      if (isEdit && news) {
        const { error } = await supabase.from("system_news").update(payload).eq("id", news.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("system_news")
          .insert({ ...payload, criado_por: user?.id || null })
          .select("id").single();
        if (error) throw error;
        savedId = data.id;
      }

      if (pendingFiles.length > 0 && savedId) {
        await uploadFiles(savedId, pendingFiles);
      }

      toast.success(isEdit ? "Novidade atualizada" : "Novidade publicada");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar novidade" : "Nova novidade"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
            <Label>Descrição completa * <span className="text-xs text-muted-foreground">(suporta markdown)</span></Label>
            <Textarea value={descCompleta} onChange={(e) => setDescCompleta(e.target.value)} rows={8} className="font-mono text-sm" />
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
              <div className="flex items-center gap-2">
                <RadioGroupItem value="all" id="aud-all" /><Label htmlFor="aud-all">Todos os usuários</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="roles" id="aud-roles" /><Label htmlFor="aud-roles">Por papel/role</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="users" id="aud-users" /><Label htmlFor="aud-users">Usuários específicos</Label>
              </div>
            </RadioGroup>

            {audienceType === "roles" && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border rounded-md">
                {ALL_ROLES.map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    <Checkbox
                      id={`role-${r}`}
                      checked={audienceRoles.includes(r)}
                      onCheckedChange={(c) => {
                        setAudienceRoles((prev) => c ? [...prev, r] : prev.filter((x) => x !== r));
                      }}
                    />
                    <Label htmlFor={`role-${r}`} className="text-sm">{r}</Label>
                  </div>
                ))}
              </div>
            )}

            {audienceType === "users" && (
              <div className="mt-3">
                <Textarea
                  value={audienceUsers}
                  onChange={(e) => setAudienceUsers(e.target.value)}
                  placeholder="UUIDs de usuários separados por vírgula"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">Cole os user_ids separados por vírgula.</p>
              </div>
            )}
          </div>

          <div>
            <Label>Anexos</Label>
            <div
              className="mt-2 border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:bg-muted/30"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleAddFiles(e.dataTransfer.files); }}
            >
              <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-sm mt-1">Arraste arquivos ou clique. Máx 50MB cada.</p>
              <input
                ref={fileRef} type="file" multiple className="hidden"
                onChange={(e) => handleAddFiles(e.target.files)}
              />
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
