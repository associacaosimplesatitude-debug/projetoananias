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
  Image as ImageIcon,
  Mic,
  Loader2,
  MessageSquare,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Types
interface Contact {
  telefone: string;
  nome: string;
  foto: string | null;
  ultimaMensagem: string;
  ultimaData: string;
}

interface ChatMessage {
  id: string;
  content: string;
  direction: "sent" | "received";
  timestamp: string;
  source: "conversa" | "mensagem";
  imagemUrl?: string | null;
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
      {/* Header */}
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

      {/* Contact List */}
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
}: {
  phone: string;
  contact: Contact | null;
  onBack: () => void;
  isMobile: boolean;
}) {
  const [inputMsg, setInputMsg] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch messages for this phone
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["whatsapp-chat-messages", phone],
    queryFn: async () => {
      const allMessages: ChatMessage[] = [];

      // 1. From whatsapp_conversas
      const { data: conversas } = await supabase
        .from("whatsapp_conversas")
        .select("id, role, content, created_at")
        .eq("telefone", phone)
        .order("created_at", { ascending: true });

      (conversas || []).forEach((c: any) => {
        allMessages.push({
          id: c.id,
          content: c.content,
          direction: c.role === "user" ? "received" : "sent",
          timestamp: c.created_at,
          source: "conversa",
        });
      });

      // 2. From whatsapp_mensagens
      const { data: mensagens } = await supabase
        .from("whatsapp_mensagens")
        .select("id, mensagem, imagem_url, tipo_mensagem, status, created_at")
        .eq("telefone_destino", phone)
        .order("created_at", { ascending: true });

      (mensagens || []).forEach((m: any) => {
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

      // Sort by timestamp
      allMessages.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      return allMessages;
    },
    refetchInterval: 10000,
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
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

  // Group messages by date
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
        <div className="min-w-0">
          <p className="font-medium text-sm text-foreground truncate">
            {contact?.nome || phone}
          </p>
          <p className="text-xs text-muted-foreground font-mono">{phone}</p>
        </div>
      </div>

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
              {/* Date separator */}
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

      {/* Input area */}
      <div className="flex items-center gap-2 px-4 py-3 border-t bg-card">
        <Input
          placeholder="Digite uma mensagem..."
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          className="flex-1"
        />
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
        {/* Source badge for system messages */}
        {message.source === "mensagem" && message.tipo && (
          <span
            className={`text-[10px] font-medium block mb-1 ${
              isSent ? "text-white/70" : "text-muted-foreground"
            }`}
          >
            📋 {message.tipo}
          </span>
        )}

        {/* Image */}
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

        {/* Text content */}
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

        {/* Timestamp */}
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
export default function WhatsAppChat() {
  const isMobile = useIsMobile();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch contact list
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["whatsapp-chat-contacts"],
    queryFn: async () => {
      // Get all unique phones from conversas
      const { data: conversas } = await supabase
        .from("whatsapp_conversas")
        .select("telefone, content, created_at")
        .order("created_at", { ascending: false });

      // Get all unique phones from mensagens
      const { data: mensagens } = await supabase
        .from("whatsapp_mensagens")
        .select("telefone_destino, nome_destino, mensagem, created_at")
        .order("created_at", { ascending: false });

      // Build phone map
      const phoneMap: Record<
        string,
        { nome: string; ultimaMensagem: string; ultimaData: string }
      > = {};

      (conversas || []).forEach((c: any) => {
        if (!phoneMap[c.telefone]) {
          phoneMap[c.telefone] = {
            nome: c.telefone,
            ultimaMensagem: c.content?.substring(0, 60) || "",
            ultimaData: c.created_at,
          };
        }
      });

      (mensagens || []).forEach((m: any) => {
        const phone = m.telefone_destino;
        if (!phone) return;
        if (!phoneMap[phone]) {
          phoneMap[phone] = {
            nome: m.nome_destino || phone,
            ultimaMensagem: m.mensagem?.substring(0, 60) || "",
            ultimaData: m.created_at,
          };
        } else {
          // Update name if we have one
          if (m.nome_destino && phoneMap[phone].nome === phone) {
            phoneMap[phone].nome = m.nome_destino;
          }
          // Update last message if more recent
          if (
            new Date(m.created_at) > new Date(phoneMap[phone].ultimaData)
          ) {
            phoneMap[phone].ultimaMensagem =
              m.mensagem?.substring(0, 60) || "";
            phoneMap[phone].ultimaData = m.created_at;
          }
        }
      });

      // Get webhook info for names and photos
      const phones = Object.keys(phoneMap);
      const { data: webhooks } = await supabase
        .from("whatsapp_webhooks")
        .select("telefone, payload")
        .eq("evento", "ReceivedCallback")
        .in("telefone", phones)
        .order("created_at", { ascending: false });

      const photoMap: Record<string, { nome: string; foto: string | null }> =
        {};
      (webhooks || []).forEach((w: any) => {
        if (!photoMap[w.telefone] && w.payload) {
          photoMap[w.telefone] = {
            nome: w.payload?.senderName || "",
            foto: w.payload?.photo || null,
          };
        }
      });

      // Build contact list
      const contactList: Contact[] = phones.map((phone) => ({
        telefone: phone,
        nome:
          photoMap[phone]?.nome ||
          phoneMap[phone].nome ||
          phone,
        foto: photoMap[phone]?.foto || null,
        ultimaMensagem: phoneMap[phone].ultimaMensagem,
        ultimaData: phoneMap[phone].ultimaData,
      }));

      // Sort by most recent
      contactList.sort(
        (a, b) =>
          new Date(b.ultimaData).getTime() - new Date(a.ultimaData).getTime()
      );

      return contactList;
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

  // Mobile: show either list or chat
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

  // Desktop: side by side
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
