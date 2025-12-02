import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageCropDialog } from "@/components/financial/ImageCropDialog";

interface ManualRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  onSuccess: () => void;
}

export default function ManualRegistrationDialog({
  open,
  onOpenChange,
  churchId,
  onSuccess,
}: ManualRegistrationDialogProps) {
  const [formData, setFormData] = useState({
    nome_completo: "",
    data_nascimento: "",
    email: "",
    whatsapp: "",
    password: "",
    avatar_url: "",
  });
  const [isAluno, setIsAluno] = useState(false);
  const [isProfessor, setIsProfessor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("A imagem deve ter no máximo 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setShowCropDialog(true);
      };
      reader.readAsDataURL(file);
    }
    // Reset input value to allow re-selecting the same file
    e.target.value = "";
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    setUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const fileName = `ebd/${churchId}/${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(fileName, croppedImageBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("profile-avatars")
        .getPublicUrl(fileName);

      setFormData({ ...formData, avatar_url: publicUrl });
      toast.success("Foto carregada com sucesso!");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAluno && !isProfessor) {
      toast.error("Selecione pelo menos uma função (Aluno ou Professor)");
      return;
    }

    if (!formData.nome_completo || !formData.data_nascimento || !formData.whatsapp) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (formData.email && !formData.password) {
      toast.error("Digite uma senha para criar as credenciais de acesso");
      return;
    }

    setIsLoading(true);

    try {
      let userId = null;

      // Create user credentials if email and password provided
      if (formData.email && formData.password) {
        const { data, error } = await supabase.functions.invoke("create-ebd-user", {
          body: {
            email: formData.email,
            password: formData.password,
            fullName: formData.nome_completo,
          },
        });

        if (error) throw error;
        userId = data.userId;
      }

      // Activate as Aluno
      if (isAluno) {
        const { error } = await supabase.from("ebd_alunos").insert({
          church_id: churchId,
          user_id: userId,
          nome_completo: formData.nome_completo,
          email: formData.email || null,
          telefone: formData.whatsapp,
          data_nascimento: formData.data_nascimento,
          avatar_url: formData.avatar_url || null,
          is_active: true,
        });

        if (error) throw error;
      }

      // Activate as Professor
      if (isProfessor) {
        const { error } = await supabase.from("ebd_professores").insert({
          church_id: churchId,
          user_id: userId,
          nome_completo: formData.nome_completo,
          email: formData.email || null,
          telefone: formData.whatsapp,
          avatar_url: formData.avatar_url || null,
          is_active: true,
        });

        if (error) throw error;
      }

      toast.success(
        `Cadastro criado como ${[isAluno && "Aluno", isProfessor && "Professor"]
          .filter(Boolean)
          .join(" e ")}!`
      );
      onSuccess();
      onOpenChange(false);
      setFormData({
        nome_completo: "",
        data_nascimento: "",
        email: "",
        whatsapp: "",
        password: "",
        avatar_url: "",
      });
      setIsAluno(false);
      setIsProfessor(false);
    } catch (error: any) {
      console.error("Error creating registration:", error);
      toast.error(error.message || "Erro ao criar cadastro");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cadastro Manual</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Foto de Perfil (Opcional)</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={formData.avatar_url} />
                  <AvatarFallback>
                    <User className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="ebd-avatar-upload"
                    disabled={uploadingImage}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("ebd-avatar-upload")?.click()}
                    disabled={uploadingImage}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadingImage ? "Carregando..." : "Escolher Foto"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome_completo">
                Nome Completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome_completo"
                value={formData.nome_completo}
                onChange={(e) =>
                  setFormData({ ...formData, nome_completo: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_nascimento">
                Data de Nascimento <span className="text-destructive">*</span>
              </Label>
              <Input
                id="data_nascimento"
                type="date"
                value={formData.data_nascimento}
                onChange={(e) =>
                  setFormData({ ...formData, data_nascimento: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">
                WhatsApp <span className="text-destructive">*</span>
              </Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp}
                onChange={(e) =>
                  setFormData({ ...formData, whatsapp: e.target.value })
                }
                required
              />
            </div>

            {formData.email && (
              <div className="space-y-2">
                <Label htmlFor="password">
                  Senha de Acesso <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Necessária para criar credenciais de acesso ao sistema
                </p>
              </div>
            )}

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="aluno-toggle-manual">Cadastrar como Aluno EBD</Label>
                <Switch
                  id="aluno-toggle-manual"
                  checked={isAluno}
                  onCheckedChange={setIsAluno}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="professor-toggle-manual">
                  Cadastrar como Professor EBD
                </Label>
                <Switch
                  id="professor-toggle-manual"
                  checked={isProfessor}
                  onCheckedChange={setIsProfessor}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Cadastrar
              </Button>
            </DialogFooter>
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