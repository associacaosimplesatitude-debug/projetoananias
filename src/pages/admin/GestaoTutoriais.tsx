import { useState } from "react";
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
import { Plus, Pencil, Trash2, Video, ArrowLeft } from "lucide-react";
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
  descricao: string | null;
  categorias: string[];
  created_at: string;
  tutoriais_perfis: { perfil: TutorialPerfil }[];
}

interface TutorialForm {
  titulo: string;
  link_video: string;
  descricao: string;
  categorias: string;
  perfis: TutorialPerfil[];
}

const initialForm: TutorialForm = {
  titulo: "",
  link_video: "",
  descricao: "",
  categorias: "",
  perfis: [],
};

export default function GestaoTutoriais() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TutorialForm>(initialForm);
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

  const createMutation = useMutation({
    mutationFn: async (data: TutorialForm) => {
      const { data: tutorial, error: tutorialError } = await supabase
        .from("tutoriais")
        .insert({
          titulo: data.titulo,
          link_video: data.link_video,
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
    mutationFn: async ({ id, data }: { id: string; data: TutorialForm }) => {
      const { error: tutorialError } = await supabase
        .from("tutoriais")
        .update({
          titulo: data.titulo,
          link_video: data.link_video,
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
    mutationFn: async (id: string) => {
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
  };

  const handleEdit = (tutorial: Tutorial) => {
    setEditingId(tutorial.id);
    setForm({
      titulo: tutorial.titulo,
      link_video: tutorial.link_video,
      descricao: tutorial.descricao || "",
      categorias: tutorial.categorias?.join(", ") || "",
      perfis: tutorial.tutoriais_perfis.map((p) => p.perfil),
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo || !form.link_video) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
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
            <Button onClick={() => setForm(initialForm)}>
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
                <Label htmlFor="link_video">Link do Vídeo *</Label>
                <Input
                  id="link_video"
                  value={form.link_video}
                  onChange={(e) => setForm({ ...form, link_video: e.target.value })}
                  placeholder="Ex: https://www.youtube.com/watch?v=..."
                />
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
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? "Salvar" : "Criar"}
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
                          deleteMutation.mutate(tutorial.id);
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
                  <Video className="h-4 w-4" />
                  <a
                    href={tutorial.link_video}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline truncate"
                  >
                    {tutorial.link_video}
                  </a>
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
