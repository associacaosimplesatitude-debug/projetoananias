import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, User, Loader2 } from "lucide-react";
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
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

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

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ebd_professores").insert({
        church_id: churchId,
        nome_completo: formData.nome_completo,
        email: formData.email || null,
        telefone: formData.telefone || null,
        avatar_url: formData.avatar_url || null,
        is_active: true,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebd-professores"] });
      toast.success("Professor cadastrado com sucesso!");
      onOpenChange(false);
      setFormData({ nome_completo: "", email: "", telefone: "", avatar_url: "" });
    },
    onError: (error) => {
      console.error("Erro ao cadastrar professor:", error);
      toast.error("Erro ao cadastrar professor");
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
          }
        }}
      >
        <DialogContent className="max-w-md">
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="email@exemplo.com"
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
