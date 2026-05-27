import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Send, CheckCircle2, Eye, MousePointerClick, ChevronLeft, XCircle, Copy } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type TimelineStep = { at: string | null; ok: boolean; bounced?: boolean };
type EmailItem = {
  id: string;
  destinatario: string;
  assunto: string;
  status: string;
  erro: string | null;
  tipo_envio: string | null;
  resend_email_id: string | null;
  from: string | null;
  dados_enviados: any;
  timeline: {
    enviado: TimelineStep;
    entregue: TimelineStep;
    aberto: TimelineStep;
    clicou: TimelineStep;
  };
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  email: string | null;
  licencaId?: string | null;
}

function statusBadge(item: EmailItem) {
  if (item.timeline.clicou.ok) return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-0">Clicou</Badge>;
  if (item.timeline.aberto.ok) return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0">Aberto</Badge>;
  if (item.timeline.entregue.bounced) return <Badge variant="destructive">Bounced</Badge>;
  if (item.timeline.entregue.ok) return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">Entregue</Badge>;
  if (item.timeline.enviado.ok) return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-0">Enviado</Badge>;
  return <Badge variant="destructive">Falhou</Badge>;
}

function TimelineStepUI({
  label,
  step,
  icon: Icon,
  color,
}: {
  label: string;
  step: TimelineStep;
  icon: any;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 min-w-[110px]">
      <div
        className={`h-12 w-12 rounded-full flex items-center justify-center border-2 ${
          step.ok ? color : "bg-muted border-muted text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <Badge
        variant="outline"
        className={step.ok ? "" : "text-muted-foreground"}
      >
        {label}
      </Badge>
      <span className="text-[11px] text-muted-foreground text-center">
        {step.at ? format(new Date(step.at), "dd 'de' MMM, HH:mm", { locale: ptBR }) : "—"}
      </span>
    </div>
  );
}

export function EmailsClienteDialog({ open, onOpenChange, email, licencaId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["emails-cliente", email, licencaId],
    enabled: open && (!!email || !!licencaId),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("revista-emails-cliente", {
        body: { email, licenca_id: licencaId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { email: string; emails: EmailItem[] };
    },
  });

  const emails = data?.emails || [];
  const selected = emails.find((e) => e.id === selectedId) || null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setSelectedId(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl p-0 gap-0">
        <DialogHeader className="p-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-3">
            {selected && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedId(null)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <Mail className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-normal">E-mail</span>
              <span className="text-base font-semibold">{email || "—"}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selected ? (
            // === DETAIL VIEW ===
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">De</p>
                  <p className="truncate" title={selected.from || ""}>{selected.from || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Assunto</p>
                  <p className="truncate" title={selected.assunto}>{selected.assunto}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Para</p>
                  <p className="truncate">{selected.destinatario}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">ID</p>
                  <div className="flex items-center gap-1">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate flex-1">
                      {selected.resend_email_id || selected.id.slice(0, 8)}
                    </code>
                    {selected.resend_email_id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          navigator.clipboard.writeText(selected.resend_email_id!);
                          toast.success("ID copiado");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase mb-3">Eventos por e-mail</p>
                <div className="bg-muted/30 rounded-lg p-4 flex items-start justify-around overflow-x-auto">
                  <TimelineStepUI label="Enviado" step={selected.timeline.enviado} icon={Send} color="bg-slate-100 border-slate-300 text-slate-700" />
                  <div className="flex-1 h-px bg-border mt-6 mx-2" />
                  <TimelineStepUI label={selected.timeline.entregue.bounced ? "Bounce" : "Entregue"} step={selected.timeline.entregue} icon={selected.timeline.entregue.bounced ? XCircle : CheckCircle2} color={selected.timeline.entregue.bounced ? "bg-red-100 border-red-300 text-red-700" : "bg-green-100 border-green-300 text-green-700"} />
                  <div className="flex-1 h-px bg-border mt-6 mx-2" />
                  <TimelineStepUI label="Aberto" step={selected.timeline.aberto} icon={Eye} color="bg-blue-100 border-blue-300 text-blue-700" />
                  <div className="flex-1 h-px bg-border mt-6 mx-2" />
                  <TimelineStepUI label="Clicou" step={selected.timeline.clicou} icon={MousePointerClick} color="bg-purple-100 border-purple-300 text-purple-700" />
                </div>
              </div>

              {selected.erro && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <p className="font-medium mb-1">Erro:</p>
                  <p className="text-xs">{selected.erro}</p>
                </div>
              )}
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">
              Nenhum email registrado para este cliente.
            </div>
          ) : (
            // === LIST VIEW ===
            <div className="divide-y">
              {emails.map((item) => (
                <button
                  key={item.id}
                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.destinatario}</p>
                  </div>
                  <div className="flex-shrink-0">{statusBadge(item)}</div>
                  <div className="flex-1 min-w-0 hidden md:block">
                    <p className="text-sm text-muted-foreground truncate" title={item.assunto}>
                      {item.assunto}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {item.timeline.enviado.at
                      ? formatDistanceToNow(new Date(item.timeline.enviado.at), { addSuffix: true, locale: ptBR })
                      : "—"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
