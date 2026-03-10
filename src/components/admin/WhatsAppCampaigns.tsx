import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ptBR } from "date-fns/locale";
import {
  Users, ArrowRight, ArrowLeft, Send, Loader2, Target, MessageSquare,
  MousePointerClick, Eye, ShoppingCart, DollarSign, Plus, ChevronRight, Trash2, Tag
} from "lucide-react";
import { format } from "date-fns";

type Step = "list" | "segmentation" | "template" | "funnel";

interface BlingChannel {
  id: string;
  descricao: string;
}

interface PublicoMesOption {
  mes: string;
  label: string;
  total_contatos: number;
  com_desconto: number;
  sem_desconto: number;
  contatos: any[];
}

// Known Bling store ID to name mapping
const BLING_STORE_NAMES: Record<string, string> = {
  "205391854": "E-COMMERCE",
  "204728077": "ECG SHOPEE",
  "204732507": "MERCADO LIVRE",
  "205441191": "ATACADO",
  "205797806": "PEDIDOS MATRIZ",
  "205891152": "PEDIDOS PENHA",
  "205882190": "PEDIDOS PERNAMBUCO",
};

interface Filters {
  dateFrom: string;
  dateTo: string;
  canalBling: string;
}

interface Recipient {
  cliente_id: string | null;
  nome: string;
  telefone: string;
  email: string;
  tipo_documento: string;
  data_pedido?: string;
  produtos_pedido?: string;
  valor_pedido?: string;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  enviando: { label: "Enviando", variant: "outline" },
  enviada: { label: "Enviada", variant: "default" },
  pausada: { label: "Pausada", variant: "destructive" },
};

