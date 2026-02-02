import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Calendar, 
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { format, isBefore, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRoyaltiesAuth } from "@/hooks/useRoyaltiesAuth";

interface Contrato {
  id: string;
  data_inicio: string;
  data_termino: string;
  pdf_url: string | null;
  created_at: string;
  livro?: {
    id: string;
    titulo: string;
  } | null;
}

function getStatusContrato(dataInicio: string, dataTermino: string) {
  const hoje = new Date();
  const inicio = parseISO(dataInicio);
  const fim = parseISO(dataTermino);

  if (isBefore(hoje, inicio)) {
    return { label: "Futuro", variant: "secondary" as const, icon: Clock };
  }
  if (isAfter(hoje, fim)) {
    return { label: "Expirado", variant: "destructive" as const, icon: AlertCircle };
  }
  return { label: "Vigente", variant: "default" as const, icon: CheckCircle };
}

export default function AutorContratos() {
  const { autorId } = useRoyaltiesAuth();

  const { data: contratos, isLoading } = useQuery({
    queryKey: ["autor-contratos", autorId],
    queryFn: async () => {
      if (!autorId) return [];

      const { data, error } = await supabase
        .from("royalties_contratos")
        .select(`
          id,
          data_inicio,
          data_termino,
          pdf_url,
          created_at,
          livro:royalties_livros(id, titulo)
        `)
        .eq("autor_id", autorId)
        .order("data_inicio", { ascending: false });

      if (error) throw error;
      return data as unknown as Contrato[];
    },
    enabled: !!autorId,
  });

  const handleViewPdf = async (pdfUrl: string) => {
    try {
      const { data } = await supabase.storage
        .from("royalties-contratos")
        .createSignedUrl(pdfUrl, 3600);

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error) {
      console.error("Erro ao gerar URL do PDF:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Meu Contrato</h1>
          <p className="text-muted-foreground">
            Visualize os detalhes do seu contrato
          </p>
        </div>
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-48 mb-4" />
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meu Contrato</h1>
        <p className="text-muted-foreground">
          Visualize os detalhes e o documento do seu contrato
        </p>
      </div>

      {contratos?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhum contrato registrado ainda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {contratos?.map((contrato) => {
            const status = getStatusContrato(contrato.data_inicio, contrato.data_termino);
            const StatusIcon = status.icon;
            const livroTitulo = contrato.livro?.titulo;

            return (
              <Card key={contrato.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {livroTitulo || "Contrato de Royalties"}
                        </CardTitle>
                        {livroTitulo && (
                          <p className="text-sm text-muted-foreground">
                            Livro: {livroTitulo}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={status.variant} className="flex items-center gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Datas de Vigência - Bem Visíveis */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          Início
                        </p>
                        <p className="text-lg font-semibold">
                          {format(parseISO(contrato.data_inicio), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          Término
                        </p>
                        <p className="text-lg font-semibold">
                          {format(parseISO(contrato.data_termino), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Botão Ver PDF */}
                  {contrato.pdf_url ? (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => handleViewPdf(contrato.pdf_url!)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver Contrato em PDF
                    </Button>
                  ) : (
                    <div className="text-center text-sm text-muted-foreground py-2">
                      PDF não disponível
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
