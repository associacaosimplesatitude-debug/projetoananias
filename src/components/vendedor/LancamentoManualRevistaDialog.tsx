import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Plus, BookOpen, Trash2, Loader2 } from "lucide-react";

interface LancamentoManualRevistaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNome: string;
}

interface Revista {
  id: string;
  titulo: string;
  faixa_etaria_alvo: string;
  categoria: string | null;
  imagem_url: string | null;
}

interface HistoricoRevista {
  id: string;
  revista_id: string;
  created_at: string;
  revista: Revista;
}

export function LancamentoManualRevistaDialog({
  open,
  onOpenChange,
  clienteId,
  clienteNome,
}: LancamentoManualRevistaDialogProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Buscar todas as revistas disponíveis
  const { data: revistas = [], isLoading: revistasLoading } = useQuery({
    queryKey: ["revistas-disponiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_revistas")
        .select("id, titulo, faixa_etaria_alvo, categoria, imagem_url")
        .order("titulo", { ascending: true });
      if (error) throw error;
      return data as Revista[];
    },
    enabled: open,
  });

  // Buscar histórico de revistas do cliente
  const { data: historico = [], isLoading: historicoLoading } = useQuery({
    queryKey: ["historico-revistas-manual", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_historico_revistas_manual")
        .select(`
          id,
          revista_id,
          created_at,
          revista:ebd_revistas(id, titulo, faixa_etaria_alvo, categoria, imagem_url)
        `)
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as HistoricoRevista[];
    },
    enabled: open && !!clienteId,
  });

  // IDs das revistas já adicionadas
  const revistasAdicionadasIds = new Set(historico.map((h) => h.revista_id));

  // Filtrar revistas pela busca e que não foram adicionadas
  const revistasFiltradas = revistas.filter(
    (r) =>
      !revistasAdicionadasIds.has(r.id) &&
      (r.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.faixa_etaria_alvo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false))
  );

  // Mutation para adicionar revista
  const adicionarMutation = useMutation({
    mutationFn: async (revistaId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ebd_historico_revistas_manual")
        .insert({
          cliente_id: clienteId,
          revista_id: revistaId,
          registrado_por: userData.user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Revista adicionada ao histórico!");
      queryClient.invalidateQueries({ queryKey: ["historico-revistas-manual", clienteId] });
    },
    onError: (error: any) => {
      console.error("Erro ao adicionar revista:", error);
      if (error?.code === "23505") {
        toast.error("Esta revista já está no histórico do cliente.");
      } else {
        toast.error("Erro ao adicionar revista ao histórico.");
      }
    },
  });

  // Mutation para remover revista
  const removerMutation = useMutation({
    mutationFn: async (historicoId: string) => {
      const { error } = await supabase
        .from("ebd_historico_revistas_manual")
        .delete()
        .eq("id", historicoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Revista removida do histórico!");
      queryClient.invalidateQueries({ queryKey: ["historico-revistas-manual", clienteId] });
    },
    onError: (error: any) => {
      console.error("Erro ao remover revista:", error);
      toast.error("Erro ao remover revista do histórico.");
    },
  });

  const isLoading = revistasLoading || historicoLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Lançamento Manual de Histórico de Revistas
          </DialogTitle>
          <DialogDescription>
            Cliente: <strong>{clienteNome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
          {/* Busca de revistas */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Buscar e Adicionar Revistas</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, faixa etária (N72, N73, Adultos...)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Lista de revistas para adicionar */}
            {searchTerm && (
              <ScrollArea className="h-[150px] border rounded-md">
                <div className="p-2 space-y-1">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : revistasFiltradas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma revista encontrada
                    </p>
                  ) : (
                    revistasFiltradas.slice(0, 10).map((revista) => (
                      <div
                        key={revista.id}
                        className="flex items-center justify-between p-2 hover:bg-muted rounded-md"
                      >
                        <div className="flex items-center gap-3">
                          {revista.imagem_url ? (
                            <img
                              src={revista.imagem_url}
                              alt={revista.titulo}
                              className="w-10 h-12 object-cover rounded"
                            />
                          ) : (
                            <div className="w-10 h-12 bg-muted rounded flex items-center justify-center">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium">{revista.titulo}</p>
                            <Badge variant="outline" className="text-xs">
                              {revista.faixa_etaria_alvo}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => adicionarMutation.mutate(revista.id)}
                          disabled={adicionarMutation.isPending}
                        >
                          {adicionarMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-1" />
                              Adicionar
                            </>
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Lista de revistas já lançadas */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Revistas Lançadas ({historico.length})
            </label>
            <ScrollArea className="h-[200px] border rounded-md">
              <div className="p-2 space-y-1">
                {historicoLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : historico.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma revista lançada manualmente
                  </p>
                ) : (
                  historico.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                    >
                      <div className="flex items-center gap-3">
                        {item.revista?.imagem_url ? (
                          <img
                            src={item.revista.imagem_url}
                            alt={item.revista.titulo}
                            className="w-10 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-12 bg-muted rounded flex items-center justify-center">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{item.revista?.titulo}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {item.revista?.faixa_etaria_alvo}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Adicionado em{" "}
                              {new Date(item.created_at).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removerMutation.mutate(item.id)}
                        disabled={removerMutation.isPending}
                      >
                        {removerMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
