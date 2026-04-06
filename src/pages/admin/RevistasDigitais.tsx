import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, BookOpen, Pencil, Image, Trash2, Upload, Eye, Save, ArrowLeft, GripVertical, ImagePlus, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";

interface Revista {
  id: string;
  titulo: string;
  tipo: string;
  trimestre: string;
  capa_url: string | null;
  total_licoes: number;
  ativo: boolean;
  descricao: string | null;
  autor: string | null;
  ano_publicacao: number | null;
  status_publicacao: string | null;
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

  // Form fields
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("aluno");
  const [trimestre, setTrimestre] = useState("");
  const [totalLicoes, setTotalLicoes] = useState<number | "">("");
  const [descricao, setDescricao] = useState("");
  const [autor, setAutor] = useState("");
  const [anoPublicacao, setAnoPublicacao] = useState(new Date().getFullYear());
  const [statusPublicacao, setStatusPublicacao] = useState("rascunho");
  const [tipoConteudo, setTipoConteudo] = useState("revista");

  // Capa upload
  const [capaUrl, setCapaUrl] = useState("");
  const [uploadingCapa, setUploadingCapa] = useState(false);
  const [dragOverCapa, setDragOverCapa] = useState(false);
  const capaInputRef = useRef<HTMLInputElement>(null);

  // PDF file info
  const [pdfFileInfo, setPdfFileInfo] = useState<{ name: string; size: number } | null>(null);

  // Drag state for lesson pages
  const [draggingPageIdx, setDraggingPageIdx] = useState<{ licaoId: string; idx: number } | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState<string | null>(null);
  
  const [uploadingPdfGlobal, setUploadingPdfGlobal] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const pdfGlobalInputRef = useRef<HTMLInputElement>(null);

