import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Send, Plus, Trash2, X, Upload, ImageIcon, Info } from "lucide-react";

const CATEGORIAS = [
  { value: "MARKETING", label: "Marketing" },
  { value: "UTILITY", label: "Utilidade" },
  { value: "AUTHENTICATION", label: "Autenticação" },
];

const VARIAVEIS = [
  { key: "nome_completo", label: "Nome Completo", example: "João da Silva" },
  { key: "primeiro_nome", label: "Primeiro Nome", example: "João" },
  { key: "produtos_pedido", label: "Produtos do Pedido", example: "Revista EBD Adultos, Revista EBD Jovens" },
  { key: "data_pedido", label: "Data do Pedido", example: "15/03/2026" },
  { key: "valor_pedido", label: "Valor do Pedido", example: "R$ 149,90" },
  { key: "categoria_produtos", label: "Categoria dos Produtos", example: "Revistas EBD" },
  { key: "cpf", label: "CPF", example: "123.456.789-00" },
  { key: "cnpj", label: "CNPJ", example: "12.345.678/0001-90" },
];

const HEADER_TYPES = [
  { value: "NONE", label: "Nenhum" },
  { value: "TEXT", label: "Texto" },
  { value: "IMAGE", label: "Imagem" },
];

interface TemplateButton {
  tipo: "QUICK_REPLY" | "URL";
  texto: string;
  url?: string;
}

interface TemplateData {
  id?: string;
  nome: string;
  categoria: string;
  idioma: string;
  corpo: string;
  rodape: string;
  botoes: TemplateButton[];
  status?: string;
  cabecalho_tipo?: string | null;
  cabecalho_texto?: string | null;
  cabecalho_midia_url?: string | null;
}

interface WhatsAppTemplateCreatorProps {
  editingTemplate?: TemplateData | null;
  onClose?: () => void;
}

