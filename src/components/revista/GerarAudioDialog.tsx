import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wand2, Save, AudioLines, Volume2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Voz = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
const VOZES: Voz[] = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

interface LicaoAudioInfo {
  id: string;
  titulo: string | null;
  numero: number;
  transcricao_audio: string | null;
  audio_url: string | null;
  audio_voz: string | null;
  transcricao_gerada_em: string | null;
  audio_gerado_em: string | null;
}

interface Props {
  licaoId: string;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function GerarAudioDialog({ licaoId, open, onClose, onUpdated }: Props) {
  const [licao, setLicao] = useState<LicaoAudioInfo | null>(null);
  const [tab, setTab] = useState("transcricao");
  const [transcricao, setTranscricao] = useState("");
  const [voz, setVoz] = useState<Voz>("nova");

  const [transcrevendo, setTranscrevendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerandoAudio, setGerandoAudio] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("revista_licoes")
        .select("id, titulo, numero, transcricao_audio, audio_url, audio_voz, transcricao_gerada_em, audio_gerado_em")
        .eq("id", licaoId)
        .maybeSingle();
      if (data) {
        setLicao(data as LicaoAudioInfo);
        setTranscricao(data.transcricao_audio ?? "");
        if (data.audio_voz) setVoz(data.audio_voz as Voz);
      }
    })();
  }, [open, licaoId]);

  const totalChars = transcricao.length;
  // TTS-HD: $30/M chars  ≈ R$ 0,000165/char (USD 5.5)
  const custoBRL = (totalChars * 0.00003 * 5.5).toFixed(2);

  const audioDesatualizado = !!(
    licao?.audio_gerado_em &&
    licao?.transcricao_gerada_em &&
    new Date(licao.transcricao_gerada_em) > new Date(licao.audio_gerado_em)
  );

  async function handleTranscrever() {
    setTranscrevendo(true);
    try {
      const { data, error } = await supabase.functions.invoke("licao-transcrever", {
        body: { licao_id: licaoId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha na transcrição");
      setTranscricao(data.transcricao);
      toast.success(`Transcrição pronta (${data.total_caracteres.toLocaleString("pt-BR")} caracteres)`);
      // refresh licao info
      const { data: l } = await supabase
        .from("revista_licoes")
        .select("transcricao_gerada_em")
        .eq("id", licaoId)
        .maybeSingle();
      if (l && licao) setLicao({ ...licao, transcricao_gerada_em: l.transcricao_gerada_em });
      onUpdated?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao transcrever");
    } finally {
      setTranscrevendo(false);
    }
  }

  async function handleSalvarTranscricao() {
    setSalvando(true);
    try {
      const { error } = await supabase
        .from("revista_licoes")
        .update({
          transcricao_audio: transcricao,
          transcricao_gerada_em: new Date().toISOString(),
        })
        .eq("id", licaoId);
      if (error) throw error;
      toast.success("Transcrição salva");
      if (licao) setLicao({ ...licao, transcricao_audio: transcricao, transcricao_gerada_em: new Date().toISOString() });
      onUpdated?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/licao-tts-preview`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ voz }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "Falha no preview");
      }
      const blob = await r.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao tocar preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleGerarAudio() {
    if (!transcricao.trim()) {
      toast.error("Salve a transcrição antes de gerar áudio");
      return;
    }
    setGerandoAudio(true);
    try {
      const { data, error } = await supabase.functions.invoke("licao-gerar-audio", {
        body: { licao_id: licaoId, voz },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao gerar áudio");
      toast.success("Áudio gerado!");
      onUpdated?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar áudio");
    } finally {
      setGerandoAudio(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AudioLines className="h-5 w-5" />
            Gerar Áudio — Lição {licao?.numero} {licao?.titulo ? `— ${licao.titulo}` : ""}
          </DialogTitle>
        </DialogHeader>

        {audioDesatualizado && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Transcrição foi editada após o último áudio. Recomendado regerar.</span>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="transcricao">1. Transcrição</TabsTrigger>
            <TabsTrigger value="audio">2. Gerar áudio</TabsTrigger>
          </TabsList>

          <TabsContent value="transcricao" className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={handleTranscrever}
                disabled={transcrevendo}
                className="gap-2"
                style={{ backgroundColor: "#FFC107", color: "#000" }}
              >
                {transcrevendo ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Lendo páginas... pode levar 30-60s</>
                ) : (
                  <><Wand2 className="h-4 w-4" /> Extrair texto das imagens com IA</>
                )}
              </Button>
              <Button onClick={handleSalvarTranscricao} disabled={salvando || !transcricao.trim()} variant="outline" className="gap-2">
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar transcrição
              </Button>
              <Button onClick={() => setTab("audio")} variant="secondary" disabled={!transcricao.trim()}>
                Próximo: Gerar áudio →
              </Button>
            </div>

            <Textarea
              value={transcricao}
              onChange={(e) => setTranscricao(e.target.value)}
              placeholder="A transcrição aparecerá aqui após a extração. Você pode editar livremente antes de gerar o áudio."
              className="min-h-[480px] font-mono text-sm"
            />

            <div className="text-xs text-muted-foreground flex justify-between">
              <span>{totalChars.toLocaleString("pt-BR")} caracteres</span>
              <span>Custo estimado TTS-HD: ≈ R$ {custoBRL}</span>
            </div>
          </TabsContent>

          <TabsContent value="audio" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Voz</label>
              <div className="flex gap-2">
                <Select value={voz} onValueChange={(v) => setVoz(v as Voz)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOZES.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handlePreview} variant="outline" disabled={previewLoading} className="gap-2">
                  {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                  Pré-ouvir esta voz
                </Button>
              </div>
            </div>

            {licao?.audio_url && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Áudio atual</label>
                <audio controls src={licao.audio_url} className="w-full" />
              </div>
            )}

            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <strong>{totalChars.toLocaleString("pt-BR")} caracteres</strong> serão sintetizados com tts-1-hd.
              Custo estimado: <strong>R$ {custoBRL}</strong>.
            </div>

            <Button
              onClick={handleGerarAudio}
              disabled={gerandoAudio || !transcricao.trim()}
              className="w-full gap-2 h-12 text-base"
              style={{ backgroundColor: "#FFC107", color: "#000" }}
            >
              {gerandoAudio ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Gerando áudio... pode levar 1-2 min</>
              ) : (
                <><AudioLines className="h-5 w-5" /> {licao?.audio_url ? "Regerar áudio final" : "Gerar áudio final"}</>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
