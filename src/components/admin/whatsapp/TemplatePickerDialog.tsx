import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, FileText, ArrowLeft, Send } from "lucide-react";

interface Template {
  id: string;
  nome: string;
  categoria: string | null;
  idioma: string;
  status: string;
  corpo: string;
  cabecalho_tipo: string | null;
  cabecalho_midia_url: string | null;
  variaveis_usadas: string[] | null;
  botoes: any;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  telefone: string;
  contactName: string;
  onSent: () => void;
}

export default function TemplatePickerDialog({
  open,
  onOpenChange,
  telefone,
  contactName,
  onSent,
}: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Template | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [buttonSuffix, setButtonSuffix] = useState("");
  const [sending, setSending] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["whatsapp-templates-aprovados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .in("status", ["APROVADO", "APPROVED"])
        .order("nome");
      if (error) throw error;
      return (data || []) as Template[];
    },
    enabled: open,
  });

  // Reset ao abrir/fechar
  useEffect(() => {
    if (!open) {
      setSelected(null);
      setSearch("");
      setVarValues({});
      setButtonSuffix("");
    }
  }, [open]);

  // Pré-preenche variáveis ao escolher template
  useEffect(() => {
    if (!selected) return;
    const firstName = (contactName || "Cliente").split(" ")[0];
    const init: Record<string, string> = {};
    (selected.variaveis_usadas || []).forEach((v) => {
      const key = String(v).replace(/\{\{|\}\}/g, "").trim();
      const lower = key.toLowerCase();
      if (
        ["primeiro_nome", "nome_comprador", "nome_completo", "lead_nome", "nome", "1"].includes(lower)
      ) {
        init[key] = firstName;
      } else {
        init[key] = "";
      }
    });
    setVarValues(init);

    const phoneDigits = telefone.replace(/\D/g, "").replace(/^55/, "");
    setButtonSuffix(phoneDigits);
  }, [selected, contactName, telefone]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.nome.toLowerCase().includes(q) ||
        (t.categoria || "").toLowerCase().includes(q),
    );
  }, [templates, search]);

  const previewBody = useMemo(() => {
    if (!selected) return "";
    let s = selected.corpo || "";
    Object.entries(varValues).forEach(([k, v]) => {
      const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g");
      s = s.replace(re, v || `{{${k}}}`);
    });
    return s;
  }, [selected, varValues]);

  const botoesArr = useMemo(() => {
    if (!selected?.botoes) return [];
    try {
      return typeof selected.botoes === "string"
        ? JSON.parse(selected.botoes)
        : selected.botoes;
    } catch {
      return [];
    }
  }, [selected]);

  const hasUrlDinamica = botoesArr.some(
    (b: any) => b.tipo === "URL" && b.url_dinamica === true,
  );

  const handleSend = async () => {
    if (!selected) return;
    // Validar variáveis preenchidas
    const missing = Object.entries(varValues).filter(([_, v]) => !v.trim());
    if (missing.length > 0) {
      toast.error(`Preencha: ${missing.map((m) => m[0]).join(", ")}`);
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "whatsapp-send-template-avulso",
        {
          body: {
            telefone,
            template_id: selected.id,
            variable_values: varValues,
            button_dynamic_suffix: hasUrlDinamica ? buttonSuffix : undefined,
            nome_destino: contactName,
          },
        },
      );
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Template enviado!");
      onSent();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Falha ao enviar: " + (e.message || e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selected && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <FileText className="h-5 w-5" />
            {selected ? `Template: ${selected.nome}` : "Selecionar Template"}
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar template..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="flex-1 max-h-[55vh] pr-3">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum template aprovado encontrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t)}
                      className="w-full text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{t.nome}</span>
                        {t.categoria && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t.categoria}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {t.idioma}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                        {t.corpo}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <>
            <ScrollArea className="flex-1 max-h-[60vh] pr-3">
              <div className="space-y-4">
                {(selected.variaveis_usadas || []).length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Variáveis</Label>
                    {(selected.variaveis_usadas || []).map((v) => {
                      const key = String(v).replace(/\{\{|\}\}/g, "").trim();
                      return (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs">{`{{${key}}}`}</Label>
                          <Input
                            value={varValues[key] || ""}
                            onChange={(e) =>
                              setVarValues((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            placeholder={`Valor para ${key}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {hasUrlDinamica && (
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Sufixo da URL dinâmica do botão
                    </Label>
                    <Input
                      value={buttonSuffix}
                      onChange={(e) => setButtonSuffix(e.target.value)}
                      placeholder="ex: 11999999999"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Será concatenado à URL base do botão configurada no Meta.
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Pré-visualização</Label>
                  <div className="border rounded-lg p-3 bg-muted/30">
                    {selected.cabecalho_tipo === "IMAGE" &&
                      selected.cabecalho_midia_url && (
                        <img
                          src={selected.cabecalho_midia_url}
                          alt="cabeçalho"
                          className="rounded-md mb-2 max-h-40 object-cover"
                        />
                      )}
                    <p className="text-sm whitespace-pre-wrap">{previewBody}</p>
                    {botoesArr.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {botoesArr.map((b: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            🔗 {b.texto}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Enviando para: <span className="font-mono">{telefone}</span>
                  {contactName && ` • ${contactName}`}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={sending}
              >
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar template
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
