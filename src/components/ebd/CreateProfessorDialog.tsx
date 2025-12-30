import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, User, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageCropDialog } from "@/components/financial/ImageCropDialog";

interface CreateProfessorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
}

export function CreateProfessorDialog({ open, onOpenChange, churchId }: CreateProfessorDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    nome_completo: "",
    email: "",
    telefone: "",
    avatar_url: "",
    senha: "",
    confirmarSenha: "",
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImage: Blob) => {
    setShowCropDialog(false);
    setUploadingImage(true);

    try {
      const fileName = `ebd/${churchId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(fileName, croppedImage, { contentType: "image/jpeg", upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-avatars").getPublicUrl(fileName);

      setFormData((prev) => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Foto adicionada!");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploadingImage(false);
      setSelectedImage(null);
    }
  };

  const resetForm = () => {
    setFormData({
      nome_completo: "",
      email: "",
      telefone: "",
      avatar_url: "",
      senha: "",
      confirmarSenha: "",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      // Validate email and password
      if (!formData.email.trim()) {
        throw new Error("Email é obrigatório para criar acesso ao sistema");
      }

      if (!formData.senha.trim()) {
        throw new Error("Senha é obrigatória");
      }

      if (formData.senha.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }

      if (formData.senha !== formData.confirmarSenha) {
        throw new Error("As senhas não coincidem");
      }

      // Create auth user first
      const { data: userData, error: userError } = await supabase.functions.invoke('create-professor-user', {
        body: {
          email: formData.email.trim(),
          password: formData.senha,
          fullName: formData.nome_completo.trim(),
          churchId,
        },
      });

      if (userError) {
        console.error("Error creating professor user:", userError);
        throw new Error(userError.message || "Erro ao criar usuário");
      }

      if (!userData?.userId) {
        throw new Error("Falha ao criar usuário - ID não retornado");
      }

      // Insert professor record with user_id
      const { error } = await supabase.from("ebd_professores").insert({
        church_id: churchId,
        nome_completo: formData.nome_completo,
        email: formData.email || null,
        telefone: formData.telefone || null,
        avatar_url: formData.avatar_url || null,
        is_active: true,
        user_id: userData.userId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebd-professores"] });
      toast.success("Professor cadastrado com sucesso!");
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      console.error("Erro ao cadastrar professor:", error);
      toast.error(error.message || "Erro ao cadastrar professor");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome_completo.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    createMutation.mutate();
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) {
            setSelectedImage(null);
            setShowCropDialog(false);
            setUploadingImage(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Professor</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={formData.avatar_url || undefined} alt="Foto do professor" />
                  <AvatarFallback>
                    <User className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 cursor-pointer hover:bg-primary/90">
                  {uploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                    disabled={uploadingImage}
                  />
                </label>
              </div>
              <span className="text-xs text-muted-foreground">Clique para adicionar foto (opcional)</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={formData.nome_completo}
                onChange={(e) => setFormData((prev) => ({ ...prev, nome_completo: e.target.value }))}
                placeholder="Nome do professor"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="email@exemplo.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone/WhatsApp</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData((prev) => ({ ...prev, telefone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha *</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={showPassword ? "text" : "password"}
                  value={formData.senha}
                  onChange={(e) => setFormData((prev) => ({ ...prev, senha: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmarSenha">Confirmar Senha *</Label>
              <div className="relative">
                <Input
                  id="confirmarSenha"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmarSenha}
                  onChange={(e) => setFormData((prev) => ({ ...prev, confirmarSenha: e.target.value }))}
                  placeholder="Repita a senha"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              O professor usará o email e senha para acessar a área do professor.
            </p>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ImageCropDialog
        open={showCropDialog}
        onOpenChange={setShowCropDialog}
        imageSrc={selectedImage || ""}
        onCropComplete={handleCropComplete}
      />
    </>
  );
}