export default function WhatsAppTemplateCreator({ editingTemplate, onClose }: WhatsAppTemplateCreatorProps) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(editingTemplate?.nome || "");
  const [categoria, setCategoria] = useState(editingTemplate?.categoria || "MARKETING");
  const [corpo, setCorpo] = useState(editingTemplate?.corpo || "");
  const [rodape, setRodape] = useState(editingTemplate?.rodape || "");
  const [botoes, setBotoes] = useState<TemplateButton[]>(
    (editingTemplate?.botoes as TemplateButton[]) || []
  );
  const [cabecalhoTipo, setCabecalhoTipo] = useState(editingTemplate?.cabecalho_tipo || "NONE");
  const [cabecalhoTexto, setCabecalhoTexto] = useState(editingTemplate?.cabecalho_texto || "");
  const [cabecalhoMidiaUrl, setCabecalhoMidiaUrl] = useState(editingTemplate?.cabecalho_midia_url || "");
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(editingTemplate?.cabecalho_midia_url || null);

  const toSnakeCase = (str: string) =>
    str.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  const insertVariable = (varKey: string) => {
    const tag = `{{${varKey}}}`;
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newCorpo = corpo.substring(0, start) + tag + corpo.substring(end);
      setCorpo(newCorpo);
      setTimeout(() => {
        ta.focus();
        const pos = start + tag.length;
        ta.setSelectionRange(pos, pos);
      }, 0);
    } else {
      setCorpo((prev) => prev + tag);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Formato inválido. Use JPEG ou PNG.");
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo permitido: 5 MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `template-header-${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from("whatsapp-media")
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("whatsapp-media")
        .getPublicUrl(data.path);

      setCabecalhoMidiaUrl(urlData.publicUrl);
      setImagePreview(urlData.publicUrl);
      toast.success("Imagem enviada!");
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setCabecalhoMidiaUrl("");
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addButton = () => {
    if (botoes.length >= 3) return;
    setBotoes([...botoes, { tipo: "QUICK_REPLY", texto: "" }]);
  };

  const removeButton = (idx: number) => {
    setBotoes(botoes.filter((_, i) => i !== idx));
  };

  const updateButton = (idx: number, field: string, value: string) => {
    const updated = [...botoes];
    (updated[idx] as any)[field] = value;
    setBotoes(updated);
  };

  const getUsedVariables = (): string[] => {
    const matches = corpo.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
  };

  const getPreviewText = () => {
    let text = corpo;
    VARIAVEIS.forEach((v) => {
      text = text.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, "g"), v.example);
    });
    return text;
  };

  const buildPayload = async (status: string) => ({
    nome: toSnakeCase(nome),
    categoria,
    idioma: "pt_BR",
    corpo,
    rodape: rodape || null,
    botoes: JSON.stringify(botoes),
    variaveis_usadas: getUsedVariables(),
    cabecalho_tipo: cabecalhoTipo === "NONE" ? null : cabecalhoTipo,
    cabecalho_texto: cabecalhoTipo === "TEXT" ? cabecalhoTexto : null,
    cabecalho_midia_url: cabecalhoTipo === "IMAGE" ? cabecalhoMidiaUrl : null,
    status,
    created_by: (await supabase.auth.getUser()).data.user?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (status: string) => {
      const payload = await buildPayload(status);

      if (editingTemplate?.id) {
        const { error } = await supabase
          .from("whatsapp_templates")
          .update(payload)
          .eq("id", editingTemplate.id);
        if (error) throw error;
        return editingTemplate.id;
      } else {
        const { data, error } = await supabase
          .from("whatsapp_templates")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Rascunho salvo!");
      if (onClose) onClose();
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const submitToMeta = useMutation({
    mutationFn: async () => {
      const payload = await buildPayload("RASCUNHO");

      let templateId = editingTemplate?.id;
      if (templateId) {
        const { error } = await supabase.from("whatsapp_templates").update(payload).eq("id", templateId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("whatsapp_templates").insert(payload).select("id").single();
        if (error) throw error;
        templateId = data.id;
      }

      const response = await supabase.functions.invoke("whatsapp-submit-template", {
        body: { action: "submit", template_id: templateId },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template enviado para aprovação do Meta!");
      if (onClose) onClose();
    },
    onError: (err: Error) => toast.error("Erro ao enviar: " + err.message),
  });

  const isValid = nome.trim().length > 0 && corpo.trim().length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {editingTemplate ? "Editar Template" : "Novo Template"}
              </CardTitle>
              <CardDescription>Crie templates de mensagem para envio via WhatsApp.</CardDescription>
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Template</Label>
              <Input
                placeholder="ex: promocao_ebd"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Será convertido: <code>{toSnakeCase(nome) || "..."}</code>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Header Type */}
          <div className="space-y-2">
            <Label>Cabeçalho</Label>
            <Select value={cabecalhoTipo} onValueChange={setCabecalhoTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEADER_TYPES.map((h) => (
                  <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Header Text */}
          {cabecalhoTipo === "TEXT" && (
            <div className="space-y-2">
              <Label>Texto do Cabeçalho</Label>
              <Input
                placeholder="Ex: Novidades da EBD"
                value={cabecalhoTexto}
                onChange={(e) => setCabecalhoTexto(e.target.value)}
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">Máx. 60 caracteres</p>
            </div>
          )}

          {/* Header Image */}
          {cabecalhoTipo === "IMAGE" && (
            <div className="space-y-3">
              <Label>Imagem do Cabeçalho</Label>
              <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-dashed">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Requisitos do Meta:</strong></p>
                  <p>• Formato: <strong>JPEG</strong> ou <strong>PNG</strong></p>
                  <p>• Tamanho máximo: <strong>5 MB</strong></p>
                  <p>• Dimensões recomendadas: <strong>800 × 800 px</strong></p>
                </div>
              </div>

              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Header preview"
                    className="w-full max-w-[200px] h-auto rounded-md border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={removeImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                  >
                    {uploading ? (
                      <>Enviando...</>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Enviar Imagem
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Variables */}
          <div className="space-y-2">
            <Label>Variáveis disponíveis</Label>
            <div className="flex flex-wrap gap-1">
              {VARIAVEIS.map((v) => (
                <Button
                  key={v.key}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => insertVariable(v.key)}
                >
                  {`{{${v.key}}}`}
                </Button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label>Corpo da Mensagem</Label>
            <Textarea
              ref={textareaRef}
              placeholder="Digite a mensagem do template..."
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              className="min-h-[160px] font-mono text-sm"
            />
          </div>

          {/* Footer */}
          <div className="space-y-2">
            <Label>Rodapé (opcional)</Label>
            <Input
              placeholder="Ex: Central Gospel Editora"
              value={rodape}
              onChange={(e) => setRodape(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Botões (máx. 3)</Label>
              <Button variant="outline" size="sm" onClick={addButton} disabled={botoes.length >= 3} className="gap-1 h-7 text-xs">
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </div>
            {botoes.map((btn, idx) => (
              <div key={idx} className="flex gap-2 items-start p-2 border rounded-md">
                <Select
                  value={btn.tipo}
                  onValueChange={(val) => updateButton(idx, "tipo", val)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QUICK_REPLY">Resposta</SelectItem>
                    <SelectItem value="URL">URL</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Texto do botão"
                  value={btn.texto}
                  onChange={(e) => updateButton(idx, "texto", e.target.value)}
                  className="flex-1"
                />
                {btn.tipo === "URL" && (
                  <Input
                    placeholder="https://..."
                    value={btn.url || ""}
                    onChange={(e) => updateButton(idx, "url", e.target.value)}
                    className="flex-1"
                  />
                )}
                <Button variant="ghost" size="icon" onClick={() => removeButton(idx)} className="h-10 w-10 shrink-0">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate("RASCUNHO")}
              disabled={!isValid || saveMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Salvar Rascunho
            </Button>
            <Button
              onClick={() => submitToMeta.mutate()}
              disabled={!isValid || submitToMeta.isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {submitToMeta.isPending ? "Enviando..." : "Enviar para Aprovação Meta"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preview</CardTitle>
          <CardDescription>Visualize como o template aparecerá no WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-[#e5ddd5] rounded-lg p-4 min-h-[300px]">
            <div className="max-w-[320px] mx-auto space-y-2">
              {/* Message bubble */}
              <div className="bg-[#dcf8c6] rounded-lg shadow-sm relative overflow-hidden">
                {/* Header image preview */}
                {cabecalhoTipo === "IMAGE" && imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Header"
                    className="w-full h-auto"
                  />
                )}

                {/* Header image placeholder */}
                {cabecalhoTipo === "IMAGE" && !imagePreview && (
                  <div className="w-full h-40 bg-gray-200 flex items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-gray-400" />
                  </div>
                )}

                <div className="p-3">
                  {/* Header text */}
                  {cabecalhoTipo === "TEXT" && cabecalhoTexto && (
                    <p className="text-sm font-bold text-gray-800 mb-1">{cabecalhoTexto}</p>
                  )}

                  <p className="text-sm whitespace-pre-wrap break-words text-gray-800">
                    {getPreviewText() || "Seu template aparecerá aqui..."}
                  </p>
                  {rodape && (
                    <p className="text-xs text-gray-500 mt-2 border-t pt-1">{rodape}</p>
                  )}
                  <span className="text-[10px] text-gray-500 float-right mt-1">12:00</span>
                </div>
              </div>

              {/* Buttons preview */}
              {botoes.length > 0 && (
                <div className="space-y-1">
                  {botoes.map((btn, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-lg p-2 text-center text-sm text-primary font-medium shadow-sm border"
                    >
                      {btn.texto || "Botão"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Used variables */}
          {getUsedVariables().length > 0 && (
            <div className="mt-4 space-y-2">
              <Label className="text-xs">Variáveis utilizadas:</Label>
              <div className="flex flex-wrap gap-1">
                {getUsedVariables().map((v) => (
                  <Badge key={v} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
