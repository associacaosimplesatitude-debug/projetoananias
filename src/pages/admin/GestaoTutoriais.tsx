import { useState, useRef, useCallback } from "react";
import * as tus from "tus-js-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Video, ArrowLeft, Upload, X, FileVideo, Eye, CheckCircle2, Clock, Users, AlertTriangle, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

// Constants
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const PERFIS = [
  { value: "VENDEDORES", label: "Vendedores" },
  { value: "GERENTES", label: "Gerentes" },
  { value: "FINANCEIRO", label: "Financeiro" },
  { value: "PROFESSORES", label: "Professores" },
  { value: "ALUNOS", label: "Alunos" },
  { value: "SUPERINTENDENTES", label: "Superintendentes" },
  { value: "ADMINISTRADOR_GERAL", label: "Administrador Geral" },
] as const;

type TutorialPerfil = typeof PERFIS[number]["value"];

// Video player component for managers to watch tutorials
function VideoPlayer({ videoPath }: { videoPath: string }) {
  const { data } = supabase.storage.from("tutorial-videos").getPublicUrl(videoPath);
  
  return (
    <video
      className="w-full aspect-video rounded-lg bg-black"
      controls
      preload="metadata"
    >
      <source src={data.publicUrl} type="video/mp4" />
      Seu navegador não suporta vídeos HTML5.
    </video>
  );
}

interface Tutorial {
  id: string;
  titulo: string;
  link_video: string;
  video_path: string | null;
  descricao: string | null;
  categorias: string[];
  ordem: number;
  created_at: string;
  tutoriais_perfis: { perfil: TutorialPerfil }[];
}

interface TutorialForm {
  titulo: string;
  descricao: string;
  categorias: string;
  perfis: TutorialPerfil[];
  ordem: number;
}

interface Vendedor {
  id: string;
  nome: string;
  email: string;
}

interface Visualizacao {
  tutorial_id: string;
  vendedor_id: string;
  assistido_em: string;
}

const initialForm: TutorialForm = {
  titulo: "",
  descricao: "",
  categorias: "",
  perfis: [],
  ordem: 0,
};

