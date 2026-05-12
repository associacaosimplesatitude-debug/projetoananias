import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Search,
  Send,
  ArrowLeft,
  Loader2,
  MessageSquare,
  Eye,
  Clock,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import LeadDetailModal from "./whatsapp/LeadDetailModal";
import TemplatePickerDialog from "./whatsapp/TemplatePickerDialog";
import EncaminharVendedorDialog from "./whatsapp/EncaminharVendedorDialog";
import { UserPlus, RotateCcw } from "lucide-react";

// Normalize phone: strip non-digits, remove leading "55" country code if present
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

// Generate phone variants for matching (with and without 9th digit, with and without country code)
function phoneVariants(phone: string): string[] {
  const base = normalizePhone(phone);
  const variants = new Set<string>();
  variants.add(base);
  // With country code
  variants.add("55" + base);
  // Without country code
  if (base.startsWith("55") && base.length >= 12) {
    variants.add(base.slice(2));
  }
  // 9th digit variants
  if (base.length === 10) {
    const with9 = base.slice(0, 2) + "9" + base.slice(2);
    variants.add(with9);
    variants.add("55" + with9);
  }
  if (base.length === 11 && base[2] === "9") {
    const without9 = base.slice(0, 2) + base.slice(3);
    variants.add(without9);
    variants.add("55" + without9);
  }
  // Also add the original raw phone (in case it has + or formatting)
  const raw = phone.replace(/\D/g, "");
  variants.add(raw);
  return Array.from(variants);
}

// Types
type ContactTagType = "atendendo" | "vendedor_historico" | "sem_vendedor" | "novo_contato";

interface ContactTag {
  type: ContactTagType;
  vendedorNome?: string | null;
}

interface Contact {
  telefone: string;
  nome: string;
  foto: string | null;
  ultimaMensagem: string;
  ultimaData: string;
  vendedorNome?: string | null;
  conversaId?: string | null;
  vendedorAtribuidoId?: string | null;
  vendedorAtribuidoNome?: string | null;
  vendedorHistoricoId?: string | null;
  vendedorHistoricoNome?: string | null;
  clienteId?: string | null;
  tag: ContactTag;
}

interface ChatMessage {
  id: string;
  content: string;
  direction: "sent" | "received";
  timestamp: string;
  source: "conversa" | "mensagem";
  imagemUrl?: string | null;
  audioUrl?: string | null;
  tipo?: string;
}

