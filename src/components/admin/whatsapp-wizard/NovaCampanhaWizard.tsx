import { useState, useMemo, useRef, useEffect, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MessageSquare, MousePointerClick, Users, CalendarClock, CheckCircle2,
  HelpCircle, ChevronLeft, ChevronRight, Loader2, Upload, X, Trash2, Plus,
  AlertTriangle, PartyPopper,
} from "lucide-react";
import PhonePreview, { WizardButton } from "./PhonePreview";

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

const CATEGORIAS = [
  { value: "MARKETING", label: "Marketing" },
  { value: "UTILITY", label: "Utilidade" },
  { value: "AUTHENTICATION", label: "Autenticação" },
];

const STEPS = [
  { id: 1, label: "Mensagem", icon: MessageSquare },
  { id: 2, label: "Botões", icon: MousePointerClick },
  { id: 3, label: "Público", icon: Users },
  { id: 4, label: "Envio", icon: CalendarClock },
  { id: 5, label: "Revisão", icon: CheckCircle2 },
];

const HELP_TEXTS: Record<number, string> = {
  1: "Aqui você escreve a mensagem que as pessoas vão receber no WhatsApp. Você pode criar uma mensagem nova ou reaproveitar uma que já foi usada e aprovada antes. Use os botões de variáveis (ex: {{primeiro_nome}}) para personalizar a mensagem com os dados de cada pessoa automaticamente.",
  2: "Botões aparecem embaixo da mensagem e facilitam a resposta. Podem ser um atalho de resposta rápida (ex: \"Quero saber mais\") ou um link para uma página (ex: o site da promoção). Esta etapa é opcional — você pode pular sem adicionar nenhum botão.",
  3: "Escolha para quem a mensagem será enviada. Os públicos são listas de contatos já montadas na aba \"Públicos\". Se ainda não existe um público adequado, crie um novo por lá e volte aqui.",
  4: "Escolha quando a campanha vai começar. Se a mensagem for nova, ela primeiro passa por uma aprovação (normalmente leva poucas horas) e o envio começa logo depois. Você também pode agendar uma data e horário específicos.",
  5: "Confira com calma se está tudo certo: o texto da mensagem, os botões, o público e a data de envio. Se quiser corrigir algo, use o botão \"Voltar\". Quando estiver tudo certo, clique em \"Criar campanha\".",
};

interface VarConfig {
  tipo: "fixo" | "campo";
  valor: string;
}

interface NovaCampanhaWizardProps {
  open: boolean;
  onClose: () => void;
  quietHours: any;
  onCreated: () => void;
  onGoToPublicos: () => void;
}

