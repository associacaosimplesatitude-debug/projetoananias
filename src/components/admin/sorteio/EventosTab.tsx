import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Power, PowerOff, Calendar, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import EventoDialog from "./EventoDialog";

export default function EventosTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEvento, setEditEvento] = useState<any | null>(null);

  const { data: eventos, isLoading } = useQuery({
    queryKey: ["admin-sorteio-eventos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sorteio_eventos" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["admin-sorteio-eventos-counts"],
    queryFn: async () => {
      const [parts, sess, ganh] = await Promise.all([
        supabase.from("sorteio_participantes").select("evento_id"),
        supabase.from("sorteio_sessoes").select("evento_id"),
        supabase.from("sorteio_ganhadores").select("evento_id"),
      ]);
      const reduce = (rows: any[] | null) =>
        (rows ?? []).reduce<Record<string, number>>((acc, r: any) => {
          if (!r.evento_id) return acc;
          acc[r.evento_id] = (acc[r.evento_id] ?? 0) + 1;
          return acc;
        }, {});
      return {
        participantes: reduce(parts.data as any),
        sessoes: reduce(sess.data as any),
        ganhadoras: reduce(ganh.data as any),
      };
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativar }: { id: string; ativar: boolean }) => {
      const { error } = await supabase.from("sorteio_eventos" as any).update({ ativo: ativar }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sorteio-eventos"] });
      queryClient.invalidateQueries({ queryKey: ["sorteio-evento-ativo"] });
      toast.success("Status atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sorteio_eventos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sorteio-eventos"] });
      toast.success("Evento excluído");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir (talvez existam dados vinculados)"),
  });

  const openNew = () => {
    setEditEvento(null);
    setDialogOpen(true);
  };
  const openEdit = (e: any) => {
    setEditEvento(e);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Eventos</h2>
          <p className="text-sm text-muted-foreground">
            Crie eventos com banner e textos próprios. Apenas o evento ativo aparece em <code>/sorteio</code>.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Novo Evento
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !eventos || eventos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum evento cadastrado. Clique em "Novo Evento" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {eventos.map((ev) => (
            <Card key={ev.id} className={ev.ativo ? "border-primary border-2" : ""}>
              {ev.banner_url && (
                <img src={ev.banner_url} alt={ev.nome} className="w-full h-32 object-cover rounded-t-lg" />
              )}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold truncate">{ev.nome}</h3>
                      {ev.ativo && <Badge className="bg-green-500/15 text-green-700 border-green-500/30">ATIVO</Badge>}
                    </div>
                    {ev.slug && <p className="text-xs text-muted-foreground">/{ev.slug}</p>}
                  </div>
                </div>

                {(ev.data_inicio || ev.data_fim) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {ev.data_inicio ? format(new Date(ev.data_inicio), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      {ev.data_fim ? ` até ${format(new Date(ev.data_fim), "dd/MM/yyyy", { locale: ptBR })}` : ""}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" /> {counts?.participantes[ev.id] ?? 0} participantes
                </div>

                {ev.ativo && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("sorteio:goto-sessoes"));
                        if ((counts?.sessoes[ev.id] ?? 0) === 0) {
                          setTimeout(() => window.dispatchEvent(new CustomEvent("sorteio:open-nova-sessao")), 100);
                        }
                      }}
                    >
                      {counts?.sessoes[ev.id] ?? 0} Sessões
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => window.dispatchEvent(new CustomEvent("sorteio:goto-sorteio"))}
                    >
                      {counts?.ganhadoras[ev.id] ?? 0} Ganhadoras
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {ev.ativo ? (
                    <Button size="sm" variant="outline" onClick={() => toggleAtivo.mutate({ id: ev.id, ativar: false })}>
                      <PowerOff className="w-4 h-4 mr-1" /> Desativar
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => toggleAtivo.mutate({ id: ev.id, ativar: true })}>
                      <Power className="w-4 h-4 mr-1" /> Ativar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(ev)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir evento "{ev.nome}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Os dados vinculados (participantes, sessões, ganhadoras) ficarão sem evento associado mas serão preservados.
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(ev.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EventoDialog open={dialogOpen} onOpenChange={setDialogOpen} evento={editEvento} />
    </div>
  );
}
