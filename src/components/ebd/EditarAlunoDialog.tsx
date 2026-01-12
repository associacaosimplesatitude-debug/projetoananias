import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { User, Upload } from "lucide-react";

interface EditarAlunoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aluno: {
    id: string;
    nome_completo: string;
    email: string | null;
    telefone: string | null;
    data_nascimento: string | null;
    avatar_url: string | null;
    turma_id: string | null;
    church_id: string;
  } | null;
  onSuccess?: () => void;
}

export function EditarAlunoDialog({
  open,
  onOpenChange,
  aluno,
  onSuccess,
}: EditarAlunoDialogProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [turmaId, setTurmaId] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Fetch turmas for the church
  const { data: turmas } = useQuery({
    queryKey: ["ebd-turmas", aluno?.church_id],
    queryFn: async () => {
      if (!aluno?.church_id) return [];
      const { data, error } = await supabase
        .from("ebd_turmas")
        .select("id, nome")
        .eq("church_id", aluno.church_id)
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!aluno?.church_id,
  });

  useEffect(() => {
    if (aluno) {
      setNome(aluno.nome_completo || "");
      setEmail(aluno.email || "");
      setTelefone(aluno.telefone || "");
      setDataNascimento(aluno.data_nascimento || "");
      setTurmaId(aluno.turma_id);
      setAvatarPreview(aluno.avatar_url);
      setAvatarFile(null);
    }
  }, [aluno]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const editarAlunoMutation = useMutation({
    mutationFn: async () => {
      if (!aluno) throw new Error("Aluno não encontrado");

      let avatarUrl = aluno.avatar_url;

      // Upload new avatar if provided
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${aluno.id}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("ebd-assets")
          .upload(filePath, avatarFile, { upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("ebd-assets")
            .getPublicUrl(filePath);
          avatarUrl = publicUrl;
        }
      }

      const { error } = await supabase
        .from("ebd_alunos")
        .update({
          nome_completo: nome,
          email: email || null,
          telefone: telefone || null,
          data_nascimento: dataNascimento || null,
          turma_id: turmaId || null,
          avatar_url: avatarUrl,
        })
        .eq("id", aluno.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebd-alunos"] });
      toast.success("Aluno atualizado com sucesso!");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error("Update error:", error);
      toast.error(error.message || "Erro ao atualizar aluno");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Aluno</DialogTitle>
          <DialogDescription>Atualize os dados do aluno.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarPreview || undefined} className="object-cover" />
              <AvatarFallback>
                <User className="h-10 w-10" />
              </AvatarFallback>
            </Avatar>
            <Label
              htmlFor="avatar-edit-upload"
              className="cursor-pointer flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Upload className="h-4 w-4" />
              Alterar Foto
            </Label>
            <input
              id="avatar-edit-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="edit-nome">Nome Completo</Label>
            <Input
              id="edit-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="edit-email">E-mail</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="edit-telefone">Telefone</Label>
            <Input
              id="edit-telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </div>

          {/* Data de Nascimento */}
          <div className="space-y-2">
            <Label htmlFor="edit-dataNascimento">Data de Aniversário</Label>
            <Input
              id="edit-dataNascimento"
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
            />
          </div>

          {/* Turma */}
          <div className="space-y-2">
            <Label htmlFor="edit-turma">Turma</Label>
            <Select value={turmaId || "none"} onValueChange={(val) => setTurmaId(val === "none" ? null : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma turma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem turma</SelectItem>
                {turmas?.map((turma) => (
                  <SelectItem key={turma.id} value={turma.id}>
                    {turma.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => editarAlunoMutation.mutate()}
            disabled={editarAlunoMutation.isPending}
          >
            {editarAlunoMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
