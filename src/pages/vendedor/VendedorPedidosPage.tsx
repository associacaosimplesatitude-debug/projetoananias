import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { VendedorPedidosTab } from "@/components/vendedor/VendedorPedidosTab";
import { useVendedor } from "@/hooks/useVendedor";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Proposta {
  id: string;
  token: string;
  cliente_nome: string;
  cliente_cnpj: string | null;
  valor_total: number;
  status: string;
  created_at: string;
  confirmado_em: string | null;
}

export default function VendedorPedidosPage() {
  const { vendedor, isLoading } = useVendedor();

  const { data: propostas, isLoading: isLoadingPropostas } = useQuery({
    queryKey: ["vendedor-propostas", vendedor?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_propostas")
        .select("*")
        .eq("vendedor_id", vendedor!.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Proposta[];
    },
    enabled: !!vendedor?.id,
  });

  const copyLink = async (token: string) => {
    const link = `${window.location.origin}/proposta/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const propostasPendentes = propostas?.filter(p => p.status === "PROPOSTA_PENDENTE") || [];
  const propostasAceitas = propostas?.filter(p => p.status === "PROPOSTA_ACEITA") || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Pedidos e Propostas</h2>
        <p className="text-muted-foreground">Acompanhe pedidos e propostas digitais</p>
      </div>

      <Tabs defaultValue="propostas">
        <TabsList>
          <TabsTrigger value="propostas" className="flex items-center gap-2">
            Propostas Digitais
            {propostasPendentes.length > 0 && (
              <Badge variant="secondary" className="ml-1">{propostasPendentes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos Confirmados</TabsTrigger>
        </TabsList>

        <TabsContent value="propostas" className="space-y-4 mt-4">
          {isLoadingPropostas ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : propostas?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma proposta gerada ainda
            </div>
          ) : (
            <div className="space-y-3">
              {propostas?.map((proposta) => (
                <Card key={proposta.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{proposta.cliente_nome}</span>
                          <Badge variant={proposta.status === "PROPOSTA_PENDENTE" ? "secondary" : "default"}>
                            {proposta.status === "PROPOSTA_PENDENTE" ? (
                              <><Clock className="w-3 h-3 mr-1" /> Pendente</>
                            ) : (
                              <><CheckCircle className="w-3 h-3 mr-1" /> Aceita</>
                            )}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          R$ {proposta.valor_total.toFixed(2)} • Criada em {format(new Date(proposta.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                        {proposta.confirmado_em && (
                          <p className="text-xs text-green-600">
                            Confirmada em {format(new Date(proposta.confirmado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyLink(proposta.token)}>
                          <Copy className="h-4 w-4 mr-1" /> Copiar Link
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/proposta/${proposta.token}`} target="_blank">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pedidos" className="mt-4">
          <VendedorPedidosTab vendedorId={vendedor?.id || ""} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
