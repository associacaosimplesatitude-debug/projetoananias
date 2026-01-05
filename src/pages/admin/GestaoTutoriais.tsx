import { useState, useRef } from "react";
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
import { Plus, Pencil, Trash2, Video, ArrowLeft, Upload, X, FileVideo } from "lucide-react";
import { Link } from "react-router-dom";

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

interface Tutorial {
  id: string;
  titulo: string;
  link_video: string;
  video_path: string | null;
  descricao: string | null;
  categorias: string[];
  created_at: string;
  tutoriais_perfis: { perfil: TutorialPerfil }[];
}

interface TutorialForm {
  titulo: string;
  descricao: string;
  categorias: string;
  perfis: TutorialPerfil[];
}

const initialForm: TutorialForm = {
  titulo: "",
  descricao: "",
  categorias: "",
  perfis: [],
};

export default function GestaoTutoriais() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TutorialForm>(initialForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingVideoPath, setExistingVideoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: tutoriais, isLoading } = useQuery({
    queryKey: ["tutoriais-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutoriais")
        .select("*, tutoriais_perfis(perfil)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Tutorial[];
    },
  });

  const uploadVideo = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `tutorials/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("tutorial-videos")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    return filePath;
  };

  const deleteVideo = async (videoPath: string) => {
    await supabase.storage.from("tutorial-videos").remove([videoPath]);
  };

  const createMutation = useMutation({
    mutationFn: async (data: TutorialForm & { videoPath: string }) => {
      const { data: tutorial, error: tutorialError } = await supabase
        .from("tutoriais")
        .insert({
          titulo: data.titulo,
          link_video: "", // Mantemos vazio para compatibilidade
          video_path: data.videoPath,
          descricao: data.descricao || null,
          categorias: data.categorias.split(",").map((c) => c.trim()).filter(Boolean),
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
      // Delete old video if we're uploading a new one
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
        })
        .eq("id", id);

      if (tutorialError) throw tutorialError;

      // Delete existing perfis and insert new ones
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
      // Delete video from storage
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
  };

  const handleEdit = (tutorial: Tutorial) => {
    setEditingId(tutorial.id);
    setForm({
      titulo: tutorial.titulo,
      descricao: tutorial.descricao || "",
      categorias: tutorial.categorias?.join(", ") || "",
      perfis: tutorial.tutoriais_perfis.map((p) => p.perfil),
    });
    setExistingVideoPath(tutorial.video_path);
    setSelectedFile(null);
    setIsOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo válido");
      return;
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 100MB");
      return;
    }

    setSelectedFile(file);
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

    if (form.perfis.length === 0) {
      toast.error("Selecione pelo menos um perfil de acesso");
      return;
    }

    setUploading(true);

    try {
      let videoPath = existingVideoPath;

      // Upload new video if selected
      if (selectedFile) {
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

  const getVideoUrl = (videoPath: string) => {
    const { data } = supabase.storage.from("tutorial-videos").getPublicUrl(videoPath);
    return data.publicUrl;
  };

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
              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex: Como cadastrar um pedido"
                />
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
                      Máximo 100MB
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileVideo className="h-8 w-8 text-primary" />
                      <div>
                        <p className="text-sm font-medium">
                          {selectedFile ? selectedFile.name : "Vídeo atual"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedFile 
                            ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
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
                        if (!editingId) setExistingVideoPath(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
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
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={uploading || createMutation.isPending || updateMutation.isPending}
                >
                  {uploading ? "Enviando..." : editingId ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
          {tutoriais?.map((tutorial) => (
            <Card key={tutorial.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{tutorial.titulo}</CardTitle>
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
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileVideo className="h-4 w-4" />
                  <span>
                    {tutorial.video_path ? "Vídeo MP4 cadastrado" : "Sem vídeo"}
                  </span>
                </div>

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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
