import { useState, useEffect } from "react";
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

interface Professor {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  user_id?: string | null;
}

interface EditProfessorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professor: Professor | null;
  churchId: string;
}

export function EditProfessorDialog({ open, onOpenChange, professor, churchId }: EditProfessorDialogProps) {
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

  useEffect(() => {
    if (professor) {
      setFormData({
        nome_completo: professor.nome_completo || "",
        email: professor.email || "",
        telefone: professor.telefone || "",
        avatar_url: professor.avatar_url || "",
        senha: "",
        confirmarSenha: "",
      });
    }
  }, [professor]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
    }
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

      const { data: { publicUrl } } = supabase.storage
        .from("profile-avatars")
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Foto atualizada!");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploadingImage(false);
      setSelectedImage(null);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!professor) throw new Error("Professor não encontrado");

      // Validate password if provided
      if (formData.senha) {
        if (formData.senha.length < 6) {
          throw new Error("A senha deve ter pelo menos 6 caracteres");
        }
        if (formData.senha !== formData.confirmarSenha) {
          throw new Error("As senhas não coincidem");
        }
      }

      // If changing password or creating user for existing professor
      if (formData.senha && formData.email) {
        const { data: userData, error: userError } = await supabase.functions.invoke('create-professor-user', {
          body: {
            email: formData.email.trim(),
            password: formData.senha,
            fullName: formData.nome_completo.trim(),
            churchId,
          },
        });

        if (userError) {
          console.error("Error updating professor user:", userError);
          throw new Error(userError.message || "Erro ao atualizar usuário");
        }

        // Update professor with user_id if new user was created
        if (userData?.userId && !professor.user_id) {
          const { error: updateError } = await supabase
            .from("ebd_professores")
            .update({
              nome_completo: formData.nome_completo,
              email: formData.email || null,
              telefone: formData.telefone || null,
              avatar_url: formData.avatar_url || null,
              user_id: userData.userId,
            })
            .eq("id", professor.id);

          if (updateError) throw updateError;
          return;
        }
      }

      // Regular update without password change
      const { error } = await supabase
        .from("ebd_professores")
        .update({
          nome_completo: formData.nome_completo,
          email: formData.email || null,
          telefone: formData.telefone || null,
          avatar_url: formData.avatar_url || null,
        })
        .eq("id", professor.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebd-professores"] });
      toast.success("Professor atualizado com sucesso!");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("Erro ao atualizar professor:", error);
      toast.error(error.message || "Erro ao atualizar professor");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome_completo.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    updateMutation.mutate();
  };

  const hasUserAccess = !!professor?.user_id;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Professor</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={formData.avatar_url || undefined} />
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
              <span className="text-xs text-muted-foreground">Clique para alterar foto</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={formData.nome_completo}
                onChange={(e) => setFormData(prev => ({ ...prev, nome_completo: e.target.value }))}
                placeholder="Nome do professor"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone/WhatsApp</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-2">
                {hasUserAccess ? "Alterar Senha de Acesso" : "Criar Acesso ao Sistema"}
              </p>
              {!hasUserAccess && (
                <p className="text-xs text-muted-foreground mb-3">
                  Preencha os campos abaixo para criar acesso ao sistema para este professor.
                </p>
              )}
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="senha">{hasUserAccess ? "Nova Senha" : "Senha *"}</Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={showPassword ? "text" : "password"}
                      value={formData.senha}
                      onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))}
                      placeholder={hasUserAccess ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
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
                  <Label htmlFor="confirmarSenha">Confirmar Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmarSenha"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmarSenha}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmarSenha: e.target.value }))}
                      placeholder="Repita a senha"
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
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
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
