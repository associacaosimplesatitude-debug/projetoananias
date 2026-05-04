import { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Wrench, Download, FileIcon, X, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useImplementacoes, type Implementacao } from "@/hooks/useImplementacoes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface Anexo {
  id: string;
  nome_arquivo: string;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ImplementacoesModal({ open, onOpenChange }: Props) {
  const { novidades, naoLidasCount, totalPorTipo, marcarComoLida, marcarTodasComoLidas } = useImplementacoes();
  const [tab, setTab] = useState<"nova_funcao" | "correcao">("nova_funcao");
  const [filter, setFilter] = useState<"nao_lidas" | "lidas" | "todas">("nao_lidas");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const porTipo = useMemo(() => novidades.filter((n) => n.tipo === tab), [novidades, tab]);
  const counts = useMemo(() => ({
    nao_lidas: porTipo.filter((n) => !n.lida).length,
    lidas: porTipo.filter((n) => n.lida).length,
    todas: porTipo.length,
  }), [porTipo]);

  const filteredList = useMemo(() => {
    if (filter === "nao_lidas") return porTipo.filter((n) => !n.lida);
    if (filter === "lidas") return porTipo.filter((n) => n.lida);
    return porTipo;
  }, [porTipo, filter]);

  const selected = novidades.find((n) => n.id === selectedId) || filteredList[0] || null;

  const { data: anexos = [] } = useQuery({
    queryKey: ["impl-attachments", selected?.id],
    queryFn: async () => {
      if (!selected?.id) return [];
      const { data, error } = await (supabase as any)
        .from("implementacoes_attachments")
        .select("id, nome_arquivo, storage_path, mime_type, tamanho_bytes")
        .eq("implementacao_id", selected.id)
        .order("created_at");
      if (error) throw error;
      return (data || []) as Anexo[];
    },
    enabled: !!selected?.id && open,
  });

  const handleSelect = (n: Implementacao) => {
    setSelectedId(n.id);
    if (!n.lida) marcarComoLida.mutate(n.id);
  };

  const handleDownload = async (a: Anexo) => {
    const { data, error } = await supabase.storage
      .from("implementacoes-attachments")
      .createSignedUrl(a.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar o link de download");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] w-[95vw] h-[80vh] p-0 flex flex-col gap-0 overflow-hidden">
        <div className="flex items-start justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Implementações do sistema
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {naoLidasCount} {naoLidasCount === 1 ? "item não lido" : "itens não lidos"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => marcarTodasComoLidas.mutate()}
              disabled={naoLidasCount === 0 || marcarTodasComoLidas.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Marcar tudo como visto
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-b gap-4 flex-wrap">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="nova_funcao">Novas funções ({totalPorTipo.nova_funcao})</TabsTrigger>
              <TabsTrigger value="correcao">Correções ({totalPorTipo.correcao})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="inline-flex rounded-full border bg-muted p-1 text-xs">
            {([
              { key: "nao_lidas", label: "Não lidas" },
              { key: "lidas", label: "Lidas" },
              { key: "todas", label: "Todas" },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={cn("px-3 py-1 rounded-full transition-colors",
                  filter === opt.key ? "bg-background shadow font-medium" : "text-muted-foreground")}
              >
                {opt.label} ({counts[opt.key]})
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[35%_65%] overflow-hidden">
          <div className="border-r overflow-hidden flex flex-col">
            <ScrollArea className="flex-1">
              {filteredList.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Nenhum item para exibir.</div>
              ) : (
                <ul className="divide-y">
                  {filteredList.map((n) => {
                    const active = selected?.id === n.id;
                    return (
                      <li key={n.id}>
                        <button onClick={() => handleSelect(n)}
                          className={cn("w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                            active && "bg-emerald-50/60")}>
                          <div className="flex items-start gap-2">
                            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full",
                              n.lida ? "bg-muted-foreground/40" : "bg-emerald-500")} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={cn("text-[10px] py-0 px-1.5",
                                  n.tipo === "nova_funcao"
                                    ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                                    : "border-amber-300 text-amber-700 bg-amber-50")}>
                                  {n.tipo === "nova_funcao" ? "Nova função" : "Correção"}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground">{formatDateShort(n.data_publicacao)}</span>
                              </div>
                              <p className={cn("text-sm mt-1 truncate", !n.lida && "font-semibold")}>{n.titulo}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.descricao_curta}</p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>

          <div className="overflow-hidden flex flex-col">
            {selected ? (
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <Badge className={cn(
                      selected.tipo === "nova_funcao"
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                        : "bg-amber-100 text-amber-800 hover:bg-amber-100")}>
                      {selected.tipo === "nova_funcao" ? <Sparkles className="h-3 w-3 mr-1" /> : <Wrench className="h-3 w-3 mr-1" />}
                      {selected.tipo === "nova_funcao" ? "Nova função" : "Correção"}
                    </Badge>
                    {selected.versao && (<Badge variant="outline" className="text-[11px]">{selected.versao}</Badge>)}
                    <span className="text-xs text-muted-foreground">{formatDateLong(selected.data_publicacao)}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full",
                      selected.lida ? "bg-muted text-muted-foreground" : "bg-emerald-100 text-emerald-700")}>
                      {selected.lida ? "Lida" : "Não lida"}
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold leading-tight">{selected.titulo}</h3>
                  <p className="text-base text-muted-foreground mt-2">{selected.descricao_curta}</p>

                  {selected.descricao_completa && (
                    <>
                      <hr className="my-4" />
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{selected.descricao_completa}</ReactMarkdown>
                      </div>
                    </>
                  )}

                  {anexos.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-semibold text-sm mb-2">Anexos</h4>
                      <ul className="space-y-2">
                        {anexos.map((a) => (
                          <li key={a.id} className="flex items-center justify-between gap-3 border rounded-md px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="text-sm truncate">{a.nome_arquivo}</p>
                                <p className="text-xs text-muted-foreground">{formatBytes(a.tamanho_bytes)}</p>
                              </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleDownload(a)}>
                              <Download className="h-4 w-4 mr-1" />Baixar
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Selecione um item ao lado.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
