import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, X } from "lucide-react";

interface ContratoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato?: {
    id: string;
    autor: { id: string; nome_completo: string } | null;
    livro: { id: string; titulo: string } | null;
    pdf_url: string | null;
    data_inicio: string;
    data_termino: string;
    termos_contrato: string | null;
    is_active: boolean;
  } | null;
}

export function ContratoDialog({ open, onOpenChange, contrato }: ContratoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    autor_id: "",
    livro_id: "",
    pdf_url: null as string | null,
    data_inicio: "",
    data_termino: "",
    termos_contrato: "",
  });

  // Fetch authors
  const { data: autores = [] } = useQuery({
    queryKey: ["royalties-autores-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_autores")
        .select("id, nome_completo")
        .eq("is_active", true)
        .order("nome_completo");

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch books filtered by author
  const { data: livros = [] } = useQuery({
    queryKey: ["royalties-livros-by-author", formData.autor_id],
    queryFn: async () => {
      if (!formData.autor_id) return [];

      const { data, error } = await supabase
        .from("royalties_livros")
        .select("id, titulo")
        .eq("autor_id", formData.autor_id)
        .eq("is_active", true)
        .order("titulo");

      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.autor_id,
  });

  useEffect(() => {
    if (open) {
      if (contrato) {
        setFormData({
          autor_id: contrato.autor?.id || "",
          livro_id: contrato.livro?.id || "",
          pdf_url: contrato.pdf_url || null,
          data_inicio: contrato.data_inicio || "",
          data_termino: contrato.data_termino || "",
          termos_contrato: contrato.termos_contrato || "",
        });
      } else {
        setFormData({
          autor_id: "",
          livro_id: "",
          pdf_url: null,
          data_inicio: "",
          data_termino: "",
          termos_contrato: "",
        });
      }
    }
  }, [contrato, open]);

  // Reset livro_id when author changes
  useEffect(() => {
    if (!contrato) {
      setFormData((prev) => ({ ...prev, livro_id: "" }));
    }
  }, [formData.autor_id, contrato]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "Erro",
        description: "Apenas arquivos PDF são permitidos.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "O arquivo deve ter no máximo 10MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = `contratos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("royalties-contratos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("royalties-contratos")
        .getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, pdf_url: urlData.publicUrl }));
      toast({ title: "PDF enviado com sucesso!" });
    } catch (error: any) {
      console.error("Erro ao enviar PDF:", error);
      toast({
        title: "Erro ao enviar PDF",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePdf = () => {
    setFormData((prev) => ({ ...prev, pdf_url: null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.autor_id || !formData.livro_id) {
      toast({
        title: "Erro de validação",
        description: "Selecione o autor e o livro.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.data_inicio || !formData.data_termino) {
      toast({
        title: "Erro de validação",
        description: "Informe as datas de início e término.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        autor_id: formData.autor_id,
        livro_id: formData.livro_id,
        pdf_url: formData.pdf_url,
        data_inicio: formData.data_inicio,
        data_termino: formData.data_termino,
        termos_contrato: formData.termos_contrato.trim() || null,
      };

      if (contrato?.id) {
        const { error } = await supabase
          .from("royalties_contratos")
          .update(payload)
          .eq("id", contrato.id);

        if (error) throw error;
        toast({ title: "Contrato atualizado com sucesso!" });
      } else {
        const { error } = await supabase
          .from("royalties_contratos")
          .insert(payload);

        if (error) throw error;
        toast({ title: "Contrato cadastrado com sucesso!" });

        // Enviar email automático de novo contrato (background)
        const livroSelecionado = livros.find((l) => l.id === formData.livro_id);
        supabase.functions.invoke("send-royalties-email", {
          body: {
            autorId: formData.autor_id,
            templateCode: "contrato_novo",
            tipoEnvio: "automatico",
            dados: {
              livro: livroSelecionado?.titulo || "—",
              data_inicio: formData.data_inicio,
              data_termino: formData.data_termino,
            },
          },
        }).catch(console.error);
      }

      queryClient.invalidateQueries({ queryKey: ["royalties-contratos"] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar contrato:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {contrato ? "Editar Contrato" : "Novo Contrato"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="autor_id">Autor *</Label>
              <Select
                value={formData.autor_id}
                onValueChange={(value) => setFormData({ ...formData, autor_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o autor" />
                </SelectTrigger>
                <SelectContent>
                  {autores.map((autor) => (
                    <SelectItem key={autor.id} value={autor.id}>
                      {autor.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="livro_id">Livro *</Label>
              <Select
                value={formData.livro_id}
                onValueChange={(value) => setFormData({ ...formData, livro_id: value })}
                disabled={!formData.autor_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.autor_id ? "Selecione o livro" : "Selecione o autor primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {livros.map((livro) => (
                    <SelectItem key={livro.id} value={livro.id}>
                      {livro.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_inicio">Data de Início *</Label>
              <Input
                id="data_inicio"
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_termino">Data de Término *</Label>
              <Input
                id="data_termino"
                type="date"
                value={formData.data_termino}
                onChange={(e) => setFormData({ ...formData, data_termino: e.target.value })}
                required
              />
            </div>
          </div>

          {/* PDF Upload */}
          <div className="space-y-2">
            <Label>Contrato PDF</Label>
            {formData.pdf_url ? (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                <FileText className="h-5 w-5 text-primary" />
                <span className="flex-1 text-sm truncate">PDF anexado</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemovePdf}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  id="pdf_upload"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("pdf_upload")?.click()}
                  disabled={uploading}
                  className="w-full"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? "Enviando..." : "Anexar PDF do Contrato"}
                </Button>
              </div>
            )}
          </div>

          {/* Terms textarea for BI */}
          <div className="space-y-2">
            <Label htmlFor="termos_contrato">
              Termos do Contrato
              <span className="text-muted-foreground text-xs ml-2">
                (Cole aqui os termos para análise via Business Intelligence)
              </span>
            </Label>
            <Textarea
              id="termos_contrato"
              value={formData.termos_contrato}
              onChange={(e) => setFormData({ ...formData, termos_contrato: e.target.value })}
              placeholder="Cole aqui os termos e cláusulas do contrato..."
              rows={8}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : contrato ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
