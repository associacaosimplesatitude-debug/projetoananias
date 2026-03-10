import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Pencil, Image, Trash2, Upload, Eye } from "lucide-react";
import { toast } from "sonner";

interface Revista {
  id: string;
  titulo: string;
  tipo: string;
  trimestre: string;
  capa_url: string | null;
  total_licoes: number;
  ativo: boolean;
  created_at: string;
}

interface Licao {
  id: string;
  revista_id: string;
  numero: number;
  titulo: string | null;
  paginas: string[];
  created_at: string;
}

export default function RevistasDigitais() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRevista, setEditingRevista] = useState<Revista | null>(null);
  const [managingLicoes, setManagingLicoes] = useState<Revista | null>(null);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("aluno");
  const [trimestre, setTrimestre] = useState("");
  const [capaUrl, setCapaUrl] = useState("");
  const [totalLicoes, setTotalLicoes] = useState(13);

  const { data: revistas, isLoading } = useQuery({
    queryKey: ["revistas-digitais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revistas_digitais")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Revista[];
    },
  });

  const { data: licoes } = useQuery({
    queryKey: ["revista-licoes", managingLicoes?.id],
    queryFn: async () => {
      if (!managingLicoes) return [];
      const { data, error } = await supabase
        .from("revista_licoes")
        .select("*")
        .eq("revista_id", managingLicoes.id)
        .order("numero");
      if (error) throw error;
      return data as Licao[];
    },
    enabled: !!managingLicoes,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { titulo, tipo, trimestre, capa_url: capaUrl || null, total_licoes: totalLicoes, ativo: true };
      if (editingRevista) {
        const { error } = await supabase.from("revistas_digitais").update(payload).eq("id", editingRevista.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("revistas_digitais").insert(payload).select().single();
        if (error) throw error;
        // Create empty licoes
        const licoes = Array.from({ length: totalLicoes }, (_, i) => ({
          revista_id: data.id,
          numero: i + 1,
          titulo: `Lição ${i + 1}`,
          paginas: [],
        }));
        const { error: err2 } = await supabase.from("revista_licoes").insert(licoes);
        if (err2) throw err2;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revistas-digitais"] });
      toast.success(editingRevista ? "Revista atualizada!" : "Revista criada com lições!");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("revistas_digitais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revistas-digitais"] });
      toast.success("Revista excluída!");
    },
  });

  const updateLicaoMutation = useMutation({
    mutationFn: async ({ id, titulo }: { id: string; titulo: string }) => {
      const { error } = await supabase.from("revista_licoes").update({ titulo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["revista-licoes"] }),
  });

  const uploadPagesMutation = useMutation({
    mutationFn: async ({ licaoId, files }: { licaoId: string; files: File[] }) => {
      const urls: string[] = [];
      for (const file of files) {
        const path = `${managingLicoes!.id}/${licaoId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("revistas").upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from("revistas").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      // Append to existing pages
      const existing = licoes?.find(l => l.id === licaoId)?.paginas || [];
      const { error } = await supabase
        .from("revista_licoes")
        .update({ paginas: [...existing, ...urls] })
        .eq("id", licaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revista-licoes"] });
      toast.success("Páginas enviadas!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingRevista(null);
    setTitulo("");
    setTipo("aluno");
    setTrimestre("");
    setCapaUrl("");
    setTotalLicoes(13);
  };

  const openEdit = (r: Revista) => {
    setEditingRevista(r);
    setTitulo(r.titulo);
    setTipo(r.tipo);
    setTrimestre(r.trimestre || "");
    setCapaUrl(r.capa_url || "");
    setTotalLicoes(r.total_licoes);
    setShowForm(true);
  };

  const handleFileUpload = (licaoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    uploadPagesMutation.mutate({ licaoId, files });
  };

  const removePageFromLicao = async (licaoId: string, pageUrl: string) => {
    const licao = licoes?.find(l => l.id === licaoId);
    if (!licao) return;
    const newPaginas = licao.paginas.filter(p => p !== pageUrl);
    const { error } = await supabase.from("revista_licoes").update({ paginas: newPaginas }).eq("id", licaoId);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["revista-licoes"] });
    toast.success("Página removida");
  };

  if (managingLicoes) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setManagingLicoes(null)} className="mb-2">← Voltar</Button>
            <h2 className="text-2xl font-bold">{managingLicoes.titulo}</h2>
            <p className="text-muted-foreground">Gestão das lições e páginas</p>
          </div>
        </div>

        <div className="space-y-4">
          {licoes?.map((licao) => (
            <Card key={licao.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Lição {licao.numero}</Badge>
                      <Badge variant={licao.paginas.length > 0 ? "default" : "secondary"}>
                        {licao.paginas.length > 0 ? `${licao.paginas.length} páginas` : "Sem páginas"}
                      </Badge>
                    </div>
                    <Input
                      defaultValue={licao.titulo || ""}
                      onBlur={(e) => {
                        if (e.target.value !== licao.titulo) {
                          updateLicaoMutation.mutate({ id: licao.id, titulo: e.target.value });
                        }
                      }}
                      placeholder="Título da lição"
                    />
                    {/* Pages preview */}
                    {licao.paginas.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto py-2">
                        {licao.paginas.map((url, i) => (
                          <div key={i} className="relative group shrink-0">
                            <img src={url} alt={`Página ${i + 1}`} className="h-24 w-auto rounded border" />
                            <button
                              onClick={() => removePageFromLicao(licao.id, url)}
                              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={`upload-${licao.id}`} className="cursor-pointer">
                      <div className="flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
                        <Upload className="h-4 w-4" /> Upload
                      </div>
                    </Label>
                    <input
                      id={`upload-${licao.id}`}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(licao.id, e)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Revistas Digitais
          </h2>
          <p className="text-muted-foreground">Gestão de revistas virtuais para EBD</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova Revista
        </Button>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) resetForm(); else setShowForm(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRevista ? "Editar Revista" : "Nova Revista"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Estudo Bíblico Nº 9" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aluno">Aluno</SelectItem>
                    <SelectItem value="professor">Professor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Trimestre</Label>
                <Input value={trimestre} onChange={(e) => setTrimestre(e.target.value)} placeholder="2026-T1" />
              </div>
            </div>
            <div>
              <Label>URL da Capa</Label>
              <Input value={capaUrl} onChange={(e) => setCapaUrl(e.target.value)} placeholder="https://..." />
            </div>
            {!editingRevista && (
              <div>
                <Label>Total de Lições</Label>
                <Input type="number" value={totalLicoes} onChange={(e) => setTotalLicoes(Number(e.target.value))} />
              </div>
            )}
            <Button onClick={() => saveMutation.mutate()} disabled={!titulo || saveMutation.isPending} className="w-full">
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Trimestre</TableHead>
                <TableHead>Lições</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : revistas?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma revista cadastrada</TableCell></TableRow>
              ) : revistas?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.titulo}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.tipo === "professor" ? "Professor" : "Aluno"}</Badge>
                  </TableCell>
                  <TableCell>{r.trimestre}</TableCell>
                  <TableCell>{r.total_licoes}</TableCell>
                  <TableCell>
                    <Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "Ativa" : "Inativa"}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setManagingLicoes(r)}><Image className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