// ============ CONTACT LIST ============
function ContactList({
  contacts,
  selectedPhone,
  onSelect,
  searchTerm,
  onSearchChange,
  loading,
}: {
  contacts: Contact[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  loading: boolean;
}) {
  const filtered = useMemo(() => {
    if (!searchTerm) return contacts;
    const q = searchTerm.toLowerCase();
    return contacts.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) || c.telefone.includes(q)
    );
  }, [contacts, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-3 border-b bg-muted/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 bg-background"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          filtered.map((contact) => (
            <button
              key={contact.telefone}
              onClick={() => onSelect(contact.telefone)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 text-left ${
                selectedPhone === contact.telefone ? "bg-muted" : ""
              }`}
            >
              <Avatar className="h-12 w-12 shrink-0">
                {contact.foto ? (
                  <AvatarImage src={contact.foto} alt={contact.nome} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {contact.nome
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate text-foreground">
                    {contact.nome}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {contact.ultimaData
                      ? format(new Date(contact.ultimaData), "dd/MM HH:mm")
                      : ""}
                  </span>
                </div>
                {(() => {
                  const t = contact.tag;
                  if (t.type === "atendendo")
                    return (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 mt-0.5 bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
                        Em atendimento: {t.vendedorNome}
                      </Badge>
                    );
                  if (t.type === "vendedor_historico")
                    return (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 mt-0.5 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                        Vendedor: {t.vendedorNome}
                      </Badge>
                    );
                  if (t.type === "sem_vendedor")
                    return (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 mt-0.5 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                        Sem vendedor
                      </Badge>
                    );
                  return (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 mt-0.5">
                      Novo contato
                    </Badge>
                  );
                })()}
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {contact.ultimaMensagem}
                </p>
              </div>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
}

// ============ CHAT WINDOW ============
function ChatWindow({
  phone,
  contact,
  onBack,
  isMobile,
  scope = "admin",
}: {
  phone: string;
  contact: Contact | null;
  onBack: () => void;
  isMobile: boolean;
  scope?: "admin" | "vendedor";
}) {
  const [inputMsg, setInputMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showEncaminharDialog, setShowEncaminharDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["whatsapp-chat-messages", phone],
    queryFn: async () => {
      const allMessages: ChatMessage[] = [];
      const variants = phoneVariants(phone);

      // Fetch received messages from whatsapp_conversas (try all phone variants)
      const { data: conversas } = await supabase
        .from("whatsapp_conversas")
        .select("id, role, content, created_at, imagem_url, audio_url")
        .in("telefone", variants)
        .order("created_at", { ascending: true });

      (conversas || []).forEach((c: any) => {
        allMessages.push({
          id: c.id,
          content: c.content,
          direction: c.role === "user" ? "received" : "sent",
          timestamp: c.created_at,
          source: "conversa",
          imagemUrl: c.imagem_url || null,
          audioUrl: c.audio_url || null,
        });
      });

      // Fetch sent messages from whatsapp_mensagens (try all phone variants)
      const { data: mensagens } = await supabase
        .from("whatsapp_mensagens")
        .select("id, mensagem, imagem_url, tipo_mensagem, status, created_at")
        .in("telefone_destino", variants)
        .order("created_at", { ascending: true });

      // Build a set of existing sent messages from conversas to deduplicate
      const conversaSentKeys = new Set<string>();
      (conversas || []).forEach((c: any) => {
        if (c.role === "assistant" || c.role === "system") {
          // Key by content + minute-level timestamp to catch duplicates
          const minuteKey = c.created_at?.substring(0, 16) || "";
          conversaSentKeys.add(`${minuteKey}|${(c.content || "").substring(0, 80)}`);
        }
      });

      (mensagens || []).forEach((m: any) => {
        // Skip if this sent message already exists in whatsapp_conversas (avoid duplicates)
        const minuteKey = m.created_at?.substring(0, 16) || "";
        const dedupKey = `${minuteKey}|${(m.mensagem || "").substring(0, 80)}`;
        if (conversaSentKeys.has(dedupKey)) return;

        allMessages.push({
          id: m.id,
          content: m.mensagem,
          direction: "sent",
          timestamp: m.created_at,
          source: "mensagem",
          imagemUrl: m.imagem_url,
          tipo: m.tipo_mensagem,
        });
      });

      allMessages.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      return allMessages;
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputMsg.trim() || sending) return;
    setSending(true);
    try {
      const response = await supabase.functions.invoke("send-whatsapp-message", {
        body: {
          tipo_mensagem: "manual",
          telefone: phone,
          nome: contact?.nome || "",
          mensagem: inputMsg.trim(),
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      setInputMsg("");
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-chat-messages", phone],
      });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-chat-contacts"] });
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = "";
    messages.forEach((msg) => {
      const d = format(new Date(msg.timestamp), "dd/MM/yyyy");
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });
    return groups;
  }, [messages]);

  // Detecta janela de 24h: última mensagem RECEBIDA do cliente.
  const windowExpired = useMemo(() => {
    const lastReceived = [...messages]
      .reverse()
      .find((m) => m.direction === "received");
    if (!lastReceived) return true; // nunca houve entrada → precisa template
    const ageMs = Date.now() - new Date(lastReceived.timestamp).getTime();
    return ageMs > 24 * 60 * 60 * 1000;
  }, [messages]);

  // Agente IA: pausado/ativo nessa conversa
  const { data: agenteConv } = useQuery({
    queryKey: ["agente-conversa-pausa", phone],
    queryFn: async () => {
      const variants = phoneVariants(phone);
      const { data } = await (supabase as any)
        .from("agente_ia_conversas")
        .select("id, agente_pausado")
        .in("telefone", variants)
        .order("ultima_mensagem_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { id: string; agente_pausado: boolean } | null;
    },
  });
  const agentePausado = !!agenteConv?.agente_pausado;

  async function toggleAgentePausa() {
    const variants = phoneVariants(phone);
    if (agenteConv?.id) {
      const { error } = await (supabase as any)
        .from("agente_ia_conversas")
        .update({ agente_pausado: !agentePausado })
        .eq("id", agenteConv.id);
      if (error) return toast.error(error.message);
    } else {
      // Cria conversa pausada se não existir (caso vendedor queira garantir bloqueio)
      if (agentePausado) return;
      const { error } = await (supabase as any)
        .from("agente_ia_conversas")
        .insert({ telefone: variants[0], status: "ativa", agente_pausado: true });
      if (error) return toast.error(error.message);
    }
    toast.success(agentePausado ? "Agente IA retomado" : "Agente IA pausado");
    queryClient.invalidateQueries({ queryKey: ["agente-conversa-pausa", phone] });
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shadow-sm">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar className="h-10 w-10">
          {contact?.foto ? (
            <AvatarImage src={contact.foto} alt={contact.nome} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {(contact?.nome || phone)
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-foreground truncate">
            {contact?.nome || phone}
          </p>
          <p className="text-xs text-muted-foreground font-mono">{phone}</p>
        </div>
        {scope === "admin" && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (contact?.vendedorAtribuidoId && contact?.conversaId) {
                const { error } = await supabase.rpc("devolver_conversa_para_agente", {
                  _conversa_id: contact.conversaId,
                });
                if (error) return toast.error(error.message);
                toast.success("Conversa devolvida ao agente");
                queryClient.invalidateQueries({ queryKey: ["whatsapp-chat-contacts"] });
                queryClient.invalidateQueries({ queryKey: ["agente-conversa-pausa", phone] });
              } else {
                setShowEncaminharDialog(true);
              }
            }}
            className="shrink-0"
          >
            {contact?.vendedorAtribuidoId ? (
              <>
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Devolver à IA
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-1.5" />
                Encaminhar
              </>
            )}
          </Button>
        )}
        <Button
          variant={agentePausado ? "default" : "outline"}
          size="sm"
          onClick={toggleAgentePausa}
          title={agentePausado ? "Retomar Agente IA" : "Pausar Agente IA"}
          className="shrink-0"
        >
          {agentePausado ? "▶️ Retomar IA" : "⏸️ Pausar IA"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowLeadModal(true)}
          title="Visualizar Lead"
          className="shrink-0"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>

      <EncaminharVendedorDialog
        open={showEncaminharDialog}
        onOpenChange={setShowEncaminharDialog}
        conversaId={contact?.conversaId || null}
        vendedorHistoricoId={contact?.vendedorHistoricoId || null}
        vendedorHistoricoNome={contact?.vendedorHistoricoNome || null}
      />

      {agentePausado && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200">
          Agente IA pausado nessa conversa. Você está atendendo manualmente.
        </div>
      )}

      {/* Messages area */}
      <ScrollArea className="flex-1 px-4 py-2" style={{ background: "hsl(var(--muted) / 0.2)" }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span className="text-[11px] bg-muted text-muted-foreground px-3 py-1 rounded-full">
                  {group.date}
                </span>
              </div>
              {group.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Banner janela 24h expirada */}
      {windowExpired && (
        <div className="px-4 py-2.5 border-t bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 flex items-center gap-3">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-900 dark:text-amber-200 flex-1">
            Janela de 24h expirou. Para continuar a conversa, envie uma mensagem de template aprovada pela Meta.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900"
            onClick={() => setShowTemplateDialog(true)}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Selecionar Template
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-center gap-2 px-4 py-3 border-t bg-card">
        <Input
          placeholder={windowExpired ? "Janela expirada — use um template" : "Digite uma mensagem..."}
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          className="flex-1"
        />
        {!windowExpired && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowTemplateDialog(true)}
            title="Enviar template"
            className="shrink-0"
          >
            <FileText className="h-4 w-4" />
          </Button>
        )}
        <Button
          onClick={handleSend}
          disabled={!inputMsg.trim() || sending}
          size="icon"
          className="shrink-0"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <LeadDetailModal
        open={showLeadModal}
        onOpenChange={setShowLeadModal}
        phone={phone}
      />

      <TemplatePickerDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        telefone={phone}
        contactName={contact?.nome || ""}
        onSent={() => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-chat-messages", phone] });
          queryClient.invalidateQueries({ queryKey: ["whatsapp-chat-contacts"] });
          queryClient.invalidateQueries({ queryKey: ["agente-conversa-pausa", phone] });
        }}
      />
    </div>
  );
}

// ============ MESSAGE BUBBLE ============
function MessageBubble({ message }: { message: ChatMessage }) {
  const isSent = message.direction === "sent";

  return (
    <div className={`flex mb-1.5 ${isSent ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
          isSent
            ? "bg-[hsl(142,70%,35%)] text-white rounded-br-sm"
            : "bg-card text-foreground border border-border/50 rounded-bl-sm"
        }`}
      >
        {message.source === "mensagem" && message.tipo && (
          <span
            className={`text-[10px] font-medium block mb-1 ${
              isSent ? "text-white/70" : "text-muted-foreground"
            }`}
          >
            📋 {message.tipo}
          </span>
        )}

        {message.imagemUrl && (
          <div className="mb-1.5">
            <img
              src={message.imagemUrl}
              alt="Imagem"
              className="max-w-full rounded-md max-h-60 object-cover cursor-pointer"
              onClick={() => window.open(message.imagemUrl!, "_blank")}
            />
          </div>
        )}

        {message.audioUrl && (
          <div className="mb-1.5">
            <audio controls preload="metadata" className="max-w-full h-10">
              <source src={message.audioUrl} />
              Seu navegador não suporta áudio.
            </audio>
          </div>
        )}

        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

        <span
          className={`text-[10px] float-right ml-2 mt-1 ${
            isSent ? "text-white/60" : "text-muted-foreground"
          }`}
        >
          {format(new Date(message.timestamp), "HH:mm")}
        </span>
      </div>
    </div>
  );
}

// ============ EMPTY STATE ============
function EmptyChat() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 bg-muted/10">
      <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
        <MessageSquare className="h-10 w-10" />
      </div>
      <p className="text-lg font-medium text-foreground">WhatsApp Chat</p>
      <p className="text-sm">Selecione uma conversa para começar</p>
    </div>
  );
}

// ============ MAIN COMPONENT ============
export interface WhatsAppChatProps {
  scope?: "admin" | "vendedor";
  vendedorId?: string | null;
}

export default function WhatsAppChat({ scope = "admin", vendedorId = null }: WhatsAppChatProps = {}) {
  const isMobile = useIsMobile();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["whatsapp-chat-contacts", scope, vendedorId],
    queryFn: async () => {
      // Get all unique phones from conversas
      const { data: conversas } = await supabase
        .from("whatsapp_conversas")
        .select("telefone, content, created_at")
        .order("created_at", { ascending: false });

      const { data: mensagens } = await supabase
        .from("whatsapp_mensagens")
        .select("telefone_destino, nome_destino, mensagem, created_at")
        .order("created_at", { ascending: false });

      // Build phone map keyed by normalized phone
      const phoneMap: Record<
        string,
        { nome: string; ultimaMensagem: string; ultimaData: string; rawPhones: Set<string> }
      > = {};

      const upsert = (
        rawPhone: string,
        nome: string,
        content: string,
        createdAt: string,
      ) => {
        if (!rawPhone) return;
        const key = normalizePhone(rawPhone);
        if (!key) return;
        const snippet = (content || "").substring(0, 60);
        const existing = phoneMap[key];
        if (!existing) {
          phoneMap[key] = {
            nome: nome || rawPhone,
            ultimaMensagem: snippet,
            ultimaData: createdAt,
            rawPhones: new Set([rawPhone]),
          };
          return;
        }
        existing.rawPhones.add(rawPhone);
        if (nome && (existing.nome === existing.nome.replace(/\D/g, "") || /^\d+$/.test(existing.nome))) {
          existing.nome = nome;
        }
        if (new Date(createdAt) > new Date(existing.ultimaData)) {
          existing.ultimaMensagem = snippet;
          existing.ultimaData = createdAt;
        }
      };

      (conversas || []).forEach((c: any) => {
        upsert(c.telefone, c.telefone, c.content, c.created_at);
      });

      (mensagens || []).forEach((m: any) => {
        upsert(m.telefone_destino, m.nome_destino, m.mensagem, m.created_at);
      });

      const allRawPhones = Array.from(
        new Set(Object.values(phoneMap).flatMap((v) => Array.from(v.rawPhones))),
      );
      const { data: webhooks } = allRawPhones.length
        ? await supabase
            .from("whatsapp_webhooks")
            .select("telefone, payload")
            .eq("evento", "ReceivedCallback")
            .in("telefone", allRawPhones)
            .order("created_at", { ascending: false })
        : { data: [] as any[] };

      const photoMap: Record<string, { nome: string; foto: string | null }> = {};
      (webhooks || []).forEach((w: any) => {
        const key = normalizePhone(w.telefone || "");
        if (!key) return;
        if (!photoMap[key] && w.payload) {
          photoMap[key] = {
            nome: w.payload?.senderName || "",
            foto: w.payload?.photo || null,
          };
        }
      });

      const phones = Object.keys(phoneMap);

      // Atribuições e clientes via agente_ia_conversas
      const allVariants = Array.from(
        new Set(phones.flatMap((p) => phoneVariants(p))),
      );
      const { data: agenteConversas } = allVariants.length
        ? await (supabase as any)
            .from("agente_ia_conversas")
            .select(
              "id, telefone, cliente_id, vendedor_atribuido_id, ultima_mensagem_em, cliente:ebd_clientes!cliente_id(vendedor_id)",
            )
            .in("telefone", allVariants)
            .order("ultima_mensagem_em", { ascending: false })
        : { data: [] as any[] };

      // Map por telefone normalizado (mais recente vence)
      const atribuicaoMap: Record<
        string,
        {
          conversaId: string;
          clienteId: string | null;
          vendedorAtribuidoId: string | null;
          vendedorHistoricoId: string | null;
        }
      > = {};
      (agenteConversas || []).forEach((row: any) => {
        const key = normalizePhone(row.telefone || "");
        if (!key || atribuicaoMap[key]) return;
        atribuicaoMap[key] = {
          conversaId: row.id,
          clienteId: row.cliente_id || null,
          vendedorAtribuidoId: row.vendedor_atribuido_id || null,
          vendedorHistoricoId: row.cliente?.vendedor_id || null,
        };
      });

      // Vendedor de leads de reativação como fallback
      const { data: leads } = await supabase
        .from("ebd_leads_reativacao")
        .select("telefone, vendedor_id")
        .not("vendedor_id", "is", null)
        .not("telefone", "is", null);
      const leadVendedorByVariant: Record<string, { id: string }> = {};
      (leads || []).forEach((l: any) => {
        if (l.telefone && l.vendedor_id) {
          phoneVariants(l.telefone).forEach((v) => {
            leadVendedorByVariant[v] = { id: l.vendedor_id };
          });
        }
      });

      // Fallback: cruzar com ebd_clientes diretamente pelo telefone (cliente já cadastrado
      // mesmo que agente_ia_conversas.cliente_id ainda não esteja preenchido).
      const { data: clientesByPhone } = allVariants.length
        ? await supabase
            .from("ebd_clientes")
            .select("id, telefone, vendedor_id, updated_at")
            .not("telefone", "is", null)
            .in("telefone", allVariants)
            .order("updated_at", { ascending: false })
        : { data: [] as any[] };
      const clienteByVariant: Record<
        string,
        { clienteId: string; vendedorId: string | null }
      > = {};
      (clientesByPhone || []).forEach((c: any) => {
        if (!c.telefone) return;
        phoneVariants(c.telefone).forEach((v) => {
          if (clienteByVariant[v]) return; // primeiro = mais recente
          clienteByVariant[v] = {
            clienteId: c.id,
            vendedorId: c.vendedor_id || null,
          };
        });
      });

      // Fallback adicional (mesma fonte usada no LeadDetailModal):
      // pedidos Shopify com vendedor_id vinculado pelo telefone do cliente.
      const { data: pedidosByPhone } = allVariants.length
        ? await supabase
            .from("ebd_shopify_pedidos")
            .select("customer_phone, vendedor_id, created_at")
            .not("vendedor_id", "is", null)
            .not("customer_phone", "is", null)
            .in("customer_phone", allVariants)
            .order("created_at", { ascending: false })
        : { data: [] as any[] };
      const pedidoVendedorByVariant: Record<string, { id: string }> = {};
      (pedidosByPhone || []).forEach((p: any) => {
        if (!p.customer_phone || !p.vendedor_id) return;
        phoneVariants(p.customer_phone).forEach((v) => {
          if (pedidoVendedorByVariant[v]) return; // primeiro = mais recente
          pedidoVendedorByVariant[v] = { id: p.vendedor_id };
        });
      });

      // Resolver nomes de vendedores via uma única query (embed PostgREST retorna null)
      const vendedorIds = Array.from(
        new Set(
          [
            ...Object.values(atribuicaoMap).flatMap((a) => [
              a.vendedorAtribuidoId,
              a.vendedorHistoricoId,
            ]),
            ...Object.values(leadVendedorByVariant).map((l) => l.id),
            ...Object.values(clienteByVariant).map((c) => c.vendedorId),
            ...Object.values(pedidoVendedorByVariant).map((p) => p.id),
          ].filter((id): id is string => !!id),
        ),
      );
      const { data: vendedoresRows } = vendedorIds.length
        ? await supabase.from("vendedores").select("id, nome").in("id", vendedorIds)
        : { data: [] as any[] };
      const vendedorById: Record<string, string> = {};
      (vendedoresRows || []).forEach((v: any) => {
        if (v?.id) vendedorById[v.id] = v.nome || "";
      });

      const contactList: Contact[] = phones.map((phone) => {
        const variants = phoneVariants(phone);
        const atrib = atribuicaoMap[phone];
        const fallbackLead = variants.reduce<{ id: string } | null>(
          (acc, v) => acc || leadVendedorByVariant[v] || null,
          null,
        );
        const fallbackCliente = variants.reduce<
          { clienteId: string; vendedorId: string | null } | null
        >((acc, v) => acc || clienteByVariant[v] || null, null);
        const fallbackPedido = variants.reduce<{ id: string } | null>(
          (acc, v) => acc || pedidoVendedorByVariant[v] || null,
          null,
        );

        const vendedorAtribuidoId = atrib?.vendedorAtribuidoId || null;
        const vendedorAtribuidoNome = vendedorAtribuidoId
          ? vendedorById[vendedorAtribuidoId] || null
          : null;
        const vendedorHistoricoId =
          atrib?.vendedorHistoricoId ||
          fallbackCliente?.vendedorId ||
          fallbackLead?.id ||
          fallbackPedido?.id ||
          null;
        const vendedorHistoricoNome = vendedorHistoricoId
          ? vendedorById[vendedorHistoricoId] || null
          : null;
        const clienteId = atrib?.clienteId || fallbackCliente?.clienteId || null;

        let tag: ContactTag;
        if (vendedorAtribuidoId) {
          tag = { type: "atendendo", vendedorNome: vendedorAtribuidoNome };
        } else if (vendedorHistoricoNome) {
          tag = { type: "vendedor_historico", vendedorNome: vendedorHistoricoNome };
        } else if (clienteId) {
          tag = { type: "sem_vendedor" };
        } else {
          tag = { type: "novo_contato" };
        }

        return {
          telefone: phone,
          nome: photoMap[phone]?.nome || phoneMap[phone].nome || phone,
          foto: photoMap[phone]?.foto || null,
          ultimaMensagem: phoneMap[phone].ultimaMensagem,
          ultimaData: phoneMap[phone].ultimaData,
          vendedorNome: vendedorAtribuidoNome || vendedorHistoricoNome,
          conversaId: atrib?.conversaId || null,
          clienteId,
          vendedorAtribuidoId,
          vendedorAtribuidoNome,
          vendedorHistoricoId,
          vendedorHistoricoNome,
          tag,
        };
      });

      let scoped = contactList;
      if (scope === "vendedor" && vendedorId) {
        scoped = contactList.filter((c) => c.vendedorAtribuidoId === vendedorId);
      }

      scoped.sort(
        (a, b) =>
          new Date(b.ultimaData).getTime() - new Date(a.ultimaData).getTime()
      );

      return scoped;
    },
    refetchInterval: 15000,
  });

  const selectedContact = useMemo(
    () => contacts.find((c) => c.telefone === selectedPhone) || null,
    [contacts, selectedPhone]
  );

  const handleSelectContact = (phone: string) => {
    setSelectedPhone(phone);
  };

  if (isMobile) {
    if (selectedPhone) {
      return (
        <div className="h-[calc(100vh-200px)] rounded-lg border overflow-hidden">
          <ChatWindow
            phone={selectedPhone}
            contact={selectedContact}
            onBack={() => setSelectedPhone(null)}
            isMobile
          />
        </div>
      );
    }
    return (
      <div className="h-[calc(100vh-200px)] rounded-lg border overflow-hidden">
        <ContactList
          contacts={contacts}
          selectedPhone={selectedPhone}
          onSelect={handleSelectContact}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          loading={loadingContacts}
        />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] rounded-lg border overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
          <ContactList
            contacts={contacts}
            selectedPhone={selectedPhone}
            onSelect={handleSelectContact}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            loading={loadingContacts}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={70}>
          {selectedPhone ? (
            <ChatWindow
              phone={selectedPhone}
              contact={selectedContact}
              onBack={() => setSelectedPhone(null)}
              isMobile={false}
            />
          ) : (
            <EmptyChat />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
