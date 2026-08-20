import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Upload,
  ArrowLeft,
  Copy,
  Download,
  Users,
  Eye,
  TrendingUp,
} from "lucide-react";

type CampoExtra = {
  key: string;
  label: string;
  type: "texto" | "numero" | "telefone" | "email" | "selecao";
  required: boolean;
  options?: string[];
};

const TIPOS: { value: CampoExtra["type"]; label: string }[] = [
  { value: "texto", label: "Texto" },
  { value: "numero", label: "Número" },
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "selecao", label: "Seleção" },
];

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const emptyForm = {
  nome: "",
  slug: "",
  descricao: "",
  banner_url: "",
  cor_primaria: "#1d4ed8",
  texto_botao_cta: "Quero me inscrever",
  data_inicio: "",
  data_fim: "",
  ativo: true,
  campos_extra: [] as CampoExtra[],
};

export default function EventosAdmin() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [busca, setBusca] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["admin-eventos-modulo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["admin-eventos-modulo-counts", eventos.map((e: any) => e.id).join(",")],
    enabled: eventos.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos_inscritos" as any)
        .select("evento_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      ((data as any[]) || []).forEach((r) => {
        map[r.evento_id] = (map[r.evento_id] || 0) + 1;
      });
      return map;
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (ev: any) => {
    setEditing(ev);
    setForm({
      nome: ev.nome ?? "",
      slug: ev.slug ?? "",
      descricao: ev.descricao ?? "",
      banner_url: ev.banner_url ?? "",
      cor_primaria: ev.cor_primaria ?? "#1d4ed8",
      texto_botao_cta: ev.texto_botao_cta ?? "Quero me inscrever",
      data_inicio: ev.data_inicio ? String(ev.data_inicio).slice(0, 16) : "",
      data_fim: ev.data_fim ? String(ev.data_fim).slice(0, 16) : "",
      ativo: ev.ativo ?? true,
      campos_extra: Array.isArray(ev.campos_extra) ? ev.campos_extra : [],
    });
    setDialogOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const safeName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `banner_${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from("eventos-banners")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data, error: signErr } = await supabase.storage
        .from("eventos-banners")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signErr) throw signErr;
      setForm((f) => ({ ...f, banner_url: data.signedUrl }));
      toast.success("Imagem enviada!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome do evento é obrigatório");
      const slug = (form.slug.trim() || slugify(form.nome)).trim();
      if (!slug) throw new Error("Slug inválido");
      const payload: any = {
        nome: form.nome.trim(),
        slug,
        descricao: form.descricao.trim() || null,
        banner_url: form.banner_url.trim() || null,
        cor_primaria: form.cor_primaria || null,
        texto_botao_cta: form.texto_botao_cta.trim() || null,
        data_inicio: form.data_inicio ? new Date(form.data_inicio).toISOString() : null,
        data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
        ativo: form.ativo,
        campos_extra: form.campos_extra,
      };
      if (editing?.id) {
        const { error } = await supabase
          .from("eventos" as any)
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        payload.created_by = userData.user?.id ?? null;
        const { error } = await supabase.from("eventos" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-eventos-modulo"] });
      toast.success(editing ? "Evento atualizado!" : "Evento criado!");
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("eventos" as any).update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-eventos-modulo"] }),
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });

  const deleteEvento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-eventos-modulo"] });
      toast.success("Evento excluído");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir"),
  });

  const addCampo = () =>
    setForm((f) => ({
      ...f,
      campos_extra: [
        ...f.campos_extra,
        { key: "", label: "", type: "texto", required: false } as CampoExtra,
      ],
    }));

  const updateCampo = (i: number, patch: Partial<CampoExtra>) =>
    setForm((f) => ({
      ...f,
      campos_extra: f.campos_extra.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));

  const removeCampo = (i: number) =>
    setForm((f) => ({ ...f, campos_extra: f.campos_extra.filter((_, idx) => idx !== i) }));

  if (selected) {
    return (
      <InscritosView
        evento={selected}
        onBack={() => {
          setSelected(null);
          setBusca("");
        }}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Eventos</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre eventos, gere páginas públicas de inscrição e exporte o público.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Novo evento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eventos cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : eventos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum evento cadastrado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Inscritos</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventos.map((ev: any) => (
                  <TableRow
                    key={ev.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(ev)}
                  >
                    <TableCell className="font-medium">{ev.nome}</TableCell>
                    <TableCell className="text-muted-foreground">/evento/{ev.slug}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!ev.ativo}
                          onCheckedChange={(v) => toggleAtivo.mutate({ id: ev.id, ativo: v })}
                        />
                        <Badge variant={ev.ativo ? "default" : "secondary"}>
                          {ev.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{counts[ev.id] || 0}</TableCell>
                    <TableCell>
                      {new Date(ev.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ev)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Excluir o evento "${ev.nome}"?`)) deleteEvento.mutate(ev.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar evento" : "Novo evento"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      nome: e.target.value,
                      slug: editing ? f.slug : slugify(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                />
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            <div>
              <Label>Banner</Label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Enviar imagem
                </Button>
                {form.banner_url && (
                  <img src={form.banner_url} alt="Banner do evento" className="h-12 rounded" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cor primária</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    className="w-16 p-1"
                    value={form.cor_primaria}
                    onChange={(e) => setForm((f) => ({ ...f, cor_primaria: e.target.value }))}
                  />
                  <Input
                    value={form.cor_primaria}
                    onChange={(e) => setForm((f) => ({ ...f, cor_primaria: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Texto do botão (CTA)</Label>
                <Input
                  value={form.texto_botao_cta}
                  onChange={(e) => setForm((f) => ({ ...f, texto_botao_cta: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data início</Label>
                <Input
                  type="datetime-local"
                  value={form.data_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
                />
              </div>
              <div>
                <Label>Data fim</Label>
                <Input
                  type="datetime-local"
                  value={form.data_fim}
                  onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
              />
              <Label>Evento ativo</Label>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Campos extras do formulário</Label>
                  <p className="text-xs text-muted-foreground">
                    Nome, WhatsApp, e-mail e cidade já são fixos na página pública.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addCampo}>
                  <Plus className="h-4 w-4 mr-1" /> Campo
                </Button>
              </div>

              {form.campos_extra.map((campo, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Rótulo"
                      value={campo.label}
                      onChange={(e) =>
                        updateCampo(i, {
                          label: e.target.value,
                          key: campo.key || slugify(e.target.value).replace(/-/g, "_"),
                        })
                      }
                    />
                    <Input
                      placeholder="chave"
                      value={campo.key}
                      onChange={(e) =>
                        updateCampo(i, { key: slugify(e.target.value).replace(/-/g, "_") })
                      }
                    />
                    <Select
                      value={campo.type}
                      onValueChange={(v) => updateCampo(i, { type: v as CampoExtra["type"] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {campo.type === "selecao" && (
                    <Input
                      placeholder="Opções separadas por vírgula"
                      value={(campo.options || []).join(", ")}
                      onChange={(e) =>
                        updateCampo(i, {
                          options: e.target.value
                            .split(",")
                            .map((o) => o.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={campo.required}
                        onCheckedChange={(v) => updateCampo(i, { required: v })}
                      />
                      <span className="text-sm">Obrigatório</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCampo(i)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InscritosView({ evento, onBack }: { evento: any; onBack: () => void }) {
  const [busca, setBusca] = useState("");

  const { data: inscritos = [], isLoading } = useQuery({
    queryKey: ["admin-eventos-inscritos", evento.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos_inscritos" as any)
        .select("*")
        .eq("evento_id", evento.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: views = 0 } = useQuery({
    queryKey: ["admin-eventos-views", evento.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("eventos_page_views" as any)
        .select("id", { count: "exact", head: true })
        .eq("evento_id", evento.id);
      if (error) throw error;
      return count || 0;
    },
  });

  const camposExtra: CampoExtra[] = Array.isArray(evento.campos_extra) ? evento.campos_extra : [];

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return inscritos;
    return inscritos.filter((i: any) => (i.nome || "").toLowerCase().includes(q));
  }, [inscritos, busca]);

  const conversao = views > 0 ? (inscritos.length / views) * 100 : 0;
  const publicUrl = `${window.location.origin}/evento/${evento.slug}`;

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["nome", "email", "telefone", "cidade"].join(","),
      ...inscritos.map((i: any) =>
        [esc(i.nome), esc(i.email), esc(i.whatsapp), esc(i.cidade)].join(",")
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `publico-${evento.slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{evento.nome}</h1>
            <p className="text-sm text-muted-foreground">Inscritos do evento</p>
          </div>
        </div>
        <Button onClick={exportCsv} disabled={inscritos.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar público (CSV)
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Link público:</span>
          <code className="text-sm bg-muted px-2 py-1 rounded">{publicUrl}</code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success("Link copiado!");
            }}
          >
            <Copy className="h-4 w-4 mr-1" /> Copiar
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Inscritos</p>
              <p className="text-2xl font-bold">{inscritos.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Visualizações</p>
              <p className="text-2xl font-bold">{views}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Conversão</p>
              <p className="text-2xl font-bold">{conversao.toFixed(1)}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Lista de inscritos</CardTitle>
          <Input
            placeholder="Buscar por nome..."
            className="max-w-xs"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum inscrito encontrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Cidade</TableHead>
                    {camposExtra.map((c) => (
                      <TableHead key={c.key}>{c.label || c.key}</TableHead>
                    ))}
                    <TableHead>Inscrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.nome}</TableCell>
                      <TableCell>{i.whatsapp}</TableCell>
                      <TableCell>{i.email}</TableCell>
                      <TableCell>{i.cidade}</TableCell>
                      {camposExtra.map((c) => (
                        <TableCell key={c.key}>
                          {String((i.respostas_extra || {})[c.key] ?? "")}
                        </TableCell>
                      ))}
                      <TableCell>
                        {new Date(i.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
