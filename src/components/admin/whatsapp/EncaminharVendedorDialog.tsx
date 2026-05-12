import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, UserCheck, Star } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversaId: string | null;
  vendedorHistoricoId?: string | null;
  vendedorHistoricoNome?: string | null;
  onSuccess?: () => void;
}

export default function EncaminharVendedorDialog({
  open,
  onOpenChange,
  conversaId,
  vendedorHistoricoId,
  vendedorHistoricoNome,
  onSuccess,
}: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: vendedores = [], isLoading } = useQuery({
    queryKey: ["vendedores-ativos-encaminhamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome, email, status, tipo_perfil")
        .eq("status", "Ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return vendedores;
    const q = search.toLowerCase();
    return vendedores.filter(
      (v) => v.nome.toLowerCase().includes(q) || v.email.toLowerCase().includes(q),
    );
  }, [vendedores, search]);

  async function handleConfirm() {
    if (!conversaId || !selected) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("encaminhar_conversa_para_vendedor", {
        _conversa_id: conversaId,
        _vendedor_id: selected,
      });
      if (error) throw error;
      toast.success("Conversa encaminhada para o vendedor");
      queryClient.invalidateQueries({ queryKey: ["agente-conversa-pausa"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-chat-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas-atribuicoes"] });
      onSuccess?.();
      onOpenChange(false);
      setSelected(null);
      setSearch("");
    } catch (err: any) {
      toast.error("Erro ao encaminhar: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Encaminhar para vendedor</DialogTitle>
          <DialogDescription>
            O agente IA será pausado e o vendedor escolhido passa a atender essa conversa.
          </DialogDescription>
        </DialogHeader>

        {vendedorHistoricoId && vendedorHistoricoNome && (
          <button
            type="button"
            onClick={() => setSelected(vendedorHistoricoId)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md border text-left text-sm transition-colors ${
              selected === vendedorHistoricoId
                ? "border-primary bg-primary/10"
                : "border-border hover:bg-muted/50"
            }`}
          >
            <Star className="h-4 w-4 text-amber-500" />
            <div className="flex-1">
              <p className="font-medium">{vendedorHistoricoNome}</p>
              <p className="text-xs text-muted-foreground">Vendedor já vinculado a este cliente</p>
            </div>
          </button>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vendedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-64 border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhum vendedor encontrado
            </p>
          ) : (
            filtered.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelected(v.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-b hover:bg-muted/50 transition-colors ${
                  selected === v.id ? "bg-primary/10" : ""
                }`}
              >
                <UserCheck
                  className={`h-4 w-4 ${
                    selected === v.id ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{v.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.email}</p>
                </div>
                {v.tipo_perfil && v.tipo_perfil !== "vendedor" && (
                  <Badge variant="outline" className="text-[10px]">
                    {v.tipo_perfil}
                  </Badge>
                )}
              </button>
            ))
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selected || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
