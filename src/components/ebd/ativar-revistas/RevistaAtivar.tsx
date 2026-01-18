import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, AlertCircle, ArrowRight, X } from "lucide-react";
import { RevistaConfig } from "@/pages/ebd/AtivarRevistas";
import { RevistaConfigurarModal } from "./RevistaConfigurarModal";

interface RevistaAtivarProps {
  revistas: RevistaConfig[];
  onConfigurar: (produtoId: string, config: Partial<RevistaConfig>) => void;
  onRemover: (produtoId: string) => void;
  onIrParaEscala: () => void;
  todasConfiguradas: boolean;
}

export function RevistaAtivar({
  revistas,
  onConfigurar,
  onRemover,
  onIrParaEscala,
  todasConfiguradas,
}: RevistaAtivarProps) {
  const [revistaEditando, setRevistaEditando] = useState<RevistaConfig | null>(null);

  if (revistas.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma revista selecionada. Volte para a Vitrine e selecione as revistas.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Configure cada revista</h3>
          <p className="text-sm text-muted-foreground">
            Clique em cada revista para definir turma e data de início
          </p>
        </div>
        <Button
          onClick={onIrParaEscala}
          disabled={!todasConfiguradas}
        >
          Ir para Montar Escala
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {revistas.map(revista => {
          const imagem = revista.produto.node.images.edges[0]?.node.url;
          
          return (
            <Card 
              key={revista.produto.node.id}
              className="cursor-pointer transition-all hover:shadow-lg"
              onClick={() => setRevistaEditando(revista)}
            >
              <CardContent className="p-3">
                <div className="relative aspect-[3/4] mb-2 bg-muted rounded overflow-hidden">
                  {imagem ? (
                    <img
                      src={imagem}
                      alt={revista.produto.node.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      Sem imagem
                    </div>
                  )}
                  
                  {/* Botão X para remover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemover(revista.produto.node.id);
                    }}
                    className="absolute top-2 left-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors"
                    title="Remover revista"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  
                  {/* Badge de status */}
                  <div className="absolute top-2 right-2">
                    {revista.configurada ? (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        <Check className="mr-1 h-3 w-3" />
                        Configurada
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Pendente
                      </Badge>
                    )}
                  </div>
                </div>
                
                <h4 className="text-sm font-medium line-clamp-2 mb-2">
                  {revista.produto.node.title}
                </h4>
                
                {revista.configurada && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Turma: {revista.turmaNome}</p>
                    <p>Dia: {revista.diaSemana}</p>
                    <p>Início: {revista.dataInicio?.toLocaleDateString('pt-BR')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal de configuração */}
      {revistaEditando && (
        <RevistaConfigurarModal
          revista={revistaEditando}
          open={!!revistaEditando}
          onOpenChange={(open) => !open && setRevistaEditando(null)}
          onConfirmar={(config) => {
            onConfigurar(revistaEditando.produto.node.id, config);
            setRevistaEditando(null);
          }}
        />
      )}
    </div>
  );
}
