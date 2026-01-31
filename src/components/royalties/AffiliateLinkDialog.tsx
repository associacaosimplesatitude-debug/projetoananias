import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface AffiliateLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  autor_id: string;
  livro_id: string;
  comissao_percentual: string;
  link_externo: string;
}

export function AffiliateLinkDialog({ open, onOpenChange }: AffiliateLinkDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    autor_id: "",
    livro_id: "",
    comissao_percentual: "30",
    link_externo: "",
  });

  // Fetch authors
  const { data: autores } = useQuery({
    queryKey: ["royalties-autores-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_autores")
        .select("id, nome_completo")
        .eq("is_active", true)
        .order("nome_completo");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch books filtered by selected author
  const { data: livros } = useQuery({
    queryKey: ["royalties-livros-by-autor", formData.autor_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_livros")
        .select("id, titulo")
        .eq("autor_id", formData.autor_id)
        .eq("is_active", true)
        .order("titulo");
      if (error) throw error;
      return data;
    },
    enabled: open && !!formData.autor_id,
  });

  // Reset livro_id when autor changes
  useEffect(() => {
    setFormData((prev) => ({ ...prev, livro_id: "" }));
  }, [formData.autor_id]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData({
        autor_id: "",
        livro_id: "",
        comissao_percentual: "30",
        link_externo: "",
      });
    }
  }, [open]);

  const generateSlugAndCode = (autorNome: string, livroTitulo: string) => {
    const baseSlug = `${livroTitulo}-${autorNome}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const codigo = `${autorNome.split(" ")[0].toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    return { slug: baseSlug, codigo_afiliado: codigo };
  };

  const handleSubmit = async () => {
    if (!formData.autor_id || !formData.livro_id || !formData.link_externo.trim()) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    const comissao = parseFloat(formData.comissao_percentual);
    if (isNaN(comissao) || comissao < 0 || comissao > 100) {
      toast.error("Comissão deve ser um valor entre 0 e 100.");
      return;
    }

    setIsSubmitting(true);

    try {
      const autor = autores?.find((a) => a.id === formData.autor_id);
      const livro = livros?.find((l) => l.id === formData.livro_id);

      if (!autor || !livro) {
        toast.error("Autor ou livro não encontrado.");
        return;
      }

      const { slug, codigo_afiliado } = generateSlugAndCode(
        autor.nome_completo,
        livro.titulo
      );

      const payload = {
        autor_id: formData.autor_id,
        livro_id: formData.livro_id,
        comissao_percentual: comissao,
        link_externo: formData.link_externo.trim(),
        slug,
        codigo_afiliado,
        is_active: true,
      };

      const { error } = await supabase
        .from("royalties_affiliate_links")
        .insert(payload);

      if (error) throw error;

      toast.success("Link de afiliado criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["affiliate-links-stats"] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao criar link de afiliado:", error);
      toast.error(error.message || "Erro ao criar link de afiliado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Link de Afiliado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="autor">Autor *</Label>
            <Select
              value={formData.autor_id}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, autor_id: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o autor" />
              </SelectTrigger>
              <SelectContent>
                {autores?.map((autor) => (
                  <SelectItem key={autor.id} value={autor.id}>
                    {autor.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="livro">Livro *</Label>
            <Select
              value={formData.livro_id}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, livro_id: value }))
              }
              disabled={!formData.autor_id}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    formData.autor_id
                      ? "Selecione o livro"
                      : "Selecione um autor primeiro"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {livros?.map((livro) => (
                  <SelectItem key={livro.id} value={livro.id}>
                    {livro.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comissao">Comissão (%) *</Label>
            <Input
              id="comissao"
              type="number"
              min="0"
              max="100"
              value={formData.comissao_percentual}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  comissao_percentual: e.target.value,
                }))
              }
              placeholder="30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link">Link da Landing Page *</Label>
            <Input
              id="link"
              type="url"
              value={formData.link_externo}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  link_externo: e.target.value,
                }))
              }
              placeholder="https://..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Cadastrando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