export default function NovaCampanhaWizard({ open, onClose, quietHours, onCreated, onGoToPublicos }: NovaCampanhaWizardProps) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [done, setDone] = useState<"nova" | "reuso" | null>(null);
  const [saving, setSaving] = useState(false);

  // Etapa 1 — Mensagem
  const [modoMensagem, setModoMensagem] = useState<"nova" | "reusar">("nova");
  const [templateId, setTemplateId] = useState("");
  const [nome, setNome] = useState("");
  const [corpo, setCorpo] = useState("");
  const [rodape, setRodape] = useState("");
  const [cabecalhoTipo, setCabecalhoTipo] = useState("NONE");
  const [cabecalhoTexto, setCabecalhoTexto] = useState("");
  const [cabecalhoMidiaUrl, setCabecalhoMidiaUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [categoria, setCategoria] = useState("MARKETING");
  const [showAvancado, setShowAvancado] = useState(false);
  const [varConfig, setVarConfig] = useState<Record<string, VarConfig>>({});

  // Etapa 2 — Botões
  const [botoes, setBotoes] = useState<WizardButton[]>([]);

  // Etapa 3 — Público
  const [publicoId, setPublicoId] = useState("");

  // Etapa 4 — Envio
  const [quando, setQuando] = useState<"agora" | "agendar">("agora");
  const [agendadaPara, setAgendadaPara] = useState("");

  useEffect(() => {
    if (open) {
      setStep(1); setDone(null); setSaving(false);
      setModoMensagem("nova"); setTemplateId(""); setNome(""); setCorpo(""); setRodape("");
      setCabecalhoTipo("NONE"); setCabecalhoTexto(""); setCabecalhoMidiaUrl(""); setImagePreview(null);
      setCategoria("MARKETING"); setShowAvancado(false); setVarConfig({});
      setBotoes([]); setPublicoId(""); setQuando("agora"); setAgendadaPara("");
    }
  }, [open]);

  // ---- Queries ----
  const { data: templatesAprovados } = useQuery({
    queryKey: ["whatsapp-templates-approved-v2"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("status", "APROVADO")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: publicos } = useQuery({
    queryKey: ["whatsapp-publicos-list"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_publicos")
        .select("id, nome, total_calculado")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const selectedTemplate = useMemo(
    () => templatesAprovados?.find((t: any) => t.id === templateId),
    [templatesAprovados, templateId]
  );

  // Variáveis posicionais {{N}} do template reaproveitado
  const templateVariables = useMemo(() => {
    if (modoMensagem !== "reusar" || !selectedTemplate?.corpo) return [] as string[];
    const matches = selectedTemplate.corpo.match(/\{\{\d+\}\}/g) || [];
    return Array.from(new Set(matches)) as string[];
  }, [modoMensagem, selectedTemplate]);

  // ---- Preview ----
  const preview = useMemo(() => {
    if (modoMensagem === "reusar" && selectedTemplate) {
      let text: string = selectedTemplate.corpo || "";
      // Substitui variáveis posicionais pelos valores de exemplo
      text = text.replace(/\{\{\d+\}\}/g, "João");
      const botoesTpl: WizardButton[] = typeof selectedTemplate.botoes === "string"
        ? JSON.parse(selectedTemplate.botoes || "[]")
        : (selectedTemplate.botoes || []);
      return {
        cabecalhoTipo: selectedTemplate.cabecalho_tipo || "NONE",
        cabecalhoTexto: selectedTemplate.cabecalho_texto || "",
        imagemUrl: selectedTemplate.cabecalho_midia_url || null,
        corpo: text,
        rodape: selectedTemplate.rodape || "",
        botoes: botoesTpl,
      };
    }
    let text = corpo;
    VARIAVEIS.forEach((v) => {
      text = text.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, "g"), v.example);
    });
    return {
      cabecalhoTipo,
      cabecalhoTexto,
      imagemUrl: imagePreview,
      corpo: text,
      rodape,
      botoes,
    };
  }, [modoMensagem, selectedTemplate, corpo, rodape, cabecalhoTipo, cabecalhoTexto, imagePreview, botoes]);

  // ---- Helpers etapa 1 (mesma lógica de WhatsAppTemplateCreator) ----
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
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Formato inválido. Use JPEG ou PNG.");
      return;
    }
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
      const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(data.path);
      setCabecalhoMidiaUrl(urlData.publicUrl);
      setImagePreview(urlData.publicUrl);
      setCabecalhoTipo("IMAGE");
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
    if (cabecalhoTipo === "IMAGE") setCabecalhoTipo("NONE");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---- Botões ----
  const addButton = () => {
    if (botoes.length >= 3) return;
    setBotoes([...botoes, { tipo: "QUICK_REPLY", texto: "" }]);
  };
  const removeButton = (idx: number) => setBotoes(botoes.filter((_, i) => i !== idx));
  const updateButton = (idx: number, field: string, value: string | boolean) => {
    const updated = [...botoes];
    (updated[idx] as any)[field] = value;
    setBotoes(updated);
  };

  // ---- Agendamento ----
  const minDateTime = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [open]);

  const DIAS_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const quietHoursLabel = useMemo(() => {
    if (!quietHours) return "sempre permitido";
    const dias = (quietHours.dias_semana || []).map((d: number) => DIAS_LABEL[d - 1]).join(", ");
    return `${String(quietHours.inicio_hora).padStart(2, "0")}h–${String(quietHours.fim_hora).padStart(2, "0")}h, ${dias}`;
  }, [quietHours]);

  // ---- Validação por etapa ----
  const validateStep = (s: number): boolean => {
    if (s === 1) {
      if (modoMensagem === "reusar") {
        if (!templateId) { toast.error("Escolha uma mensagem já usada para reaproveitar"); return false; }
        for (const v of templateVariables) {
          const cfg = varConfig[v];
          if (!cfg) { toast.error(`Configure a variável ${v}`); return false; }
          if (cfg.tipo === "fixo" && !cfg.valor.trim()) {
            toast.error(`Informe o valor fixo da variável ${v}`); return false;
          }
        }
        return true;
      }
      if (!nome.trim()) { toast.error("Dê um nome para a campanha"); return false; }
      if (!corpo.trim()) { toast.error("Escreva o texto da mensagem"); return false; }
      return true;
    }
    if (s === 2) {
      for (let i = 0; i < botoes.length; i++) {
        if (!botoes[i].texto.trim()) { toast.error(`Escreva o texto do botão ${i + 1} ou remova-o`); return false; }
        if (botoes[i].tipo === "URL" && !botoes[i].url?.trim()) {
          toast.error(`Informe o link de destino do botão ${i + 1}`); return false;
        }
      }
      return true;
    }
    if (s === 3) {
      if (!publicoId) { toast.error("Escolha para quem a mensagem será enviada"); return false; }
      return true;
    }
    if (s === 4) {
      if (quando === "agendar") {
        if (!agendadaPara) { toast.error("Selecione a data e hora do envio"); return false; }
        if (new Date(agendadaPara).getTime() < Date.now() + 4 * 60 * 1000) {
          toast.error("O agendamento precisa ser pelo menos 5 minutos no futuro"); return false;
        }
      }
      return true;
    }
    return true;
  };

  const next = () => { if (validateStep(step)) setStep((s) => Math.min(5, s + 1)); };
  const back = () => setStep((s) => Math.max(1, s - 1));

  // ---- Criação ----
  const handleCreate = async () => {
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { data: pub } = await supabase
        .from("whatsapp_publicos").select("filtros").eq("id", publicoId).single();

      const agendaIso = quando === "agendar" ? new Date(agendadaPara).toISOString() : null;

      if (modoMensagem === "nova") {
        // 1) Salva o template (mesmo payload de WhatsAppTemplateCreator)
        const usedVars = [...new Set((corpo.match(/\{\{(\w+)\}\}/g) || []).map((m) => m.replace(/\{\{|\}\}/g, "")))];
        const templateNome = `${toSnakeCase(nome) || "campanha"}_${Date.now().toString(36)}`;
        const { data: tpl, error: tplErr } = await supabase
          .from("whatsapp_templates")
          .insert({
            nome: templateNome,
            categoria,
            idioma: "pt_BR",
            corpo,
            rodape: rodape || null,
            botoes: JSON.stringify(botoes),
            variaveis_usadas: usedVars,
            cabecalho_tipo: cabecalhoTipo === "NONE" ? null : cabecalhoTipo,
            cabecalho_texto: cabecalhoTipo === "TEXT" ? cabecalhoTexto : null,
            cabecalho_midia_url: cabecalhoTipo === "IMAGE" ? cabecalhoMidiaUrl : null,
            status: "RASCUNHO",
            created_by: user?.id,
          })
          .select("id")
          .single();
        if (tplErr) throw tplErr;

        // 2) Envia para aprovação
        const response = await supabase.functions.invoke("whatsapp-submit-template", {
          body: { action: "submit", template_id: tpl.id },
        });
        if (response.error) throw new Error(response.error.message);
        if (response.data?.error) throw new Error(response.data.error);

        // 3) Cria a campanha vinculada, aguardando aprovação da mensagem
        const templateVars: Record<string, VarConfig> = {};
        usedVars.forEach((v, i) => {
          templateVars[String(i + 1)] = { tipo: "campo", valor: v };
          templateVars[v] = { tipo: "campo", valor: v };
        });
        const { error: campErr } = await supabase.from("whatsapp_campanhas").insert([{
          nome: nome.trim(),
          publico_id: publicoId,
          template_id: tpl.id,
          template_variaveis: templateVars as any,
          cabecalho_midia_url: cabecalhoTipo === "IMAGE" ? cabecalhoMidiaUrl : null,
          filtros_publico: (pub?.filtros as any) || null,
          status: "rascunho",
          agendada_para: agendaIso,
          created_by: user?.id,
        }]);
        if (campErr) throw campErr;

        queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
        setDone("nova");
      } else {
        // Reaproveitar mensagem já aprovada — mesmo fluxo do dialog anterior
        const templateVars: Record<string, VarConfig> = {};
        templateVariables.forEach((v, i) => {
          const key = v.replace(/\{\{|\}\}/g, "").trim();
          const cfg = varConfig[v];
          if (cfg) {
            templateVars[String(i + 1)] = cfg;
            templateVars[key] = cfg;
          }
        });
        const { error: campErr } = await supabase.from("whatsapp_campanhas").insert([{
          nome: nome.trim() || selectedTemplate?.nome || "Campanha",
          publico_id: publicoId,
          template_id: templateId,
          template_variaveis: templateVars as any,
          cabecalho_midia_url: selectedTemplate?.cabecalho_midia_url || null,
          filtros_publico: (pub?.filtros as any) || null,
          status: "agendada",
          agendada_para: agendaIso || new Date().toISOString(),
          created_by: user?.id,
        }]);
        if (campErr) throw campErr;
        setDone("reuso");
      }

      onCreated();
    } catch (e: any) {
      toast.error("Erro ao criar campanha: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const publicoSelecionado = publicos?.find((p: any) => p.id === publicoId);

  const StepTitle = ({ children, stepNum }: { children: ReactNode; stepNum: number }) => (
    <div className="flex items-center gap-1.5">
      <h3 className="text-base font-semibold">{children}</h3>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Ajuda">
            <HelpCircle className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="text-sm max-w-xs">{HELP_TEXTS[stepNum]}</PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova campanha de WhatsApp</DialogTitle>
          <DialogDescription>
            Siga os passos abaixo — ao final, sua campanha estará pronta para envio.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          /* ---- Tela de confirmação ---- */
          <div className="flex flex-col items-center text-center py-10 space-y-4">
            <PartyPopper className="h-14 w-14 text-primary" />
            {done === "nova" ? (
              <>
                <h3 className="text-lg font-semibold">Sua mensagem foi enviada para aprovação!</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Assim que for aprovada (normalmente em poucas horas), a campanha começa automaticamente.
                  Você pode acompanhar o andamento na lista de campanhas — ela aparecerá com o rótulo
                  "Aguardando aprovação da mensagem".
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">Campanha criada com sucesso!</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {quando === "agendar"
                    ? `O envio está agendado para ${format(new Date(agendadaPara), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`
                    : "O envio vai começar em instantes. Você pode acompanhar o progresso na lista de campanhas."}
                </p>
              </>
            )}
            <Button onClick={handleClose} className="mt-2">Fechar</Button>
          </div>
        ) : (
          <>
            {/* ---- Stepper ---- */}
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              {STEPS.map((s, idx) => {
                const Icon = s.icon;
                const active = step === s.id;
                const completed = step > s.id;
                return (
                  <div key={s.id} className="flex items-center gap-1 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => s.id < step && setStep(s.id)}
                      disabled={s.id > step}
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : completed
                            ? "bg-primary/15 text-primary cursor-pointer"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{s.id} {s.label}</span>
                      <span className="sm:hidden">{s.id}</span>
                    </button>
                    {idx < STEPS.length - 1 && <div className="h-px w-3 sm:w-5 bg-border" />}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 py-2">
              {/* ---- Conteúdo da etapa ---- */}
              <div className="space-y-4 min-w-0">
                {step === 1 && (
                  <>
                    <StepTitle stepNum={1}>Passo 1 — A mensagem</StepTitle>

                    <RadioGroup
                      value={modoMensagem}
                      onValueChange={(v: any) => { setModoMensagem(v); setTemplateId(""); setVarConfig({}); }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      <label className={`flex items-start gap-2 cursor-pointer rounded-md border p-3 text-sm ${modoMensagem === "nova" ? "border-primary bg-primary/5" : ""}`}>
                        <RadioGroupItem value="nova" className="mt-0.5" />
                        <span>
                          <span className="font-medium block">Criar uma mensagem nova</span>
                          <span className="text-xs text-muted-foreground">Escreva do zero, com texto, imagem e botões.</span>
                        </span>
                      </label>
                      <label className={`flex items-start gap-2 cursor-pointer rounded-md border p-3 text-sm ${modoMensagem === "reusar" ? "border-primary bg-primary/5" : ""}`}>
                        <RadioGroupItem value="reusar" className="mt-0.5" />
                        <span>
                          <span className="font-medium block">Reaproveitar uma mensagem</span>
                          <span className="text-xs text-muted-foreground">Use uma mensagem que já foi aprovada antes — o envio é mais rápido.</span>
                        </span>
                      </label>
                    </RadioGroup>

                    {modoMensagem === "reusar" ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Nome da campanha</Label>
                          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Promoção Revista Outubro" />
                        </div>
                        <div className="space-y-2">
                          <Label>Escolha a mensagem *</Label>
                          {!templatesAprovados?.length ? (
                            <p className="text-sm text-muted-foreground border rounded-md p-3">
                              Nenhuma mensagem aprovada disponível ainda. Escolha "Criar uma mensagem nova".
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              {templatesAprovados.map((t: any) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => { setTemplateId(t.id); setVarConfig({}); }}
                                  className={`w-full text-left rounded-md border p-3 text-sm transition-colors ${
                                    templateId === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{t.nome}</span>
                                    <Badge variant="outline" className="text-[10px]">Aprovada</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{t.corpo}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {templateVariables.length > 0 && (
                          <div className="space-y-3">
                            <Label>Personalização da mensagem</Label>
                            {templateVariables.map((v) => {
                              const cfg = varConfig[v] || { tipo: "campo" as const, valor: "primeiro_nome" };
                              return (
                                <Card key={v}>
                                  <CardContent className="p-3 space-y-2">
                                    <div className="text-sm font-medium">Variável {v}</div>
                                    <RadioGroup
                                      value={cfg.tipo === "fixo" ? "fixo" : (cfg.valor || "primeiro_nome")}
                                      onValueChange={(val) => {
                                        if (val === "fixo") {
                                          setVarConfig({ ...varConfig, [v]: { tipo: "fixo", valor: cfg.tipo === "fixo" ? cfg.valor : "" } });
                                        } else {
                                          setVarConfig({ ...varConfig, [v]: { tipo: "campo", valor: val } });
                                        }
                                      }}
                                      className="flex flex-wrap gap-4"
                                    >
                                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                                        <RadioGroupItem value="primeiro_nome" /> Primeiro nome do contato
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                                        <RadioGroupItem value="nome_completo" /> Nome completo do contato
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                                        <RadioGroupItem value="fixo" /> Valor fixo
                                      </label>
                                    </RadioGroup>
                                    {cfg.tipo === "fixo" && (
                                      <Input
                                        value={cfg.valor}
                                        onChange={(e) => setVarConfig({ ...varConfig, [v]: { tipo: "fixo", valor: e.target.value } })}
                                        placeholder="Digite o valor"
                                      />
                                    )}
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Nome da campanha *</Label>
                          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Promoção Revista Outubro" />
                          <p className="text-xs text-muted-foreground">Só você vê esse nome — ele serve para identificar a campanha na lista.</p>
                        </div>

                        <div className="space-y-2">
                          <Label>Imagem (opcional)</Label>
                          {imagePreview ? (
                            <div className="relative inline-block">
                              <img src={imagePreview} alt="Imagem da mensagem" className="w-full max-w-[220px] h-auto rounded-md border" />
                              <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={removeImage}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div>
                              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleImageUpload} className="hidden" />
                              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {uploading ? "Enviando..." : "Enviar imagem"}
                              </Button>
                              <p className="text-xs text-muted-foreground mt-1">JPEG ou PNG, até 5 MB. A imagem aparece no topo da mensagem.</p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Texto da mensagem *</Label>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {VARIAVEIS.map((v) => (
                              <Button key={v.key} variant="outline" size="sm" className="text-xs h-7" onClick={() => insertVariable(v.key)}>
                                {`{{${v.key}}}`}
                              </Button>
                            ))}
                          </div>
                          <Textarea
                            ref={textareaRef}
                            placeholder="Ex: Olá {{primeiro_nome}}! A revista de outubro já está disponível..."
                            value={corpo}
                            onChange={(e) => setCorpo(e.target.value)}
                            className="min-h-[140px] text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Toque em uma variável acima para inserir no texto — ela será trocada pelos dados de cada pessoa no envio.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Rodapé (opcional)</Label>
                          <Input placeholder="Ex: Central Gospel Editora" value={rodape} onChange={(e) => setRodape(e.target.value)} />
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowAvancado(!showAvancado)}
                          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          {showAvancado ? "Ocultar opções avançadas" : "Opções avançadas"}
                        </button>
                        {showAvancado && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-md p-3 bg-muted/30">
                            <div className="space-y-2">
                              <Label className="text-xs">Categoria da mensagem</Label>
                              <Select value={categoria} onValueChange={setCategoria}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {CATEGORIAS.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Título em destaque (opcional)</Label>
                              <Input
                                placeholder="Ex: Novidades da EBD"
                                value={cabecalhoTexto}
                                onChange={(e) => {
                                  setCabecalhoTexto(e.target.value);
                                  if (e.target.value) setCabecalhoTipo((t) => (t === "IMAGE" ? t : "TEXT"));
                                  else if (cabecalhoTipo === "TEXT") setCabecalhoTipo("NONE");
                                }}
                                maxLength={60}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {step === 2 && (
                  <>
                    <StepTitle stepNum={2}>Passo 2 — Botões (opcional)</StepTitle>
                    {modoMensagem === "reusar" ? (
                      <p className="text-sm text-muted-foreground border rounded-md p-3">
                        A mensagem reaproveitada já tem seus botões definidos — veja ao lado no preview.
                        Se quiser botões diferentes, volte ao passo 1 e crie uma mensagem nova.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {botoes.length === 0 && (
                          <p className="text-sm text-muted-foreground border rounded-md p-3">
                            Sua mensagem ainda não tem botões. Você pode adicionar até 3 — ou simplesmente avançar para o próximo passo.
                          </p>
                        )}
                        {botoes.map((btn, idx) => (
                          <div key={idx} className="border rounded-md p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Botão {idx + 1} de 3</span>
                              <Button variant="ghost" size="icon" onClick={() => removeButton(idx)} className="h-8 w-8">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              <Select value={btn.tipo} onValueChange={(val) => updateButton(idx, "tipo", val)}>
                                <SelectTrigger className="w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="QUICK_REPLY">Resposta rápida</SelectItem>
                                  <SelectItem value="URL">Link</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                placeholder="Texto do botão"
                                value={btn.texto}
                                onChange={(e) => updateButton(idx, "texto", e.target.value)}
                                className="flex-1"
                              />
                            </div>
                            {btn.tipo === "URL" && (
                              <div className="space-y-2">
                                <Input
                                  placeholder={btn.url_dinamica ? "https://gestaoebd.com.br/oferta/" : "https://..."}
                                  value={btn.url || ""}
                                  onChange={(e) => updateButton(idx, "url", e.target.value)}
                                />
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`wizard-url-dinamica-${idx}`}
                                    checked={btn.url_dinamica || false}
                                    onCheckedChange={(checked) => updateButton(idx, "url_dinamica", !!checked)}
                                  />
                                  <label htmlFor={`wizard-url-dinamica-${idx}`} className="text-xs text-muted-foreground cursor-pointer">
                                    Link personalizado (cada pessoa recebe um endereço único, usado em ofertas)
                                  </label>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={addButton} disabled={botoes.length >= 3} className="gap-1">
                          <Plus className="h-3.5 w-3.5" /> Adicionar outro botão
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {step === 3 && (
                  <>
                    <StepTitle stepNum={3}>Passo 3 — Para quem enviar</StepTitle>
                    <div className="space-y-2">
                      <Label>Público *</Label>
                      <Select value={publicoId} onValueChange={setPublicoId}>
                        <SelectTrigger><SelectValue placeholder="Selecione um público" /></SelectTrigger>
                        <SelectContent>
                          {(publicos || []).map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome} ({p.total_calculado ?? "?"} contatos)
                            </SelectItem>
                          ))}
                          {publicos && publicos.length === 0 && (
                            <div className="px-2 py-3 text-sm text-muted-foreground">Nenhum público criado ainda.</div>
                          )}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => { handleClose(); onGoToPublicos(); }}
                        className="text-xs text-primary underline underline-offset-2 hover:opacity-80"
                      >
                        Criar um público novo
                      </button>
                    </div>
                  </>
                )}

                {step === 4 && (
                  <>
                    <StepTitle stepNum={4}>Passo 4 — Quando enviar</StepTitle>
                    <RadioGroup value={quando} onValueChange={(v: any) => setQuando(v)} className="flex flex-col gap-2">
                      <label className={`flex items-start gap-2 cursor-pointer rounded-md border p-3 text-sm ${quando === "agora" ? "border-primary bg-primary/5" : ""}`}>
                        <RadioGroupItem value="agora" className="mt-0.5" />
                        <span>
                          <span className="font-medium block">
                            {modoMensagem === "nova" ? "Enviar assim que a mensagem for aprovada" : "Enviar assim que possível"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {modoMensagem === "nova"
                              ? "A mensagem nova passa por uma aprovação rápida e o envio começa logo em seguida."
                              : "O envio começa em instantes."}
                          </span>
                        </span>
                      </label>
                      <label className={`flex items-start gap-2 cursor-pointer rounded-md border p-3 text-sm ${quando === "agendar" ? "border-primary bg-primary/5" : ""}`}>
                        <RadioGroupItem value="agendar" className="mt-0.5" />
                        <span>
                          <span className="font-medium block">Agendar para uma data e hora</span>
                          <span className="text-xs text-muted-foreground">Você escolhe exatamente quando o envio começa.</span>
                        </span>
                      </label>
                    </RadioGroup>
                    {quando === "agendar" && (
                      <Input type="datetime-local" value={agendadaPara} min={minDateTime} onChange={(e) => setAgendadaPara(e.target.value)} />
                    )}
                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>Os envios respeitam o horário permitido ({quietHoursLabel}). Fora desse horário, a campanha aguarda automaticamente.</span>
                    </p>
                  </>
                )}

                {step === 5 && (
                  <>
                    <StepTitle stepNum={5}>Passo 5 — Revisão e confirmação</StepTitle>
                    <div className="border rounded-md divide-y text-sm">
                      <div className="p-3 flex justify-between gap-4">
                        <span className="text-muted-foreground shrink-0">Campanha</span>
                        <span className="font-medium text-right">{nome.trim() || selectedTemplate?.nome || "—"}</span>
                      </div>
                      <div className="p-3 flex justify-between gap-4">
                        <span className="text-muted-foreground shrink-0">Mensagem</span>
                        <span className="font-medium text-right">
                          {modoMensagem === "nova" ? "Nova (será enviada para aprovação)" : `Reaproveitada: ${selectedTemplate?.nome || ""}`}
                        </span>
                      </div>
                      <div className="p-3 flex justify-between gap-4">
                        <span className="text-muted-foreground shrink-0">Público</span>
                        <span className="font-medium text-right">
                          {publicoSelecionado ? `${publicoSelecionado.nome} (${publicoSelecionado.total_calculado ?? "?"} contatos)` : "—"}
                        </span>
                      </div>
                      <div className="p-3 flex justify-between gap-4">
                        <span className="text-muted-foreground shrink-0">Envio</span>
                        <span className="font-medium text-right">
                          {quando === "agendar"
                            ? format(new Date(agendadaPara), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : modoMensagem === "nova" ? "Assim que a mensagem for aprovada" : "Assim que possível"}
                        </span>
                      </div>
                      {modoMensagem === "nova" && botoes.length > 0 && (
                        <div className="p-3 flex justify-between gap-4">
                          <span className="text-muted-foreground shrink-0">Botões</span>
                          <span className="font-medium text-right">{botoes.map((b) => b.texto).join(" · ")}</span>
                        </div>
                      )}
                    </div>
                    {modoMensagem === "nova" && (
                      <p className="text-xs text-muted-foreground flex items-start gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>Ao confirmar, a mensagem é enviada para aprovação. A campanha começa automaticamente assim que ela for aprovada.</span>
                      </p>
                    )}
                  </>
                )}

                {/* ---- Navegação ---- */}
                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" onClick={back} disabled={step === 1 || saving} className="gap-1">
                    <ChevronLeft className="h-4 w-4" /> Voltar
                  </Button>
                  {step < 5 ? (
                    <Button onClick={next} className="gap-1">
                      Avançar <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={handleCreate} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {saving ? "Criando..." : "Criar campanha"}
                    </Button>
                  )}
                </div>
              </div>

              {/* ---- Preview ao vivo ---- */}
              <div className="lg:sticky lg:top-0 self-start">
                <PhonePreview
                  cabecalhoTipo={preview.cabecalhoTipo}
                  cabecalhoTexto={preview.cabecalhoTexto}
                  imagemUrl={preview.imagemUrl}
                  corpoPreview={preview.corpo}
                  rodape={preview.rodape}
                  botoes={preview.botoes}
                />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
