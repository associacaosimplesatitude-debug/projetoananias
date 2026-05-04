import { useState, useCallback, useRef, useMemo, useEffect } from "react";
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
import { Plus, BookOpen, Pencil, Image, Trash2, Upload, Eye, Save, ArrowLeft, GripVertical, ImagePlus, FileText, Loader2, ImageIcon, Bot, CheckCircle, PencilLine, ChevronLeft, ChevronRight, X, AudioLines, AlertTriangle } from "lucide-react";
import QuizEditor from "@/components/revista/QuizEditor";
import GerarAudioDialog from "@/components/revista/GerarAudioDialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  transcricao_audio: string | null;
  audio_url: string | null;
  audio_voz: string | null;
  transcricao_gerada_em: string | null;
  audio_gerado_em: string | null;
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
  const [filtroCategoria, setFiltroCategoria] = useState<"todos" | "revista" | "livro_digital" | "infografico">("todos");
  const [videoCelularCgDigital, setVideoCelularCgDigital] = useState("");
  const [videoDesktopCgDigital, setVideoDesktopCgDigital] = useState("");
  const [videoCelularLeitor, setVideoCelularLeitor] = useState("");
  const [videoDesktopLeitor, setVideoDesktopLeitor] = useState("");

  // Capa upload
  const [capaUrl, setCapaUrl] = useState("");
  const [uploadingCapa, setUploadingCapa] = useState(false);
  const [dragOverCapa, setDragOverCapa] = useState(false);
  const capaInputRef = useRef<HTMLInputElement>(null);

  // PDF file info
  const [pdfFileInfo, setPdfFileInfo] = useState<{ name: string; size: number } | null>(null);

  // Drag state for lesson pages
  const [draggingPageIdx, setDraggingPageIdx] = useState<{ licaoId: string; idx: number } | null>(null);
  const [draggingLicaoId, setDraggingLicaoId] = useState<string | null>(null);
  const [dragOverLicaoId, setDragOverLicaoId] = useState<string | null>(null);
  const [reorderingLicoes, setReorderingLicoes] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState<string | null>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState<string | null>(null);
  const [extractingRefs, setExtractingRefs] = useState<string | null>(null);
  const [bulkQuiz, setBulkQuiz] = useState<{ running: boolean; current: number; total: number; errors: number }>({ running: false, current: 0, total: 0, errors: 0 });
  const [bulkRefs, setBulkRefs] = useState<{ running: boolean; current: number; total: number; errors: number }>({ running: false, current: 0, total: 0, errors: 0 });
  const [editingQuizLicao, setEditingQuizLicao] = useState<{ id: string; titulo: string } | null>(null);
  const [audioLicaoId, setAudioLicaoId] = useState<string | null>(null);
  
  const [uploadingPdfGlobal, setUploadingPdfGlobal] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const pdfGlobalInputRef = useRef<HTMLInputElement>(null);

  // Pages upload for livro_digital
  const [uploadingPages, setUploadingPages] = useState(false);
  const [pagesProgress, setPagesProgress] = useState({ current: 0, total: 0 });
  const [pagesResult, setPagesResult] = useState<string | null>(null);
  const pagesInputRef = useRef<HTMLInputElement>(null);

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

  // Páginas do livro/infográfico em edição (para preview no modal de edição)
  const isLivroOuInfografico = tipoConteudo === 'livro_digital' || tipoConteudo === 'infografico';
  const { data: livroPaginas, isLoading: loadingLivroPaginas } = useQuery({
    queryKey: ["revista-livro-paginas", editingRevista?.id],
    queryFn: async () => {
      if (!editingRevista) return [] as string[];
      const { data, error } = await supabase
        .from("revista_licoes")
        .select("paginas")
        .eq("revista_id", editingRevista.id)
        .order("numero");
      if (error) throw error;
      const all: string[] = [];
      (data || []).forEach((l: any) => {
        if (Array.isArray(l.paginas)) all.push(...l.paginas);
      });
      return all;
    },
    enabled: !!editingRevista && isLivroOuInfografico,
  });
  const [showAllPages, setShowAllPages] = useState(false);

  // Preview de páginas (livro/infográfico) — modal só de visualização
  const [previewRevista, setPreviewRevista] = useState<Revista | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { data: previewPaginas = [], isLoading: previewLoading } = useQuery({
    queryKey: ["revista-preview-paginas", previewRevista?.id],
    queryFn: async () => {
      if (!previewRevista) return [] as string[];
      const { data, error } = await supabase
        .from("revista_licoes")
        .select("paginas")
        .eq("revista_id", previewRevista.id)
        .order("numero");
      if (error) throw error;
      const all: string[] = [];
      (data || []).forEach((l: any) => {
        if (Array.isArray(l.paginas)) all.push(...l.paginas);
      });
      return all;
    },
    enabled: !!previewRevista,
  });

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      else if (e.key === "ArrowLeft") setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      else if (e.key === "ArrowRight")
        setLightboxIndex((i) => (i !== null && i < previewPaginas.length - 1 ? i + 1 : i));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, previewPaginas.length]);


  // Quiz status per lição
  const { data: quizMap, refetch: refetchQuiz } = useQuery({
    queryKey: ["revista-licao-quiz", managingLicoes?.id],
    queryFn: async () => {
      if (!managingLicoes || !licoes?.length) return {};
      const ids = licoes.map((l) => l.id);
      const { data } = await supabase
        .from("revista_licao_quiz")
        .select("licao_id")
        .in("licao_id", ids);
      const map: Record<string, boolean> = {};
      (data || []).forEach((q: any) => { map[q.licao_id] = true; });
      return map;
    },
    enabled: !!managingLicoes && !!licoes?.length,
  });

  // References status per lição
  const { data: refsMap, refetch: refetchRefs } = useQuery({
    queryKey: ["revista-licao-refs", managingLicoes?.id],
    queryFn: async () => {
      if (!managingLicoes || !licoes?.length) return {};
      const map: Record<string, boolean> = {};
      for (const licao of licoes) {
        const { data } = await supabase
          .from("revista_referencias_pagina" as any)
          .select("id")
          .eq("licao_id", licao.id)
          .limit(1);
        if (data && (data as any[]).length > 0) map[licao.id] = true;
      }
      return map;
    },
    enabled: !!managingLicoes && !!licoes?.length,
  });

  const handleGenerateQuiz = async (licaoId: string) => {
    setGeneratingQuiz(licaoId);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-quiz-revista", {
        body: { licao_id: licaoId },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success("Quiz gerado com sucesso!");
        refetchQuiz();
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar quiz");
    } finally {
      setGeneratingQuiz(null);
    }
  };

  const handleExtractRefs = async (licaoId: string) => {
    setExtractingRefs(licaoId);
    try {
      const { data, error } = await supabase.functions.invoke("extrair-referencias-pagina", {
        body: { licao_id: licaoId },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`${data.total_refs} referências extraídas em ${data.total_paginas} páginas`);
        refetchRefs();
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao extrair referências");
    } finally {
      setExtractingRefs(null);
    }
  };

  const handleDeleteQuiz = async (licaoId: string) => {
    if (!confirm("Excluir o quiz desta lição? Esta ação não pode ser desfeita.")) return;
    try {
      const { error } = await supabase
        .from("revista_licao_quiz")
        .delete()
        .eq("licao_id", licaoId);
      if (error) throw error;
      toast.success("Quiz excluído");
      refetchQuiz();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir quiz");
    }
  };

  const handleDeleteRefs = async (licaoId: string) => {
    if (!confirm("Excluir as referências extraídas desta lição?")) return;
    try {
      const { error } = await supabase
        .from("revista_referencias_pagina" as any)
        .delete()
        .eq("licao_id", licaoId);
      if (error) throw error;
      toast.success("Referências excluídas");
      refetchRefs();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir referências");
    }
  };

  const handleBulkGenerateQuiz = async () => {
    if (!licoes?.length) return;
    const eligible = licoes.filter(l => l.paginas.length > 0);
    if (eligible.length === 0) { toast.error("Nenhuma lição com páginas"); return; }
    if (!confirm(`Isso vai gerar/substituir o quiz de todas as ${eligible.length} lições. Confirmar?`)) return;

    setBulkQuiz({ running: true, current: 0, total: eligible.length, errors: 0 });
    let errors = 0;
    for (let i = 0; i < eligible.length; i++) {
      setBulkQuiz(prev => ({ ...prev, current: i + 1 }));
      setGeneratingQuiz(eligible[i].id);
      try {
        const { data, error } = await supabase.functions.invoke("gerar-quiz-revista", {
          body: { licao_id: eligible[i].id },
        });
        if (error || data?.error) errors++;
      } catch {
        errors++;
      }
      setGeneratingQuiz(null);
      refetchQuiz();
    }
    setBulkQuiz({ running: false, current: 0, total: 0, errors: 0 });
    toast.success(`Quiz gerado para ${eligible.length - errors} lições com sucesso${errors > 0 ? ` | ${errors} erros` : ""}`);
  };

  const handleBulkExtractRefs = async () => {
    if (!licoes?.length) return;
    const eligible = licoes.filter(l => l.paginas.length > 0);
    if (eligible.length === 0) { toast.error("Nenhuma lição com páginas"); return; }
    if (!confirm(`Isso vai extrair/substituir as referências de todas as ${eligible.length} lições. Confirmar?`)) return;

    setBulkRefs({ running: true, current: 0, total: eligible.length, errors: 0 });
    let errors = 0;
    for (let i = 0; i < eligible.length; i++) {
      setBulkRefs(prev => ({ ...prev, current: i + 1 }));
      setExtractingRefs(eligible[i].id);
      try {
        const { data, error } = await supabase.functions.invoke("extrair-referencias-pagina", {
          body: { licao_id: eligible[i].id },
        });
        if (error || data?.error) errors++;
      } catch {
        errors++;
      }
      setExtractingRefs(null);
      refetchRefs();
    }
    setBulkRefs({ running: false, current: 0, total: 0, errors: 0 });
    toast.success(`Referências extraídas em ${eligible.length - errors} lições com sucesso${errors > 0 ? ` | ${errors} erros` : ""}`);
  };

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
      const isLivro = tipoConteudo === 'livro_digital' || tipoConteudo === 'infografico';
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
        video_celular_cg_digital: videoCelularCgDigital || null,
        video_desktop_cg_digital: videoDesktopCgDigital || null,
        video_celular_leitor: videoCelularLeitor || null,
        video_desktop_leitor: videoDesktopLeitor || null,
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
    setVideoCelularCgDigital("");
    setVideoDesktopCgDigital("");
    setVideoCelularLeitor("");
    setVideoDesktopLeitor("");
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
    setVideoCelularCgDigital((r as any).video_celular_cg_digital || "");
    setVideoDesktopCgDigital((r as any).video_desktop_cg_digital || "");
    setVideoCelularLeitor((r as any).video_celular_leitor || "");
    setVideoDesktopLeitor((r as any).video_desktop_leitor || "");
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
      // Infográficos vão para bucket privado (acesso via signed URL gerada por edge function)
      if (tipoConteudo === 'infografico') {
        const path = `${revistaId}/infografico.pdf`;
        const { error } = await supabase.storage
          .from("infograficos-pdf")
          .upload(path, file, { upsert: true, contentType: "application/pdf" });
        if (error) throw error;
        await supabase
          .from("revistas_digitais")
          .update({ pdf_storage_path: path })
          .eq("id", revistaId);
        toast.success("PDF protegido enviado com sucesso!");
      } else {
        const path = `${revistaId}/completo.pdf`;
        const { error } = await supabase.storage.from("revistas").upload(path, file, { upsert: true, contentType: "application/pdf" });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("revistas").getPublicUrl(path);
        if (urlData?.publicUrl) {
          await supabase.from("revistas_digitais").update({ pdf_url: urlData.publicUrl }).eq("id", revistaId);
        }
        toast.success("PDF completo enviado com sucesso!");
      }
    } catch (e: any) {
      toast.error("Erro ao enviar PDF: " + e.message);
    } finally {
      setUploadingPdfGlobal(false);
      setPdfProgress("");
    }
  };

  // Upload múltiplo de páginas para livro_digital
  const handlePagesUpload = async (files: File[], revistaId: string) => {
    if (files.length === 0) return;
    setUploadingPages(true);
    setPagesResult(null);
    setPagesProgress({ current: 0, total: files.length });

    try {
      // Ordenar por nome do arquivo
      const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const urls: string[] = [];

      for (let i = 0; i < sorted.length; i++) {
        setPagesProgress({ current: i + 1, total: sorted.length });
        const file = sorted[i];
        const safeName = file.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${revistaId}/paginas/${safeName}`;
        const { error } = await supabase.storage.from("revistas").upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from("revistas").getPublicUrl(path);
        urls.push(data.publicUrl);
      }

      // Upsert single lição with all pages
      const { data: existing } = await supabase
        .from("revista_licoes")
        .select("id")
        .eq("revista_id", revistaId)
        .eq("numero", 1)
        .maybeSingle();

      if (existing) {
        await supabase.from("revista_licoes").update({ paginas: urls, titulo: "Conteúdo" }).eq("id", existing.id);
      } else {
        await supabase.from("revista_licoes").insert({
          revista_id: revistaId,
          numero: 1,
          titulo: "Conteúdo",
          paginas: urls,
        });
      }

      // Update total_licoes with page count
      await supabase.from("revistas_digitais").update({ total_licoes: urls.length }).eq("id", revistaId);

      queryClient.invalidateQueries({ queryKey: ["revistas-digitais"] });
      setPagesResult(`${urls.length} páginas carregadas com sucesso`);
      toast.success(`${urls.length} páginas carregadas com sucesso!`);
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
    } finally {
      setUploadingPages(false);
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

  const reorderLicoes = async (fromId: string, toId: string) => {
    if (!licoes || !managingLicoes || fromId === toId) return;
    const fromIdx = licoes.findIndex(l => l.id === fromId);
    const toIdx = licoes.findIndex(l => l.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;

    const newList = [...licoes];
    const [moved] = newList.splice(fromIdx, 1);
    newList.splice(toIdx, 0, moved);

    // Optimistic UI
    const renumbered = newList.map((l, i) => ({ ...l, numero: i + 1 }));
    queryClient.setQueryData(["revista-licoes", managingLicoes.id], renumbered);

    setReorderingLicoes(true);
    try {
      // Two-phase to avoid (revista_id, numero) unique conflicts:
      // 1) move all rows to negative temp numeros
      for (let i = 0; i < licoes.length; i++) {
        const { error } = await supabase
          .from("revista_licoes")
          .update({ numero: -(i + 1) })
          .eq("id", licoes[i].id);
        if (error) throw error;
      }
      // 2) apply final numeros (1..N) following new order
      for (let i = 0; i < renumbered.length; i++) {
        const { error } = await supabase
          .from("revista_licoes")
          .update({ numero: i + 1 })
          .eq("id", renumbered[i].id);
        if (error) throw error;
      }
      toast.success("Ordem das lições atualizada");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao reordenar lições");
    } finally {
      setReorderingLicoes(false);
      queryClient.invalidateQueries({ queryKey: ["revista-licoes", managingLicoes.id] });
    }
  };
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
          <Button
            className="gap-2 text-black"
            style={{ backgroundColor: "#FFC107" }}
            disabled={bulkQuiz.running}
            onClick={handleBulkGenerateQuiz}
          >
            {bulkQuiz.running ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Gerando quiz... Lição {bulkQuiz.current} de {bulkQuiz.total}</>
            ) : (
              <>🤖 Gerar Quiz de Todas as Lições</>
            )}
          </Button>
          <Button
            className="gap-2"
            variant="outline"
            disabled={bulkRefs.running || bulkQuiz.running}
            onClick={handleBulkExtractRefs}
          >
            {bulkRefs.running ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Extraindo referências... Lição {bulkRefs.current} de {bulkRefs.total}</>
            ) : (
              <>🔍 Extrair Referências de Todas as Lições</>
            )}
          </Button>
        </div>

        <div className="space-y-4">
          {licoes?.map((licao) => (
            <Card
              key={licao.id}
              draggable={!reorderingLicoes}
              onDragStart={(e) => {
                setDraggingLicaoId(licao.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!draggingLicaoId || draggingLicaoId === licao.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverLicaoId !== licao.id) setDragOverLicaoId(licao.id);
              }}
              onDragLeave={() => {
                if (dragOverLicaoId === licao.id) setDragOverLicaoId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingLicaoId && draggingLicaoId !== licao.id) {
                  reorderLicoes(draggingLicaoId, licao.id);
                }
                setDraggingLicaoId(null);
                setDragOverLicaoId(null);
              }}
              onDragEnd={() => {
                setDraggingLicaoId(null);
                setDragOverLicaoId(null);
              }}
              className={`overflow-hidden transition-all ${
                draggingLicaoId === licao.id ? "opacity-50" : ""
              } ${dragOverLicaoId === licao.id ? "ring-2 ring-primary" : ""}`}
            >
              <CardContent className="p-4">
                 <div className="flex items-start justify-between gap-4">
                   <div className="flex-1 space-y-3">
                     <div className="flex items-center gap-2">
                       <GripVertical
                         className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
                         aria-label="Arrastar para reordenar"
                       />
                       <Badge variant={licao.paginas.length > 0 ? "default" : "secondary"}>
                         {licao.paginas.length > 0 ? `${licao.paginas.length} páginas` : "Sem páginas"}
                       </Badge>
                       {reorderingLicoes && (
                         <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                           <Loader2 className="h-3 w-3 animate-spin" /> Reordenando...
                         </span>
                       )}
                     </div>
                     <div className="flex items-center gap-3">
                       {licao.paginas.length > 0 ? (
                         <a
                           href={licao.paginas[0]}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="shrink-0 block"
                           title="Abrir primeira página"
                         >
                           <img
                             src={licao.paginas[0]}
                             alt={`Pré-visualização de ${licao.titulo || "lição"}`}
                             className="h-16 w-12 object-cover rounded border bg-muted"
                             loading="lazy"
                           />
                         </a>
                       ) : (
                         <div className="h-16 w-12 rounded border border-dashed bg-muted flex items-center justify-center shrink-0">
                           <ImageIcon className="h-5 w-5 text-muted-foreground" />
                         </div>
                       )}
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
                     </div>

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
                    {/* Quiz buttons */}
                    {licao.paginas.length > 0 && (
                      quizMap?.[licao.id] ? (
                        <>
                          <Badge className="bg-green-600 text-white text-[10px] gap-1 justify-center">
                            <CheckCircle className="h-3 w-3" /> Quiz gerado
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => setEditingQuizLicao({ id: licao.id, titulo: `Lição ${licao.numero} — ${licao.titulo || ""}` })}
                          >
                            <PencilLine className="h-3 w-3" /> Ver/Editar Quiz
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleDeleteQuiz(licao.id)}
                          >
                            <Trash2 className="h-3 w-3" /> Excluir Quiz
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="gap-1 text-xs text-black"
                          style={{ backgroundColor: "#FFC107" }}
                          disabled={generatingQuiz === licao.id}
                          onClick={() => handleGenerateQuiz(licao.id)}
                        >
                          {generatingQuiz === licao.id ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> Analisando...</>
                          ) : (
                            <><Bot className="h-3 w-3" /> Gerar Quiz</>
                          )}
                        </Button>
                      )
                    )}
                    {/* References button - only show when quiz is generated */}
                    {licao.paginas.length > 0 && quizMap?.[licao.id] && (
                      refsMap?.[licao.id] ? (
                        <>
                          <Badge className="bg-blue-600 text-white text-[10px] gap-1 justify-center">
                            <CheckCircle className="h-3 w-3" /> ✅ Referências extraídas
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleDeleteRefs(licao.id)}
                          >
                            <Trash2 className="h-3 w-3" /> Excluir Referências
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          disabled={extractingRefs === licao.id}
                          onClick={() => handleExtractRefs(licao.id)}
                        >
                          {extractingRefs === licao.id ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> Analisando páginas...</>
                          ) : (
                            <>🔍 Extrair Referências</>
                          )}
                        </Button>
                      )
                    )}
                    {/* Áudio narrado por IA */}
                    {licao.paginas.length > 0 && (() => {
                      const temAudio = !!licao.audio_url;
                      const temTranscricao = !!licao.transcricao_audio;
                      const desatualizado = !!(licao.audio_gerado_em && licao.transcricao_gerada_em && new Date(licao.transcricao_gerada_em) > new Date(licao.audio_gerado_em));
                      let label = "Gerar Áudio";
                      if (temAudio) label = "Regerar Áudio";
                      else if (temTranscricao) label = "Gerar Áudio (transcrição pronta)";
                      return (
                        <>
                          {temAudio && (
                            <>
                              <Badge className="bg-green-600 text-white text-[10px] gap-1 justify-center">
                                <AudioLines className="h-3 w-3" /> 🔊 Áudio disponível
                              </Badge>
                              <audio
                                controls
                                preload="none"
                                src={licao.audio_url!}
                                className="w-full h-8"
                              />
                              <a
                                href={licao.audio_url!}
                                download={`licao-${licao.numero}.mp3`}
                                className="text-[10px] text-muted-foreground underline text-center hover:text-foreground"
                              >
                                Baixar MP3
                              </a>
                            </>
                          )}
                          {desatualizado && (
                            <Badge className="bg-amber-500 text-white text-[10px] gap-1 justify-center">
                              <AlertTriangle className="h-3 w-3" /> Áudio desatualizado
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => setAudioLicaoId(licao.id)}
                          >
                            <AudioLines className="h-3 w-3" /> {label}
                          </Button>
                        </>
                      );
                    })()}
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

        {editingQuizLicao && (
          <QuizEditor
            licaoId={editingQuizLicao.id}
            licaoTitulo={editingQuizLicao.titulo}
            onFechar={() => {
              setEditingQuizLicao(null);
              refetchQuiz();
            }}
          />
        )}

        {audioLicaoId && (
          <GerarAudioDialog
            licaoId={audioLicaoId}
            open={!!audioLicaoId}
            onClose={() => setAudioLicaoId(null)}
            onUpdated={() => queryClient.invalidateQueries({ queryKey: ["revista-licoes", managingLicoes?.id] })}
          />
        )}
      </div>
    );
  }

  // ============ LISTA DE REVISTAS ============
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Produtos Digitais
          </h2>
          <p className="text-muted-foreground">Gestão de revistas, livros digitais e infográficos</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="mr-2 h-4 w-4" /> Novo Produto
        </Button>
      </div>

      {/* Filtro por categoria */}
      <Tabs value={filtroCategoria} onValueChange={(v) => setFiltroCategoria(v as any)}>
        <TabsList>
          <TabsTrigger value="todos">
            Todos {revistas ? `(${revistas.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="revista">
            Revista EBD {revistas ? `(${revistas.filter((r: any) => !r.tipo_conteudo || r.tipo_conteudo === "revista").length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="livro_digital">
            Livros Digitais {revistas ? `(${revistas.filter((r: any) => r.tipo_conteudo === "livro_digital").length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="infografico">
            Infográficos {revistas ? `(${revistas.filter((r: any) => r.tipo_conteudo === "infografico").length})` : ""}
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
              {tipoConteudo !== 'livro_digital' && tipoConteudo !== 'infografico' && (
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
                    <SelectItem value="infografico">Infográficos</SelectItem>
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
                {!editingRevista && tipoConteudo !== 'livro_digital' && tipoConteudo !== 'infografico' && (
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

              {/* Vídeos da página de escolha */}
              {editingRevista && (
                <div className="space-y-3 border-t pt-3 mt-2" style={{ borderColor: "#e5e7eb" }}>
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vídeos da página de escolha</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Celular — CG Digital</Label>
                      <Input value={videoCelularCgDigital} onChange={(e) => setVideoCelularCgDigital(e.target.value)} placeholder="Link Pandavideo" className="text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Computador — CG Digital</Label>
                      <Input value={videoDesktopCgDigital} onChange={(e) => setVideoDesktopCgDigital(e.target.value)} placeholder="Link Pandavideo" className="text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Celular — Leitor CG</Label>
                      <Input value={videoCelularLeitor} onChange={(e) => setVideoCelularLeitor(e.target.value)} placeholder="Link Pandavideo" className="text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Computador — Leitor CG</Label>
                      <Input value={videoDesktopLeitor} onChange={(e) => setVideoDesktopLeitor(e.target.value)} placeholder="Link Pandavideo" className="text-xs" />
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!titulo || saveMutation.isPending || (!editingRevista && tipoConteudo !== 'livro_digital' && tipoConteudo !== 'infografico' && (!totalLicoes || Number(totalLicoes) < 1))}
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
                    setPdfFileInfo({ name: f.name, size: f.size });
                    const revId = editingRevista?.id;
                    if (revId) {
                      handleGlobalPdfUpload(f, revId);
                    } else {
                      toast.error("Salve a revista primeiro");
                    }
                    e.target.value = "";
                  }}
                />
                {pdfFileInfo && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    📄 {pdfFileInfo.name} ({pdfFileInfo.size < 1024 * 1024
                      ? `${(pdfFileInfo.size / 1024).toFixed(1)} KB`
                      : `${(pdfFileInfo.size / (1024 * 1024)).toFixed(2)} MB`})
                  </p>
                )}
              </div>

              {/* Páginas do Livro Digital / Infográfico — preview + upload */}
              {(tipoConteudo === 'livro_digital' || tipoConteudo === 'infografico') && editingRevista && (() => {
                const totalPaginas = livroPaginas?.length || 0;
                const temPaginas = totalPaginas > 0;
                const PREVIEW_LIMIT = 12;
                const paginasVisiveis = showAllPages ? (livroPaginas || []) : (livroPaginas || []).slice(0, PREVIEW_LIMIT);
                const restantes = Math.max(0, totalPaginas - PREVIEW_LIMIT);
                const tituloBloco = tipoConteudo === 'infografico' ? 'Páginas do Infográfico' : 'Páginas do Livro';

                return (
                  <div className="pt-3 border-t space-y-3">
                    <Label className="text-xs">{tituloBloco}</Label>

                    {/* Card-resumo visual */}
                    <div className={`rounded-lg border p-3 flex items-center gap-3 ${
                      temPaginas ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                    }`}>
                      <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${
                        temPaginas ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {loadingLivroPaginas ? (
                          <p className="text-sm font-medium text-muted-foreground">Carregando páginas...</p>
                        ) : (
                          <>
                            <p className="text-sm font-semibold">
                              {temPaginas ? `${totalPaginas} ${totalPaginas === 1 ? 'página cadastrada' : 'páginas cadastradas'}` : 'Nenhuma página cadastrada'}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {temPaginas
                                ? 'As imagens abaixo são as páginas reais do conteúdo.'
                                : 'Use o botão abaixo para enviar as imagens das páginas.'}
                            </p>
                          </>
                        )}
                      </div>
                      {temPaginas && (
                        <Badge variant="outline" className="bg-white text-green-700 border-green-300 shrink-0">
                          {totalPaginas}
                        </Badge>
                      )}
                    </div>

                    {/* Grid de miniaturas */}
                    {temPaginas && (
                      <div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {paginasVisiveis.map((url, i) => (
                            <a
                              key={`${url}-${i}`}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative aspect-[3/4] rounded-md overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition"
                              title={`Página ${i + 1} — abrir`}
                            >
                              <img
                                src={url}
                                alt={`Página ${i + 1}`}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] font-medium text-center py-0.5">
                                {i + 1}
                              </span>
                            </a>
                          ))}
                          {!showAllPages && restantes > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowAllPages(true)}
                              className="aspect-[3/4] rounded-md border-2 border-dashed bg-muted/50 hover:bg-muted flex flex-col items-center justify-center text-xs font-medium text-muted-foreground hover:text-foreground transition"
                            >
                              <span className="text-base font-bold">+{restantes}</span>
                              <span className="text-[10px]">ver todas</span>
                            </button>
                          )}
                        </div>
                        {showAllPages && totalPaginas > PREVIEW_LIMIT && (
                          <button
                            type="button"
                            onClick={() => setShowAllPages(false)}
                            className="mt-2 text-[11px] text-primary hover:underline"
                          >
                            Mostrar apenas as primeiras {PREVIEW_LIMIT}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Botão de upload */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">
                        {temPaginas
                          ? 'Atenção: ao enviar novas páginas, as atuais serão substituídas.'
                          : 'Selecione as imagens das páginas (serão ordenadas pelo nome do arquivo).'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1 text-xs"
                        disabled={uploadingPages}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (temPaginas && !confirm(`Isso vai substituir as ${totalPaginas} páginas atuais. Continuar?`)) return;
                          pagesInputRef.current?.click();
                        }}
                      >
                        {uploadingPages ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
                        {uploadingPages
                          ? `Enviando ${pagesProgress.current} de ${pagesProgress.total}...`
                          : temPaginas ? "🔄 Substituir páginas" : "🖼️ Selecionar Páginas"}
                      </Button>
                      <input
                        ref={pagesInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          handlePagesUpload(files, editingRevista.id);
                          e.target.value = "";
                        }}
                      />
                      {uploadingPages && (
                        <div className="mt-2 space-y-1">
                          <Progress value={(pagesProgress.current / pagesProgress.total) * 100} className="h-2" />
                          <p className="text-[10px] text-muted-foreground text-center">
                            {pagesProgress.current} / {pagesProgress.total}
                          </p>
                        </div>
                      )}
                      {pagesResult && (
                        <p className="text-[10px] text-green-600 mt-1">✅ {pagesResult}</p>
                      )}
                    </div>
                  </div>
                );
              })()}
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
              {(() => {
                const filtered = (revistas || []).filter((r: any) => {
                  if (filtroCategoria === "todos") return true;
                  if (filtroCategoria === "revista") return !r.tipo_conteudo || r.tipo_conteudo === "revista";
                  return r.tipo_conteudo === filtroCategoria;
                });
                if (isLoading) {
                  return <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>;
                }
                if (filtered.length === 0) {
                  return <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado nesta categoria</TableCell></TableRow>;
                }
                return filtered.map((r) => (
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
                  <TableCell>
                    {(r as any).tipo_conteudo === 'livro_digital' || (r as any).tipo_conteudo === 'infografico'
                      ? r.total_licoes > 0 ? `${r.total_licoes} páginas` : "—"
                      : r.total_licoes}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status_publicacao)}>
                      {statusLabel(r.status_publicacao)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {((r as any).tipo_conteudo === 'livro_digital' || (r as any).tipo_conteudo === 'infografico') && (
                      <Button size="sm" variant="ghost" onClick={() => setPreviewRevista(r)} title="Visualizar páginas"><Eye className="h-4 w-4" /></Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    {(r as any).tipo_conteudo !== 'livro_digital' && (r as any).tipo_conteudo !== 'infografico' && (
                      <Button size="sm" variant="ghost" onClick={() => setManagingLicoes(r)} title="Gerir Lições"><Image className="h-4 w-4" /></Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(r.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview de páginas — livro digital / infográfico */}
      <Dialog open={!!previewRevista} onOpenChange={(o) => { if (!o) { setPreviewRevista(null); setLightboxIndex(null); } }}>
        <DialogContent
          className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
          onPointerDownOutside={(e) => { if (lightboxIndex !== null) e.preventDefault(); }}
          onInteractOutside={(e) => { if (lightboxIndex !== null) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (lightboxIndex !== null) e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {previewRevista?.capa_url && (
                <img src={previewRevista.capa_url} alt="" className="w-10 h-14 object-cover rounded shadow" />
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{previewRevista?.titulo}</div>
                {previewRevista?.autor && (
                  <div className="text-xs font-normal text-muted-foreground truncate">{previewRevista.autor}</div>
                )}
              </div>
              <Badge variant="secondary" className="shrink-0">
                {previewLoading ? "..." : `${previewPaginas.length} páginas`}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {previewLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : previewPaginas.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhuma página cadastrada ainda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-4">
                {previewPaginas.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="relative group aspect-[3/4] bg-muted rounded-md overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                  >
                    <img
                      src={url}
                      alt={`Página ${i + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      {i + 1}
                    </span>
                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox fullscreen */}
      {lightboxIndex !== null && previewPaginas[lightboxIndex] && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            title="Fechar (Esc)"
          >
            <X className="h-6 w-6" />
          </button>
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-3"
              title="Anterior (←)"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {lightboxIndex < previewPaginas.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-3"
              title="Próxima (→)"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
          <img
            src={previewPaginas[lightboxIndex]}
            alt={`Página ${lightboxIndex + 1}`}
            className="max-h-[92vh] max-w-[92vw] object-contain"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/50 px-3 py-1 rounded-full">
            {lightboxIndex + 1} / {previewPaginas.length}
          </div>
        </div>
      )}
    </div>
  );
}
