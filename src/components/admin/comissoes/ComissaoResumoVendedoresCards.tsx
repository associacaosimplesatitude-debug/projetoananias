import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowRight, User, Wallet, Clock } from "lucide-react";

interface VendedorResumo {
  id: string;
  nome: string;
  foto: string | null;
  aPagar: number;
  pendentes: number;
}

interface ComissaoResumoVendedoresCardsProps {
  vendedores: VendedorResumo[];
  onVerVendedor: (vendedorId: string, tab: 'a_pagar' | 'pendentes') => void;
}

export function ComissaoResumoVendedoresCards({ 
  vendedores, 
  onVerVendedor 
}: ComissaoResumoVendedoresCardsProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  // Filter only vendedores with values
  const vendedoresComValor = vendedores.filter(v => v.aPagar > 0 || v.pendentes > 0);

  if (vendedoresComValor.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5" />
          Comissões por Vendedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {vendedoresComValor.map((v) => (
            <Card key={v.id} className="border bg-muted/30 hover:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={v.foto || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(v.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm truncate">{v.nome}</span>
                </div>

                <div className="space-y-2">
                  {v.aPagar > 0 && (
                    <div 
                      className="flex items-center justify-between cursor-pointer group"
                      onClick={() => onVerVendedor(v.id, 'a_pagar')}
                    >
                      <div className="flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-xs text-muted-foreground">A Pagar</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-green-600">
                          R$ {v.aPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  )}
                  
                  {v.pendentes > 0 && (
                    <div 
                      className="flex items-center justify-between cursor-pointer group"
                      onClick={() => onVerVendedor(v.id, 'pendentes')}
                    >
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-yellow-600" />
                        <span className="text-xs text-muted-foreground">Pendentes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-yellow-600">
                          R$ {v.pendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