export default function GestaoTutoriais() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TutorialForm>(initialForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingVideoPath, setExistingVideoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [viewingTutorialId, setViewingTutorialId] = useState<string | null>(null);
  const [fileTooLarge, setFileTooLarge] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: tutoriais, isLoading } = useQuery({
    queryKey: ["tutoriais-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutoriais")
        .select("*, tutoriais_perfis(perfil)")
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data as Tutorial[];
    },
  });

  // Fetch all vendedores
  const { data: vendedores } = useQuery({
    queryKey: ["vendedores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome, email")
        .order("nome");

      if (error) throw error;
      return data as Vendedor[];
    },
  });

  // Fetch all visualizacoes
  const { data: allVisualizacoes } = useQuery({
    queryKey: ["all-tutorial-visualizacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorial_visualizacoes")
        .select("tutorial_id, vendedor_id, assistido_em");

      if (error) throw error;
      return data as Visualizacao[];
    },
  });

  // Helper to get watch stats for a tutorial
  const getWatchStats = (tutorialId: string) => {
    const totalVendedores = vendedores?.length ?? 0;
    const watched = allVisualizacoes?.filter((v) => v.tutorial_id === tutorialId).length ?? 0;
    const percentage = totalVendedores > 0 ? Math.round((watched / totalVendedores) * 100) : 0;
    return { watched, total: totalVendedores, percentage };
  };

  // Get detailed view for a tutorial
  const getVisualizacoesDetalhadas = (tutorialId: string) => {
    const vizMap = new Map(
      allVisualizacoes
        ?.filter((v) => v.tutorial_id === tutorialId)
        .map((v) => [v.vendedor_id, v.assistido_em])
    );

    return vendedores?.map((vendedor) => ({
      ...vendedor,
      assistido: vizMap.has(vendedor.id),
      assistido_em: vizMap.get(vendedor.id),
    })) ?? [];
  };

  const uploadVideo = useCallback(async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `tutorials/${fileName}`;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${accessToken}`,
          "x-upsert": "true",
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: "tutorial-videos",
          objectName: filePath,
          contentType: file.type,
        },
        chunkSize: 6 * 1024 * 1024, // 6MB por chunk
        onError: (error) => {
          console.error("Upload error:", error);
          reject(error);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          setUploadProgress(percentage);
        },
        onSuccess: () => {
          resolve(filePath);
        },
      });

      // Verificar uploads anteriores para retomar se necessário
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  }, []);

  const deleteVideo = async (videoPath: string) => {
    await supabase.storage.from("tutorial-videos").remove([videoPath]);
  };

  const createMutation = useMutation({
    mutationFn: async (data: TutorialForm & { videoPath: string }) => {
      // Get max ordem
      const maxOrdem = tutoriais?.reduce((max, t) => Math.max(max, t.ordem || 0), 0) ?? 0;
      
      const { data: tutorial, error: tutorialError } = await supabase
        .from("tutoriais")
        .insert({
          titulo: data.titulo,
          link_video: "",
          video_path: data.videoPath,
          descricao: data.descricao || null,
          categorias: data.categorias.split(",").map((c) => c.trim()).filter(Boolean),
          ordem: data.ordem || maxOrdem + 1,
        })
        .select()
        .single();

      if (tutorialError) throw tutorialError;

      if (data.perfis.length > 0) {
        const { error: perfisError } = await supabase
          .from("tutoriais_perfis")
          .insert(
            data.perfis.map((perfil) => ({
              tutorial_id: tutorial.id,
              perfil,
            }))
          );

        if (perfisError) throw perfisError;
      }

      return tutorial;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutoriais-admin"] });
      toast.success("Tutorial criado com sucesso!");
      handleClose();
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao criar tutorial");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, videoPath, oldVideoPath }: { id: string; data: TutorialForm; videoPath: string | null; oldVideoPath: string | null }) => {
      if (oldVideoPath && videoPath && oldVideoPath !== videoPath) {
        await deleteVideo(oldVideoPath);
      }

      const { error: tutorialError } = await supabase
        .from("tutoriais")
        .update({
          titulo: data.titulo,
          video_path: videoPath,
          descricao: data.descricao || null,
          categorias: data.categorias.split(",").map((c) => c.trim()).filter(Boolean),
          ordem: data.ordem,
        })
        .eq("id", id);

      if (tutorialError) throw tutorialError;

      const { error: deleteError } = await supabase
        .from("tutoriais_perfis")
        .delete()
        .eq("tutorial_id", id);

      if (deleteError) throw deleteError;

      if (data.perfis.length > 0) {
        const { error: perfisError } = await supabase
          .from("tutoriais_perfis")
          .insert(
            data.perfis.map((perfil) => ({
              tutorial_id: id,
              perfil,
            }))
          );

        if (perfisError) throw perfisError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutoriais-admin"] });
      toast.success("Tutorial atualizado com sucesso!");
      handleClose();
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao atualizar tutorial");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, videoPath }: { id: string; videoPath: string | null }) => {
      if (videoPath) {
        await deleteVideo(videoPath);
      }
      
      const { error } = await supabase.from("tutoriais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutoriais-admin"] });
      toast.success("Tutorial excluído com sucesso!");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao excluir tutorial");
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setEditingId(null);
    setForm(initialForm);
    setSelectedFile(null);
    setExistingVideoPath(null);
    setUploading(false);
    setFileTooLarge(false);
  };

  const handleEdit = (tutorial: Tutorial) => {
    setEditingId(tutorial.id);
    setForm({
      titulo: tutorial.titulo,
      descricao: tutorial.descricao || "",
      categorias: tutorial.categorias?.join(", ") || "",
      perfis: tutorial.tutoriais_perfis.map((p) => p.perfil),
      ordem: tutorial.ordem || 0,
    });
    setExistingVideoPath(tutorial.video_path);
    setSelectedFile(null);
    setIsOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo válido");
      return;
    }

    // Check file size limit
    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(file);
      setFileTooLarge(true);
      return;
    }

    setSelectedFile(file);
    setFileTooLarge(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.titulo) {
      toast.error("Preencha o título");
      return;
    }

    if (!selectedFile && !existingVideoPath) {
      toast.error("Selecione um vídeo");
      return;
    }

    if (fileTooLarge) {
      toast.error("O arquivo excede o limite de 500MB. Por favor, comprima o vídeo antes de enviar.");
      return;
    }

    if (form.perfis.length === 0) {
      toast.error("Selecione pelo menos um perfil de acesso");
      return;
    }

    try {
      let videoPath = existingVideoPath;

      // Upload
      if (selectedFile) {
        setUploading(true);
        setUploadProgress(0);
        videoPath = await uploadVideo(selectedFile);
      }

      if (editingId) {
        updateMutation.mutate({ 
          id: editingId, 
          data: form, 
          videoPath,
          oldVideoPath: selectedFile ? existingVideoPath : null 
        });
      } else {
        createMutation.mutate({ ...form, videoPath: videoPath! });
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao fazer upload do vídeo");
      setUploading(false);
    }
  };

  const togglePerfil = (perfil: TutorialPerfil) => {
    setForm((prev) => ({
      ...prev,
      perfis: prev.perfis.includes(perfil)
        ? prev.perfis.filter((p) => p !== perfil)
        : [...prev.perfis, perfil],
    }));
  };

  // Get the viewing tutorial details
  const viewingTutorial = tutoriais?.find((t) => t.id === viewingTutorialId);
  const viewingDetails = viewingTutorialId ? getVisualizacoesDetalhadas(viewingTutorialId) : [];
  const viewingStats = viewingTutorialId ? getWatchStats(viewingTutorialId) : null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/ebd">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Gestão de Tutoriais</h1>
            <p className="text-muted-foreground">
              Cadastre e gerencie vídeos tutoriais por perfil de usuário
            </p>
          </div>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setForm(initialForm); setSelectedFile(null); setExistingVideoPath(null); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Tutorial
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Tutorial" : "Novo Tutorial"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 space-y-2">
                  <Label htmlFor="titulo">Título *</Label>
                  <Input
                    id="titulo"
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Ex: Como cadastrar um pedido"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ordem">Ordem</Label>
                  <Input
                    id="ordem"
                    type="number"
                    min={1}
                    value={form.ordem || ""}
                    onChange={(e) => setForm({ ...form, ordem: parseInt(e.target.value) || 0 })}
                    placeholder="1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Vídeo (MP4) *</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {!selectedFile && !existingVideoPath ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                  >
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Clique para selecionar um vídeo MP4
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Máximo 500MB
                    </p>
                  </div>
                ) : fileTooLarge ? (
                  <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-6 w-6 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="space-y-2">
                        <p className="font-medium text-destructive">
                          Vídeo muito grande ({formatFileSize(selectedFile!.size)})
                        </p>
                        <p className="text-sm text-muted-foreground">
                          O limite para upload é <strong>500MB</strong>. Por favor, comprima o vídeo antes de enviar.
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-background rounded-lg p-4 space-y-3">
                      <p className="text-sm font-medium">📥 Baixe o HandBrake (gratuito):</p>
                      <a
                        href="https://handbrake.fr/downloads.php"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                      >
                        handbrake.fr/downloads.php
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      
                      <div className="pt-2 border-t">
                        <p className="text-sm font-medium mb-2">⚙️ Configurações recomendadas:</p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                          <li>• Preset: <strong>Fast 720p30</strong></li>
                          <li>• Formato: <strong>MP4</strong></li>
                        </ul>
                      </div>
                      
                      <p className="text-xs text-muted-foreground pt-2">
                        Um vídeo de {formatFileSize(selectedFile!.size)} ficará com aproximadamente{" "}
                        {formatFileSize(selectedFile!.size * 0.08)} após comprimir.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setFileTooLarge(false);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      Selecionar outro arquivo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="border rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileVideo className="h-8 w-8 text-primary" />
                        <div>
                          <p className="text-sm font-medium">
                            {selectedFile ? selectedFile.name : "Vídeo atual"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {selectedFile 
                              ? formatFileSize(selectedFile.size)
                              : "Clique no X para remover e selecionar outro"
                            }
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedFile(null);
                          setFileTooLarge(false);
                          if (!editingId) setExistingVideoPath(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        disabled={uploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Upload progress */}
                {uploading && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Enviando vídeo...</span>
                      <span className="font-medium">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                {existingVideoPath && !selectedFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Substituir vídeo
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Descrição do tutorial..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categorias">Categorias (separadas por vírgula)</Label>
                <Input
                  id="categorias"
                  value={form.categorias}
                  onChange={(e) => setForm({ ...form, categorias: e.target.value })}
                  placeholder="Ex: Bling, Vendas B2B, EBD"
                />
              </div>

              <div className="space-y-2">
                <Label>Perfis de Acesso *</Label>
                <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg">
                  {PERFIS.map((perfil) => (
                    <div key={perfil.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={perfil.value}
                        checked={form.perfis.includes(perfil.value)}
                        onCheckedChange={() => togglePerfil(perfil.value)}
                      />
                      <Label htmlFor={perfil.value} className="cursor-pointer">
                        {perfil.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClose}
                  disabled={uploading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={uploading || fileTooLarge || createMutation.isPending || updateMutation.isPending}
                >
                  {uploading 
                    ? "Enviando..." 
                    : editingId 
                      ? "Salvar" 
                      : "Criar"
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* View details dialog */}
      <Dialog open={!!viewingTutorialId} onOpenChange={(open) => !open && setViewingTutorialId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Quem assistiu
            </DialogTitle>
          </DialogHeader>
          
          {viewingTutorial && viewingStats && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm mb-2">{viewingTutorial.titulo}</p>
                <div className="flex items-center gap-2">
                  <Progress value={viewingStats.percentage} className="h-2 flex-1" />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {viewingStats.watched}/{viewingStats.total}
                  </span>
                </div>
              </div>

              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {viewingDetails
                    .sort((a, b) => {
                      // Watched first, then by date (most recent first), then by name
                      if (a.assistido && !b.assistido) return -1;
                      if (!a.assistido && b.assistido) return 1;
                      if (a.assistido && b.assistido) {
                        return new Date(b.assistido_em!).getTime() - new Date(a.assistido_em!).getTime();
                      }
                      return a.nome.localeCompare(b.nome);
                    })
                    .map((vendedor) => (
                      <div
                        key={vendedor.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          vendedor.assistido ? "bg-green-50 border-green-200" : "bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {vendedor.assistido ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium text-sm">{vendedor.nome}</span>
                        </div>
                        {vendedor.assistido ? (
                          <span className="text-xs text-green-600">
                            {format(new Date(vendedor.assistido_em!), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não assistiu</span>
                        )}
                      </div>
                    ))}
                </div>
              </ScrollArea>

              <div className="pt-2 border-t text-center">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{viewingStats.watched}</span> de{" "}
                  <span className="font-medium text-foreground">{viewingStats.total}</span> vendedores assistiram ({viewingStats.percentage}%)
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : tutoriais?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum tutorial cadastrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tutoriais?.map((tutorial) => {
            const stats = getWatchStats(tutorial.id);
            const hasVendedorProfile = tutorial.tutoriais_perfis.some(p => p.perfil === "VENDEDORES");

            return (
              <Card key={tutorial.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          #{tutorial.ordem || "-"}
                        </Badge>
                        <CardTitle className="text-lg">{tutorial.titulo}</CardTitle>
                      </div>
                      {tutorial.descricao && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {tutorial.descricao}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(tutorial)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Deseja excluir este tutorial?")) {
                            deleteMutation.mutate({ id: tutorial.id, videoPath: tutorial.video_path });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tutorial.video_path ? (
                    <VideoPlayer videoPath={tutorial.video_path} />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileVideo className="h-4 w-4" />
                      <span>Sem vídeo cadastrado</span>
                    </div>
                  )}

                  {tutorial.categorias?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tutorial.categorias.map((cat) => (
                        <Badge key={cat} variant="secondary">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {tutorial.tutoriais_perfis.map((p) => (
                      <Badge key={p.perfil} variant="outline">
                        {PERFIS.find((pf) => pf.value === p.perfil)?.label || p.perfil}
                      </Badge>
                    ))}
                  </div>

                  {/* Watch statistics for vendedores */}
                  {hasVendedorProfile && (
                    <div className="pt-3 border-t space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <span>
                            <span className="font-medium">{stats.watched}</span> de{" "}
                            <span className="font-medium">{stats.total}</span> vendedores assistiram
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingTutorialId(tutorial.id)}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          Ver lista
                        </Button>
                      </div>
                      <Progress value={stats.percentage} className="h-2" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
