import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { User, Upload } from "lucide-react";
import { z } from "zod";

const alunoSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  whatsapp: z.string().optional(),
  dataNascimento: z.string().optional(),
});

interface CadastrarAlunoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  onSuccess?: () => void;
}

export function CadastrarAlunoDialog({
  open,
  onOpenChange,
  churchId,
  onSuccess,
}: CadastrarAlunoDialogProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const resetForm = () => {
    setNome("");
    setEmail("");
    setSenha("");
    setWhatsapp("");
    setDataNascimento("");
    setAvatarFile(null);
    setAvatarPreview(null);
    setErrors({});
  };

  const cadastrarAlunoMutation = useMutation({
    mutationFn: async () => {
      // Validate form
      const validationResult = alunoSchema.safeParse({
        nome,
        email,
        senha,
        whatsapp,
        dataNascimento,
      });

      if (!validationResult.success) {
        const newErrors: Record<string, string> = {};
        validationResult.error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
        throw new Error("Preencha os campos corretamente");
      }

      setErrors({});

      // 1. Create auth user via edge function
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error("Não autorizado");
      }

      const response = await supabase.functions.invoke("create-aluno-user", {
        body: {
          email,
          password: senha,
          fullName: nome,
          churchId,
        },
      });

      if (response.error) {
        console.error("Edge function error:", response.error);
        throw new Error(response.error.message || "Erro ao criar usuário");
      }

      const { userId } = response.data;
      if (!userId) {
        throw new Error("Erro ao criar usuário: ID não retornado");
      }

      // 2. Upload avatar if provided
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${userId}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("ebd-assets")
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          // Continue without avatar
        } else {
          const {
            data: { publicUrl },
          } = supabase.storage.from("ebd-assets").getPublicUrl(filePath);
          avatarUrl = publicUrl;
        }
      }

      // 3. Create ebd_alunos record
      const { error: alunoError } = await supabase.from("ebd_alunos").insert({
        church_id: churchId,
        nome_completo: nome,
        email,
        telefone: whatsapp || null,
        data_nascimento: dataNascimento || null,
        avatar_url: avatarUrl,
        user_id: userId,
        is_active: true,
      });

      if (alunoError) {
        console.error("Error creating aluno:", alunoError);
        throw alunoError;
      }

      return { userId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebd-alunos"] });
      toast.success("Aluno cadastrado com sucesso!");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error("Cadastro error:", error);
      toast.error(error.message || "Erro ao cadastrar aluno");
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Aluno</DialogTitle>
          <DialogDescription>
            Preencha os dados do aluno. Email e senha serão usados para acesso
            ao sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarPreview || undefined} />
              <AvatarFallback>
                <User className="h-10 w-10" />
              </AvatarFallback>
            </Avatar>
            <Label
              htmlFor="avatar-upload"
              className="cursor-pointer flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Upload className="h-4 w-4" />
              Adicionar Foto
            </Label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome Completo *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite o nome completo"
            />
            {errors.nome && (
              <p className="text-sm text-destructive">{errors.nome}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <Label htmlFor="senha">Senha *</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
            {errors.senha && (
              <p className="text-sm text-destructive">{errors.senha}</p>
            )}
          </div>

          {/* WhatsApp */}
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          {/* Data de Nascimento */}
          <div className="space-y-2">
            <Label htmlFor="dataNascimento">Data de Aniversário</Label>
            <Input
              id="dataNascimento"
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => cadastrarAlunoMutation.mutate()}
            disabled={cadastrarAlunoMutation.isPending}
          >
            {cadastrarAlunoMutation.isPending ? "Cadastrando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
