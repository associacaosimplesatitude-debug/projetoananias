import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, Users, Wallet, Clock } from "lucide-react";

interface GerenteResumo {
  id: string;
  nome: string;
  foto: string | null;
  equipe: string[];
  aPagar: number;
  pendentes: number;
}

interface ComissaoResumoGerentesCardsProps {
  gerentes: GerenteResumo[];
  onVerGerente: (gerenteId: string, status: 'liberada' | 'pendente') => void;
}

export function ComissaoResumoGerentesCards({ 
  gerentes, 
  onVerGerente 
}: ComissaoResumoGerentesCardsProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  // Filter only gerentes with values
  const gerentesComValor = gerentes.filter(g => g.aPagar > 0 || g.pendentes > 0);

  if (gerentesComValor.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
          <Users className="h-5 w-5" />
          Comissões por Gerente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gerentesComValor.map((g) => (
            <Card key={g.id} className="border bg-white/80 hover:bg-white transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={g.foto || undefined} />
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                      {getInitials(g.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium text-sm block">{g.nome}</span>
                    {g.equipe.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Equipe: {g.equipe.slice(0, 2).join(', ')}{g.equipe.length > 2 ? ` +${g.equipe.length - 2}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mt-3">
                  {g.aPagar > 0 && (
                    <div 
                      className="flex items-center justify-between cursor-pointer group"
                      onClick={() => onVerGerente(g.id, 'liberada')}
                    >
                      <div className="flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-xs text-muted-foreground">A Pagar</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-green-600">
                          R$ {g.aPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  )}
                  
                  {g.pendentes > 0 && (
                    <div 
                      className="flex items-center justify-between cursor-pointer group"
                      onClick={() => onVerGerente(g.id, 'pendente')}
                    >
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-yellow-600" />
                        <span className="text-xs text-muted-foreground">Pendentes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-yellow-600">
                          R$ {g.pendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