export default function WhatsAppCampaigns() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("list");
  const [filters, setFilters] = useState<Filters>({
    dateFrom: "",
    dateTo: "",
    canalBling: "todos",
  });
  const [blingChannels] = useState<BlingChannel[]>(
    Object.entries(BLING_STORE_NAMES).map(([id, descricao]) => ({ id, descricao }))
  );
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [reuseCampaignId, setReuseCampaignId] = useState<string | null>(null);
  const [loadingReuse, setLoadingReuse] = useState(false);
  // Público de revistas state
  const [selectedPublicoMeses, setSelectedPublicoMeses] = useState<Set<string>>(new Set());
  const [publicoDescontoFilter, setPublicoDescontoFilter] = useState<"todos" | "com_desconto" | "sem_desconto">("todos");
  const [loadingPublico, setLoadingPublico] = useState(false);

  // --- Queries ---
  const { data: campaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ["whatsapp-campanhas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_campanhas")
        .select("*, whatsapp_templates(nome, corpo, botoes)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: step === "list" || step === "funnel",
  });

  // Campaigns with audience for reuse
  const { data: campaignsWithAudience } = useQuery({
    queryKey: ["whatsapp-campanhas-com-publico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_campanhas")
        .select("id, nome, total_publico, created_at")
        .gt("total_publico", 0)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: step === "segmentation",
  });

  // Públicos de revistas query
  const { data: publicosRevistas } = useQuery({
    queryKey: ["publicos-revistas-campanhas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_publicos_revistas_por_mes");
      if (error) throw error;
      return (data as unknown as PublicoMesOption[]) || [];
    },
    enabled: step === "segmentation",
  });

  const { data: approvedTemplates } = useQuery({
    queryKey: ["whatsapp-templates-approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("status", "APROVADO")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: step === "template",
  });

  const { data: funnelData } = useQuery({
    queryKey: ["whatsapp-campanha-funnel", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return null;
      const { data: dest, error } = await supabase
        .from("whatsapp_campanha_destinatarios")
        .select("*")
        .eq("campanha_id", selectedCampaignId);
      if (error) throw error;
      return dest;
    },
    enabled: step === "funnel" && !!selectedCampaignId,
  });

  const selectedCampaign = useMemo(
    () => campaigns?.find((c: any) => c.id === selectedCampaignId),
    [campaigns, selectedCampaignId]
  );


  // --- Audience search (incremental pagination) ---
  const [searchProgress, setSearchProgress] = useState("");
  const searchAudience = async () => {
    if (!filters.dateFrom || !filters.dateTo) {
      toast.error("Selecione o período da última compra");
      return;
    }
    setLoadingAudience(true);
    setSearchProgress("Iniciando busca...");
    try {
      const allContacts: any[] = [];
      let nextPage: number | null = 1;
      let nextContactIndex: number = 0;
      let seenPhonesArr: string[] = [];
      let retries = 0;
      let staleIterations = 0;
      let lastCursorKey = "";

      while (nextPage !== null) {
        setSearchProgress(`Buscando página ${nextPage} (pos ${nextContactIndex})… (${allContacts.length} contatos)`);

        const { data, error } = await supabase.functions.invoke("bling-search-campaign-audience", {
          body: {
            loja_id: filters.canalBling === "todos" ? null : filters.canalBling || null,
            data_inicial: filters.dateFrom,
            data_final: filters.dateTo,
            start_page: nextPage,
            start_contact_index: nextContactIndex,
            seen_phones: seenPhonesArr,
          },
        });

        if (error) {
          if (retries < 2) {
            retries++;
            setSearchProgress(`Falha temporária, tentando novamente (${retries}/2)…`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          throw new Error("Falha de conexão após 2 tentativas. Tente novamente.");
        }
        if (data?.error) throw new Error(data.error);

        retries = 0;

        const contacts = (data?.contacts || []).map((c: any) => ({
          cliente_id: null as any,
          nome: c.nome || "",
          telefone: c.telefone || "",
          email: c.email || "",
          tipo_documento: c.tipo_documento || "indefinido",
        }));

        allContacts.push(...contacts);
        seenPhonesArr = data?.seen_phones || [];

        // Anti-loop fail-safe: detect stale cursor
        const cursorKey = `${data?.next_page}:${data?.next_contact_index ?? 0}`;
        if (contacts.length === 0 && cursorKey === lastCursorKey) {
          staleIterations++;
          if (staleIterations >= 3) {
            console.warn("Busca sem progresso detectada, interrompendo.");
            toast.warning("Busca interrompida: sem progresso após múltiplas tentativas.");
            break;
          }
        } else {
          staleIterations = 0;
        }
        lastCursorKey = cursorKey;

        if (data?.done) {
          nextPage = null;
        } else {
          nextPage = data?.next_page ?? null;
          nextContactIndex = data?.next_contact_index ?? 0;
        }
      }

      setRecipients(allContacts);
      if (allContacts.length === 0) toast.info("Nenhum destinatário encontrado com esses filtros.");
      else toast.success(`${allContacts.length} contatos encontrados!`);
    } catch (err: any) {
      toast.error("Erro ao buscar público: " + err.message);
    } finally {
      setLoadingAudience(false);
      setSearchProgress("");
    }
  };

  // --- Create campaign ---
  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!campaignName) throw new Error("Informe o nome da campanha");
      if (!selectedTemplateId) throw new Error("Selecione um template");

      const user = (await supabase.auth.getUser()).data.user;

      const { data: campanha, error } = await supabase
        .from("whatsapp_campanhas")
        .insert({
          nome: campaignName,
          template_id: selectedTemplateId,
          filtros_publico: filters as any,
          total_publico: recipients.length,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Insert recipients in batches of 100
      const batch = recipients.map((r) => ({
        campanha_id: campanha.id,
        cliente_id: r.cliente_id || null,
        telefone: r.telefone,
        nome: r.nome,
        email: r.email,
        tipo_documento: r.tipo_documento,
        data_pedido: r.data_pedido || null,
        produtos_pedido: r.produtos_pedido || null,
        valor_pedido: r.valor_pedido || null,
      }));

      for (let i = 0; i < batch.length; i += 100) {
        const chunk = batch.slice(i, i + 100);
        const { error: batchError } = await supabase
          .from("whatsapp_campanha_destinatarios")
          .insert(chunk);
        if (batchError) throw batchError;
      }

      return campanha;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-campanhas"] });
      toast.success("Campanha criada com sucesso!");
      resetFlow();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // --- Delete campaign ---
  const deleteCampaignMutation = useMutation({
    mutationFn: async (campanhaId: string) => {
      await supabase.from("whatsapp_campanha_destinatarios").delete().eq("campanha_id", campanhaId);
      const { error } = await supabase.from("whatsapp_campanhas").delete().eq("id", campanhaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-campanhas"] });
      toast.success("Campanha excluída com sucesso!");
    },
    onError: (err: Error) => toast.error("Erro ao excluir: " + err.message),
  });

  // --- Send campaign ---
  const sendCampaignMutation = useMutation({
    mutationFn: async (campanhaId: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-send-campaign", {
        body: { campanha_id: campanhaId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-campanhas"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-campanha-funnel"] });
      toast.success("Campanha enviada!");
    },
    onError: (err: Error) => toast.error("Erro ao enviar: " + err.message),
  });

  const resetFlow = () => {
    setStep("list");
    setRecipients([]);
    setSelectedTemplateId(null);
    setCampaignName("");
    setFilters({ dateFrom: "", dateTo: "", canalBling: "205391854" });
    setReuseCampaignId(null);
    setSelectedPublicoMeses(new Set());
    setPublicoDescontoFilter("todos");
  };

  // --- Load audience from públicos de revistas ---
  const loadPublicoRevistas = async () => {
    if (selectedPublicoMeses.size === 0) {
      toast.error("Selecione pelo menos um mês");
      return;
    }
    if (!publicosRevistas) return;
    setLoadingPublico(true);
    try {
      const selectedMeses = selectedPublicoMeses.has("todos")
        ? publicosRevistas
        : publicosRevistas.filter((p) => selectedPublicoMeses.has(p.mes));

      const seenEmails = new Set<string>();
      const newRecipients: Recipient[] = [];

      for (const pub of selectedMeses) {
        for (const c of pub.contatos) {
          // Apply discount filter
          if (publicoDescontoFilter === "com_desconto" && !c.tem_desconto) continue;
          if (publicoDescontoFilter === "sem_desconto" && c.tem_desconto) continue;

          const emailKey = (c.customer_email || "").toLowerCase().trim();
          if (emailKey && seenEmails.has(emailKey)) continue;
          if (emailKey) seenEmails.add(emailKey);

          newRecipients.push({
            cliente_id: null,
            nome: c.customer_name || "",
            telefone: c.customer_phone || "",
            email: c.customer_email || "",
            tipo_documento: "revista",
            data_pedido: c.data_pedido || undefined,
            produtos_pedido: c.produtos || "seus produtos",
            valor_pedido: c.valor_total ? String(c.valor_total) : undefined,
          });
        }
      }

      // Merge with existing recipients (dedup by email)
      const existingEmails = new Set(recipients.map((r) => r.email.toLowerCase().trim()).filter(Boolean));
      const merged = [...recipients];
      for (const r of newRecipients) {
        const key = r.email.toLowerCase().trim();
        if (!key || !existingEmails.has(key)) {
          merged.push(r);
          if (key) existingEmails.add(key);
        }
      }

      setRecipients(merged);
      toast.success(`${newRecipients.length} contatos carregados do público de revistas!`);
    } catch (err: any) {
      toast.error("Erro ao carregar público: " + err.message);
    } finally {
      setLoadingPublico(false);
    }
  };

  // --- Load audience from existing campaign ---
  const loadAudienceFromCampaign = async () => {
    if (!reuseCampaignId) {
      toast.error("Selecione uma campanha");
      return;
    }
    setLoadingReuse(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_campanha_destinatarios")
        .select("*")
        .eq("campanha_id", reuseCampaignId);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info("Nenhum destinatário encontrado nesta campanha.");
        return;
      }
      const mapped: Recipient[] = data.map((d: any) => ({
        cliente_id: d.cliente_id || null,
        nome: d.nome || "",
        telefone: d.telefone || "",
        email: d.email || "",
        tipo_documento: d.tipo_documento || "indefinido",
        data_pedido: d.data_pedido || undefined,
        produtos_pedido: d.produtos_pedido || undefined,
        valor_pedido: d.valor_pedido || undefined,
      }));
      setRecipients(mapped);
      toast.success(`${mapped.length} destinatários carregados da campanha anterior!`);
    } catch (err: any) {
      toast.error("Erro ao carregar público: " + err.message);
    } finally {
      setLoadingReuse(false);
    }
  };

  // --- Funnel calculations ---
  const funnelStats = useMemo(() => {
    if (!funnelData) return null;
    const total = funnelData.length;
    const enviados = funnelData.filter((d: any) => d.status_envio === "enviado").length;
    const erros = funnelData.filter((d: any) => d.status_envio === "erro").length;

    // Aggregate button clicks
    const buttonClicks: Record<string, number> = {};
    funnelData.forEach((d: any) => {
      if (d.cliques_botoes && typeof d.cliques_botoes === "object") {
        Object.entries(d.cliques_botoes).forEach(([key, val]) => {
          if (val) buttonClicks[key] = (buttonClicks[key] || 0) + 1;
        });
      }
    });

    const visitaram = funnelData.filter((d: any) => d.visitou_link).length;
    const compraram = funnelData.filter((d: any) => d.comprou).length;
    const valorTotal = funnelData.reduce((acc: number, d: any) => acc + (d.valor_compra || 0), 0);

    return { total, enviados, erros, buttonClicks, visitaram, compraram, valorTotal };
  }, [funnelData]);

  // ===================== RENDER =====================

  // --- STEP: Campaign List ---
  if (step === "list") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Campanhas WhatsApp</h2>
            <p className="text-sm text-muted-foreground">Gerencie suas campanhas de envio em massa</p>
          </div>
          <Button onClick={() => setStep("segmentation")} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Campanha
          </Button>
        </div>

        {loadingCampaigns ? (
          <div className="flex justify-center p-8 text-muted-foreground">Carregando...</div>
        ) : !campaigns?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Target className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma campanha criada ainda.</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => setStep("segmentation")}>
                <Plus className="h-4 w-4" /> Criar primeira campanha
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {campaigns.map((c: any) => {
              const st = STATUS_MAP[c.status] || STATUS_MAP.rascunho;
              return (
                <Card
                  key={c.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setSelectedCampaignId(c.id); setStep("funnel"); }}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{c.nome}</span>
                        <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Template: {(c as any).whatsapp_templates?.nome || "—"} · Público: {c.total_publico} · Enviados: {c.total_enviados}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.status === "rascunho" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Tem certeza que deseja excluir esta campanha?")) {
                              deleteCampaignMutation.mutate(c.id);
                            }
                          }}
                          disabled={deleteCampaignMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // --- STEP: Segmentation ---
  if (step === "segmentation") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={resetFlow}><ArrowLeft className="h-4 w-4" /></Button>
          <h2 className="text-lg font-semibold">Etapa 1: Segmentação do Público</h2>
        </div>

        {/* Reuse existing audience */}
        {campaignsWithAudience && campaignsWithAudience.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usar público de campanha existente</CardTitle>
              <CardDescription>Carregue os destinatários de uma campanha anterior sem precisar buscar no Bling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Select value={reuseCampaignId || ""} onValueChange={(v) => setReuseCampaignId(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma campanha" /></SelectTrigger>
                    <SelectContent>
                      {campaignsWithAudience.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} ({c.total_publico} contatos — {format(new Date(c.created_at), "dd/MM/yyyy")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={loadAudienceFromCampaign} disabled={loadingReuse || !reuseCampaignId} className="gap-2">
                  {loadingReuse ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  Carregar Público
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Público de Revistas */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground font-medium">OU</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {publicosRevistas && publicosRevistas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Usar Público de Revistas
              </CardTitle>
              <CardDescription>Selecione meses e filtre por desconto para carregar contatos de compradores de revistas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Meses</Label>
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedPublicoMeses.has("todos")}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPublicoMeses(new Set(["todos"]));
                        } else {
                          setSelectedPublicoMeses(new Set());
                        }
                      }}
                    />
                    <span className="text-sm font-medium">Todos os meses</span>
                  </label>
                  {publicosRevistas.map((p) => {
                    const mesLabel = format(new Date(p.mes), "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
                    return (
                      <label key={p.mes} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectedPublicoMeses.has(p.mes) || selectedPublicoMeses.has("todos")}
                          disabled={selectedPublicoMeses.has("todos")}
                          onCheckedChange={(checked) => {
                            setSelectedPublicoMeses((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(p.mes);
                              else next.delete(p.mes);
                              return next;
                            });
                          }}
                        />
                        <span className="text-sm">{mesLabel} ({p.total_contatos})</span>
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">{p.com_desconto}</Badge>
                        <Badge variant="outline" className="text-xs">{p.sem_desconto}</Badge>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="space-y-2 flex-1">
                  <Label>Filtrar por desconto</Label>
                  <Select value={publicoDescontoFilter} onValueChange={(v: any) => setPublicoDescontoFilter(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="com_desconto">Com Desconto</SelectItem>
                      <SelectItem value="sem_desconto">Sem Desconto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={loadPublicoRevistas} disabled={loadingPublico || selectedPublicoMeses.size === 0} className="gap-2">
                  {loadingPublico ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  Carregar Público
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground font-medium">OU</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
            <CardDescription>Defina os critérios para selecionar o público da campanha</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início (última compra)</Label>
                <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim (última compra)</Label>
                <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Canal de Venda (Bling)</Label>
              <Select value={filters.canalBling} onValueChange={(v) => setFilters({ ...filters, canalBling: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Canais</SelectItem>
                  {blingChannels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>{ch.descricao}</SelectItem>
                  ))}
                  
                </SelectContent>
              </Select>
            </div>

            <Button onClick={searchAudience} disabled={loadingAudience} className="gap-2">
              {loadingAudience ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              {loadingAudience && searchProgress ? searchProgress : "Buscar Público"}
            </Button>
          </CardContent>
        </Card>

        {recipients.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Público Encontrado
                </CardTitle>
                <Badge className="text-lg px-3 py-1">{recipients.length} destinatários</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Tipo Doc</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.slice(0, 50).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{r.nome}</TableCell>
                        <TableCell className="text-sm font-mono">{r.telefone}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs uppercase">{r.tipo_documento}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {recipients.length > 50 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                          ... e mais {recipients.length - 50} destinatários
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end mt-4">
                <Button onClick={() => setStep("template")} className="gap-2">
                  Próximo: Selecionar Template <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // --- STEP: Template Selection ---
  if (step === "template") {
    const selectedTpl = approvedTemplates?.find((t: any) => t.id === selectedTemplateId);
    const botoes = selectedTpl?.botoes
      ? (typeof selectedTpl.botoes === "string" ? JSON.parse(selectedTpl.botoes) : selectedTpl.botoes)
      : [];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep("segmentation")}><ArrowLeft className="h-4 w-4" /></Button>
          <h2 className="text-lg font-semibold">Etapa 2: Selecionar Template</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Templates Aprovados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {!approvedTemplates?.length ? (
                <p className="text-sm text-muted-foreground">Nenhum template aprovado encontrado.</p>
              ) : (
                approvedTemplates.map((t: any) => (
                  <div
                    key={t.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedTemplateId === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    onClick={() => setSelectedTemplateId(t.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium">{t.nome}</span>
                      <Badge variant="default" className="text-xs">Aprovado</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t.categoria} · {t.idioma}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTpl ? (
                <div className="bg-[#e5ddd5] rounded-lg p-4">
                  <div className="bg-white rounded-lg p-3 shadow-sm max-w-sm">
                    <p className="text-sm whitespace-pre-wrap">{selectedTpl.corpo}</p>
                    {selectedTpl.rodape && (
                      <p className="text-xs text-muted-foreground mt-2">{selectedTpl.rodape}</p>
                    )}
                    {botoes.length > 0 && (
                      <div className="mt-2 border-t pt-2 space-y-1">
                        {botoes.map((b: any, i: number) => (
                          <div key={i} className="text-center text-sm text-blue-600 py-1 border rounded">
                            {b.text || b.texto || `Botão ${i + 1}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Selecione um template para ver o preview</p>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedTemplateId && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2">
                <Label>Nome da Campanha</Label>
                <Input placeholder="Ex: Campanha Novembro 2025" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {recipients.length} destinatários · Template: {selectedTpl?.nome}
                </p>
                <Button
                  onClick={() => createCampaignMutation.mutate()}
                  disabled={createCampaignMutation.isPending || !campaignName}
                  className="gap-2"
                >
                  {createCampaignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Criar Campanha
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // --- STEP: Funnel ---
  if (step === "funnel" && selectedCampaign) {
    const maxVal = funnelStats?.total || 1;
    const pct = (val: number) => Math.round((val / maxVal) * 100);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedCampaignId(null); setStep("list"); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{selectedCampaign.nome}</h2>
            <p className="text-xs text-muted-foreground">
              Criada em {format(new Date(selectedCampaign.created_at), "dd/MM/yyyy HH:mm")}
            </p>
          </div>
          {selectedCampaign.status === "rascunho" && (
            <Button
              size="sm"
              className="ml-auto gap-2"
              onClick={() => sendCampaignMutation.mutate(selectedCampaign.id)}
              disabled={sendCampaignMutation.isPending}
            >
              {sendCampaignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Campanha
            </Button>
          )}
        </div>

        {funnelStats && (
          <div className="space-y-3">
            {/* Público Total */}
            <FunnelBar icon={<Users className="h-5 w-5" />} label="Público Total" value={funnelStats.total} pct={100} color="bg-primary" />
            {/* Enviadas */}
            <FunnelBar icon={<MessageSquare className="h-5 w-5" />} label="Mensagens Enviadas" value={funnelStats.enviados} pct={pct(funnelStats.enviados)} color="bg-blue-500" />
            {/* Erros */}
            {funnelStats.erros > 0 && (
              <FunnelBar icon={<MessageSquare className="h-5 w-5" />} label="Erros de Envio" value={funnelStats.erros} pct={pct(funnelStats.erros)} color="bg-destructive" />
            )}
            {/* Cliques por botão */}
            {Object.entries(funnelStats.buttonClicks).map(([key, val]) => (
              <FunnelBar key={key} icon={<MousePointerClick className="h-5 w-5" />} label={`Clique: ${key}`} value={val as number} pct={pct(val as number)} color="bg-amber-500" />
            ))}
            {/* Visitaram */}
            <FunnelBar icon={<Eye className="h-5 w-5" />} label="Visitaram a Página" value={funnelStats.visitaram} pct={pct(funnelStats.visitaram)} color="bg-emerald-500" />
            {/* Compraram */}
            <FunnelBar icon={<ShoppingCart className="h-5 w-5" />} label="Compraram" value={funnelStats.compraram} pct={pct(funnelStats.compraram)} color="bg-green-600" />
            {/* Valor total */}
            <Card className="border-green-200 bg-green-50">
              <CardContent className="flex items-center gap-3 p-4">
                <DollarSign className="h-6 w-6 text-green-700" />
                <div>
                  <p className="text-sm font-medium text-green-800">Valor Total de Compras</p>
                  <p className="text-2xl font-bold text-green-700">
                    R$ {funnelStats.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function FunnelBar({ icon, label, value, pct, color }: { icon: React.ReactNode; label: string; value: number; pct: number; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="text-muted-foreground">{icon}</div>
        <div className="flex-1 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{label}</span>
            <span className="font-bold">{value}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