  // PDF worker
  if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }

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

  // Upload capa to storage
  const uploadCapa = async (file: File) => {
    setUploadingCapa(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `capas/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("revistas").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("revistas").getPublicUrl(path);
      setCapaUrl(data.publicUrl);
      toast.success("Capa enviada!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingCapa(false);
    }
  };

  const handleCapaDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCapa(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) uploadCapa(file);
  }, []);

  const handleCapaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadCapa(file);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const isLivro = tipoConteudo === 'livro_digital';
      const payload = {
        titulo,
        tipo: isLivro ? 'aluno' : tipo,
        trimestre: isLivro ? null : trimestre,
        capa_url: capaUrl || null,
        total_licoes: isLivro ? 0 : (Number(totalLicoes) || 0),
        ativo: true,
        descricao: descricao || null,
        autor: autor || null,
        ano_publicacao: anoPublicacao,
        status_publicacao: statusPublicacao,
        tipo_conteudo: tipoConteudo,
        leitura_continua: isLivro,
      };
      if (editingRevista) {
        const { error } = await supabase.from("revistas_digitais").update(payload).eq("id", editingRevista.id);
        if (error) throw error;
        return editingRevista;
      } else {
        const { data, error } = await supabase.from("revistas_digitais").insert(payload).select().single();
        if (error) throw error;
        const numLicoes = Number(totalLicoes) || 0;
        const licoesArr = Array.from({ length: numLicoes }, (_, i) => ({
          revista_id: data.id,
          numero: i + 1,
          titulo: `Lição ${i + 1}`,
          paginas: [],
        }));
        const { error: err2 } = await supabase.from("revista_licoes").insert(licoesArr);
        if (err2) throw err2;
        return data as Revista;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["revistas-digitais"] });
      if (editingRevista) {
        toast.success("Revista atualizada!");
        resetForm();
      } else {
        toast.success("Revista criada! Agora adicione as páginas das lições.");
        resetForm();
        setManagingLicoes(data);
      }
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
    mutationFn: async ({ licaoId, licaoNumero, files }: { licaoId: string; licaoNumero: number; files: File[] }) => {
      // Buscar páginas atuais diretamente do banco (evita cache desatualizado)
      const { data: freshData } = await supabase
        .from("revista_licoes")
        .select("paginas")
        .eq("id", licaoId)
        .single();
      const existing = (freshData?.paginas as string[]) || [];

      const urls: string[] = [];
      let ordem = existing.length;
      for (const file of files) {
        ordem++;
        const ext = file.name.split(".").pop() || "jpg";
        // Nome único com timestamp para evitar sobrescrita acidental
        const path = `${managingLicoes!.id}/licao-${licaoNumero}/${Date.now()}-${ordem}.${ext}`;
        const { error } = await supabase.storage.from("revistas").upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from("revistas").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
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
    setTotalLicoes("");
    setDescricao("");
    setAutor("");
    setAnoPublicacao(new Date().getFullYear());
    setStatusPublicacao("rascunho");
    setTipoConteudo("revista");
    setPdfFileInfo(null);
  };

  const openEdit = (r: Revista) => {
    setEditingRevista(r);
    setTitulo(r.titulo);
    setTipo(r.tipo);
    setTrimestre(r.trimestre || "");
    setCapaUrl(r.capa_url || "");
    setTotalLicoes(r.total_licoes);
    setDescricao(r.descricao || "");
    setAutor(r.autor || "");
    setAnoPublicacao(r.ano_publicacao || new Date().getFullYear());
    setStatusPublicacao(r.status_publicacao || "rascunho");
    setTipoConteudo((r as any).tipo_conteudo || "revista");
    setShowForm(true);
  };

  const handleLicaoFileUpload = (licaoId: string, licaoNumero: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    uploadPagesMutation.mutate({ licaoId, licaoNumero, files });
  };

  const handleLicaoDrop = (licaoId: string, licaoNumero: number, e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length === 0) return;
    uploadPagesMutation.mutate({ licaoId, licaoNumero, files });
  };

  const handlePdfUpload = async (licaoId: string, licaoNumero: number, file: File) => {
    if (file.type !== "application/pdf") { toast.error("Selecione um arquivo PDF"); return; }
    setUploadingPdf(licaoId);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const urls: string[] = [];
      const existing = licoes?.find(l => l.id === licaoId)?.paginas || [];
      let ordem = existing.length;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/png", 0.9)
        );
        ordem++;
        const path = `${managingLicoes!.id}/licao-${licaoNumero}/${ordem}.png`;
        const { error } = await supabase.storage.from("revistas").upload(path, blob, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from("revistas").getPublicUrl(path);
        urls.push(data.publicUrl);
      }

      await supabase.from("revista_licoes").update({ paginas: [...existing, ...urls] }).eq("id", licaoId);
      queryClient.invalidateQueries({ queryKey: ["revista-licoes"] });
      toast.success(`${pdf.numPages} páginas extraídas do PDF!`);
    } catch (e: any) {
      toast.error("Erro ao processar PDF: " + e.message);
    } finally {
      setUploadingPdf(null);
    }
  };

  const handleGlobalPdfUpload = async (file: File, revistaId: string) => {
    if (file.type !== "application/pdf") { toast.error("Selecione um arquivo PDF"); return; }
    setUploadingPdfGlobal(true);
    setPdfProgress("Enviando PDF...");
    try {
      const path = `${revistaId}/completo.pdf`;
      const { error } = await supabase.storage.from("revistas").upload(path, file, { upsert: true, contentType: "application/pdf" });
      if (error) throw error;
      toast.success("PDF completo enviado com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao enviar PDF: " + e.message);
    } finally {
      setUploadingPdfGlobal(false);
      setPdfProgress("");
    }
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

  const reorderPages = async (licaoId: string, fromIdx: number, toIdx: number) => {
    const licao = licoes?.find(l => l.id === licaoId);
    if (!licao) return;
    const newPaginas = [...licao.paginas];
    const [moved] = newPaginas.splice(fromIdx, 1);
    newPaginas.splice(toIdx, 0, moved);
    const { error } = await supabase.from("revista_licoes").update({ paginas: newPaginas }).eq("id", licaoId);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["revista-licoes"] });
  };

  // Add lição mutation
  const addLicaoMutation = useMutation({
    mutationFn: async () => {
      if (!managingLicoes) return;
      const maxNumero = licoes?.length ? Math.max(...licoes.map(l => l.numero)) : 0;
      const newNumero = maxNumero + 1;
      const { error } = await supabase.from("revista_licoes").insert({
        revista_id: managingLicoes.id,
        numero: newNumero,
        titulo: `Lição ${newNumero}`,
        paginas: [],
      });
      if (error) throw error;
      // Update total_licoes
      const { error: err2 } = await supabase
        .from("revistas_digitais")
        .update({ total_licoes: (licoes?.length || 0) + 1 })
        .eq("id", managingLicoes.id);
      if (err2) throw err2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revista-licoes"] });
      queryClient.invalidateQueries({ queryKey: ["revistas-digitais"] });
      toast.success("Lição adicionada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Remove lição mutation
  const removeLicaoMutation = useMutation({
    mutationFn: async (licaoId: string) => {
      if (!managingLicoes) return;
      const { error } = await supabase.from("revista_licoes").delete().eq("id", licaoId);
      if (error) throw error;
      // Renumber remaining
      const remaining = (licoes || []).filter(l => l.id !== licaoId).sort((a, b) => a.numero - b.numero);
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].numero !== i + 1) {
          await supabase.from("revista_licoes").update({ numero: i + 1 }).eq("id", remaining[i].id);
        }
      }
      // Update total_licoes
      await supabase
        .from("revistas_digitais")
        .update({ total_licoes: remaining.length })
        .eq("id", managingLicoes.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revista-licoes"] });
      queryClient.invalidateQueries({ queryKey: ["revistas-digitais"] });
      toast.success("Lição removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusLabel = (s: string | null) => {
    switch (s) {
      case "publicada": return "Publicada";
      case "arquivada": return "Arquivada";
      default: return "Rascunho";
    }
  };

  const statusVariant = (s: string | null): "default" | "secondary" | "destructive" | "outline" => {
    switch (s) {
      case "publicada": return "default";
      case "arquivada": return "secondary";
      default: return "outline";
    }
  };

  // ============ GESTÃO DE LIÇÕES ============
  if (managingLicoes) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setManagingLicoes(null)} className="mb-2 gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <h2 className="text-2xl font-bold">{managingLicoes.titulo}</h2>
            <p className="text-muted-foreground">Gestão das lições e páginas</p>
          </div>
        </div>

        <div className="space-y-4">
          {licoes?.map((licao) => (
            <Card key={licao.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Lição {licao.numero}</Badge>
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
                      className="font-medium"
                    />

                    {/* Thumbnails das páginas com reordenação */}
                    {licao.paginas.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto py-2">
                        {licao.paginas.map((url, i) => (
                          <div
                            key={i}
                            className="relative group shrink-0 cursor-grab active:cursor-grabbing"
                            draggable
                            onDragStart={() => setDraggingPageIdx({ licaoId: licao.id, idx: i })}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (draggingPageIdx && draggingPageIdx.licaoId === licao.id && draggingPageIdx.idx !== i) {
                                reorderPages(licao.id, draggingPageIdx.idx, i);
                              }
                              setDraggingPageIdx(null);
                            }}
                          >
                            <div className="absolute top-0 left-0 bg-black/60 text-white text-[10px] px-1 rounded-br">
                              {i + 1}
                            </div>
                            <GripVertical className="absolute top-0 right-0 h-3 w-3 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <img src={url} alt={`Página ${i + 1}`} className="h-24 w-auto rounded border object-cover" />
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

                    {/* Drop zone para upload */}
                    <div
                      className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-3 text-center hover:border-orange-400 transition-colors cursor-pointer"
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={(e) => handleLicaoDrop(licao.id, licao.numero, e)}
                      onClick={() => document.getElementById(`upload-${licao.id}`)?.click()}
                    >
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <ImagePlus className="h-4 w-4" />
                        Arraste imagens ou clique para upload
                      </div>
                      <input
                        id={`upload-${licao.id}`}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLicaoFileUpload(licao.id, licao.numero, e)}
                      />
                    </div>

                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => window.open(`/ebd/revista/${managingLicoes.id}/licao/${licao.numero}`, "_blank")}
                    >
                      <Eye className="h-3 w-3" /> Visualizar
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 text-xs text-destructive hover:text-destructive"
                              disabled={licao.paginas.length > 0 || removeLicaoMutation.isPending}
                              onClick={() => {
                                if (confirm(`Tem certeza que deseja remover a Lição ${licao.numero}?`)) {
                                  removeLicaoMutation.mutate(licao.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {licao.paginas.length > 0 && (
                          <TooltipContent>
                            <p>Remova as páginas antes de excluir esta lição</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Botão adicionar lição */}
          <Button
            variant="outline"
            className="w-full border-dashed gap-2"
            onClick={() => addLicaoMutation.mutate()}
            disabled={addLicaoMutation.isPending}
          >
            {addLicaoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar lição
          </Button>
        </div>
      </div>
    );
  }

  // ============ LISTA DE REVISTAS ============
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Revistas Digitais
          </h2>
          <p className="text-muted-foreground">Gestão de revistas virtuais para EBD</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="mr-2 h-4 w-4" /> Nova Revista
        </Button>
      </div>

      {/* Form Dialog - Two Panel */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) resetForm(); else setShowForm(true); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRevista ? "Editar Revista" : "Nova Revista"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-6">
            {/* Painel esquerdo - Formulário */}
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Estudo Bíblico Nº 9" />
              </div>
              {tipoConteudo !== 'livro_digital' && (
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
              )}
              <div>
                <Label>Tipo de Conteúdo</Label>
                <Select value={tipoConteudo} onValueChange={setTipoConteudo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revista">Revista EBD</SelectItem>
                    <SelectItem value="livro_digital">Livro Digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descrição / Tema</Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva o tema ou conteúdo da revista..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Autor / Organizador</Label>
                  <Input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Nome do autor" />
                </div>
                <div>
                  <Label>Ano de Publicação</Label>
                  <Input type="number" value={anoPublicacao} onChange={(e) => setAnoPublicacao(Number(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={statusPublicacao} onValueChange={setStatusPublicacao}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="publicada">Publicada</SelectItem>
                      <SelectItem value="arquivada">Arquivada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!editingRevista && (
                  <div>
                    <Label>Total de Lições *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={totalLicoes}
                      onChange={(e) => setTotalLicoes(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Ex: 13"
                    />
                  </div>
                )}
              </div>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!titulo || saveMutation.isPending || (!editingRevista && (!totalLicoes || Number(totalLicoes) < 1))}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? "Salvando..." : "Salvar Revista"}
              </Button>
            </div>

            {/* Painel direito - Upload da Capa */}
            <div className="space-y-3">
              <Label>Capa da Revista</Label>
              <div
                className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors cursor-pointer ${
                  dragOverCapa ? "border-orange-400 bg-orange-50" : "border-muted-foreground/30 hover:border-orange-400"
                } ${capaUrl ? "p-2" : "p-6"}`}
                style={{ minHeight: capaUrl ? "auto" : "200px" }}
                onDragOver={(e) => { e.preventDefault(); setDragOverCapa(true); }}
                onDragLeave={() => setDragOverCapa(false)}
                onDrop={handleCapaDrop}
                onClick={() => capaInputRef.current?.click()}
              >
                {uploadingCapa ? (
                  <p className="text-sm text-muted-foreground">Enviando...</p>
                ) : capaUrl ? (
                  <img
                    src={capaUrl}
                    alt="Capa"
                    className="rounded-lg object-cover shadow-md"
                    style={{ width: 120, height: 160 }}
                  />
                ) : (
                  <div className="text-center space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground/50" />
                    <p className="text-xs text-muted-foreground">Arraste ou clique para enviar a capa</p>
                  </div>
                )}
              </div>
              <input
                ref={capaInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCapaFileChange}
              />
              {capaUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={(e) => { e.stopPropagation(); setCapaUrl(""); }}
                >
                  Remover capa
                </Button>
              )}

              {/* PDF Completo */}
              <div className="pt-2 border-t">
                <Label className="text-xs">PDF Completo</Label>
                <p className="text-[10px] text-muted-foreground mb-2">
                  {editingRevista 
                    ? "As páginas serão distribuídas entre as lições existentes" 
                    : "Após salvar, as páginas serão distribuídas automaticamente"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1 text-xs"
                  disabled={uploadingPdfGlobal || (!editingRevista && !saveMutation.data)}
                  onClick={(e) => { e.stopPropagation(); pdfGlobalInputRef.current?.click(); }}
                >
                  {uploadingPdfGlobal ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                  {uploadingPdfGlobal ? pdfProgress : "📄 Subir PDF"}
                </Button>
                <input
                  ref={pdfGlobalInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const revId = editingRevista?.id;
                    if (revId) {
                      handleGlobalPdfUpload(f, revId);
                    } else {
                      toast.error("Salve a revista primeiro");
                    }
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Capa</TableHead>
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
                <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : revistas?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma revista cadastrada</TableCell></TableRow>
              ) : revistas?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.capa_url ? (
                      <img src={r.capa_url} alt={r.titulo} className="w-10 h-14 rounded object-cover border" />
                    ) : (
                      <div className="w-10 h-14 rounded bg-muted flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{r.titulo}</span>
                      {r.autor && <p className="text-xs text-muted-foreground">{r.autor}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.tipo === "professor" ? "Professor" : "Aluno"}</Badge>
                  </TableCell>
                  <TableCell>{r.trimestre}</TableCell>
                  <TableCell>{r.total_licoes}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status_publicacao)}>
                      {statusLabel(r.status_publicacao)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setManagingLicoes(r)} title="Gerir Lições"><Image className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(r.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
