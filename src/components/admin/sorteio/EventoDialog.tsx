import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Upload, Image as ImageIcon } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento?: any | null;
}

const initial = {
  nome: "",
  slug: "",
  banner_url: "",
  imagem_premio_url: "",
  titulo: "",
  subtitulo: "",
  descricao: "",
  premio_destaque: "",
  cor_primaria: "#D4AF37",
  texto_botao_cta: "Quero participar",
  mostrar_campo_embaixadora: true,
  data_inicio: "",
  data_fim: "",
  ativo: false,
};

export default function EventoDialog({ open, onOpenChange, evento }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (evento) {
      setForm({
        nome: evento.nome ?? "",
        slug: evento.slug ?? "",
        banner_url: evento.banner_url ?? "",
        imagem_premio_url: evento.imagem_premio_url ?? "",
        titulo: evento.titulo ?? "",
        subtitulo: evento.subtitulo ?? "",
        descricao: evento.descricao ?? "",
        premio_destaque: evento.premio_destaque ?? "",
        cor_primaria: evento.cor_primaria ?? "#D4AF37",
        texto_botao_cta: evento.texto_botao_cta ?? "Quero participar",
        mostrar_campo_embaixadora: evento.mostrar_campo_embaixadora ?? true,
        data_inicio: evento.data_inicio ? evento.data_inicio.slice(0, 16) : "",
        data_fim: evento.data_fim ? evento.data_fim.slice(0, 16) : "",
        ativo: evento.ativo ?? false,
      });
    } else {
      setForm(initial);
    }
  }, [evento, open]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${Date.now()}_${safeName}`;
      const { error } = await supabase.storage.from("sorteio-banners").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("sorteio-banners").getPublicUrl(path);
      setForm((f) => ({ ...f, banner_url: data.publicUrl }));
      toast.success("Banner enviado!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar banner");
    } finally {
      setUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome do evento é obrigatório");
      const payload: any = {
        nome: form.nome.trim(),
        slug: form.slug.trim() || null,
        banner_url: form.banner_url.trim() || null,
        titulo: form.titulo.trim() || null,
        subtitulo: form.subtitulo.trim() || null,
        descricao: form.descricao.trim() || null,
        premio_destaque: form.premio_destaque.trim() || null,
        cor_primaria: form.cor_primaria || "#D4AF37",
        texto_botao_cta: form.texto_botao_cta.trim() || "Quero participar",
        mostrar_campo_embaixadora: form.mostrar_campo_embaixadora,
        data_inicio: form.data_inicio ? new Date(form.data_inicio).toISOString() : null,
        data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
        ativo: form.ativo,
      };
      if (evento?.id) {
        const { error } = await supabase.from("sorteio_eventos" as any).update(payload).eq("id", evento.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sorteio_eventos" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sorteio-eventos"] });
      queryClient.invalidateQueries({ queryKey: ["sorteio-evento-ativo"] });
      toast.success(evento ? "Evento atualizado!" : "Evento criado!");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar evento"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{evento ? "Editar Evento" : "Novo Evento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nome do evento *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Congresso Leoas" />
            </div>
            <div>
              <Label>Slug (URL amigável)</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.replace(/[^a-z0-9-]/g, "") })} placeholder="congresso-leoas" />
            </div>
          </div>

          <div>
            <Label>Banner do evento</Label>
            <div className="flex items-center gap-3">
              <Input value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} placeholder="URL da imagem" />
              <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </div>
            {form.banner_url && (
              <div className="mt-2 rounded-md overflow-hidden border bg-muted">
                <img src={form.banner_url} alt="Preview" className="w-full max-h-40 object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              </div>
            )}
            {!form.banner_url && (
              <div className="mt-2 rounded-md border border-dashed p-6 text-center text-muted-foreground">
                <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                <p className="text-xs">Nenhum banner. Envie ou cole uma URL.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Título principal</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Congresso Leoas 2026" />
            </div>
            <div>
              <Label>Subtítulo</Label>
              <Input value={form.subtitulo} onChange={(e) => setForm({ ...form, subtitulo: e.target.value })} placeholder="Ex: Participe do nosso sorteio" />
            </div>
          </div>

          <div>
            <Label>Descrição / Local / Data (texto de credibilidade)</Label>
            <Textarea
              rows={2}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex: 25 e 26 de abril • Rua Montevidéu, 900 — Penha, RJ"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Prêmio em destaque</Label>
              <Input value={form.premio_destaque} onChange={(e) => setForm({ ...form, premio_destaque: e.target.value })} placeholder="Ex: Kit Gotas de Consolo" />
            </div>
            <div>
              <Label>Texto do botão CTA</Label>
              <Input value={form.texto_botao_cta} onChange={(e) => setForm({ ...form, texto_botao_cta: e.target.value })} placeholder="Quero participar" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Cor primária</Label>
              <div className="flex gap-2">
                <Input type="color" value={form.cor_primaria} onChange={(e) => setForm({ ...form, cor_primaria: e.target.value })} className="w-14 p-1 h-10" />
                <Input value={form.cor_primaria} onChange={(e) => setForm({ ...form, cor_primaria: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Data de início</Label>
              <Input type="datetime-local" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Data de fim</Label>
              <Input type="datetime-local" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center justify-between border rounded-md p-3">
            <div>
              <Label className="text-sm">Mostrar campo "Quero ser embaixadora"</Label>
              <p className="text-xs text-muted-foreground">Exibe o convite para virar embaixadora no cadastro</p>
            </div>
            <Switch checked={form.mostrar_campo_embaixadora} onCheckedChange={(v) => setForm({ ...form, mostrar_campo_embaixadora: v })} />
          </div>

          <div className="flex items-center justify-between border rounded-md p-3 bg-primary/5">
            <div>
              <Label className="text-sm">Ativar este evento (exibir em /sorteio)</Label>
              <p className="text-xs text-muted-foreground">Apenas 1 evento ativo por vez. Os outros serão desativados automaticamente.</p>
            </div>
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
