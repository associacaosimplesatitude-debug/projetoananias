import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Download, FileImage, FileVideo, File, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AlunoMateriaisProps {
  turmaId: string | null;
}

const TIPO_ICONS: Record<string, React.ElementType> = {
  documento: FileText,
  imagem: FileImage,
  video: FileVideo,
  outro: File,
};

export function AlunoMateriais({ turmaId }: AlunoMateriaisProps) {
  const { data: materiais, isLoading } = useQuery({
    queryKey: ["aluno-materiais", turmaId],
    queryFn: async () => {
      if (!turmaId) return [];

      const { data, error } = await supabase
        .from("ebd_materiais")
        .select(`
          *,
          licao:ebd_licoes(titulo, numero_licao)
        `)
        .eq("turma_id", turmaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!turmaId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!materiais?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Nenhum material disponível</h3>
          <p className="text-muted-foreground text-sm">
            Os materiais compartilhados pelo professor aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Materiais Complementares
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {materiais.map((material) => {
              const Icon = TIPO_ICONS[material.tipo] || File;
              return (
                <Card key={material.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-muted rounded-lg">
                        <Icon className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{material.titulo}</h4>
                          <Badge variant="outline" className="text-xs capitalize">
                            {material.tipo}
                          </Badge>
                        </div>
                        {material.descricao && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {material.descricao}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {material.licao && (
                            <span>Lição {material.licao.numero_licao}</span>
                          )}
                          <span>
                            {format(new Date(material.created_at), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                      {material.arquivo_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={material.arquivo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Baixar
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
