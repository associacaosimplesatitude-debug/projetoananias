import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CheckCircle, Loader2, MapPin, Building2, Package, ShoppingCart } from "lucide-react";

interface PropostaItem {
  variantId: string;
  quantity: number;
  title: string;
  price: string;
  imageUrl?: string;
}

interface Proposta {
  id: string;
  token: string;
  cliente_nome: string;
  cliente_cnpj: string | null;
  cliente_endereco: {
    rua?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  } | null;
  itens: PropostaItem[];
  valor_produtos: number;
  valor_frete: number;
  valor_total: number;
  desconto_percentual: number;
  status: string;
  created_at: string;
  confirmado_em: string | null;
}

export default function PropostaDigital() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);

  const { data: proposta, isLoading, error } = useQuery({
    queryKey: ["proposta", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_propostas")
        .select("*")
        .eq("token", token!)
        .single();

      if (error) throw error;
      
      // Parse itens from JSON if necessary
      const parsedData = {
        ...data,
        itens: typeof data.itens === 'string' ? JSON.parse(data.itens) : data.itens,
        cliente_endereco: typeof data.cliente_endereco === 'string' 
          ? JSON.parse(data.cliente_endereco) 
          : data.cliente_endereco,
      };
      
      return parsedData as Proposta;
    },
    enabled: !!token,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_propostas")
        .update({ 
          status: "PROPOSTA_ACEITA",
          confirmado_em: new Date().toISOString()
        })
        .eq("token", token!)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposta", token] });
      toast.success("Proposta confirmada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao confirmar proposta: " + error.message);
    },
  });

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await confirmMutation.mutateAsync();
    } finally {
      setIsConfirming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  if (error || !proposta) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-bold mb-2">Proposta não encontrada</h2>
            <p className="text-muted-foreground">
              Este link pode ter expirado ou a proposta já foi removida.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPending = proposta.status === "PROPOSTA_PENDENTE";
  const isAccepted = proposta.status === "PROPOSTA_ACEITA";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Logo */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <img 
            src="/logos/logo-central-gospel.png" 
            alt="Central Gospel Editora" 
            className="h-16 object-contain"
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Status Banner */}
        {isAccepted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">Proposta Confirmada!</p>
              <p className="text-sm text-green-600">
                Confirmada em {new Date(proposta.confirmado_em!).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        )}

        {/* Client Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Dados do Cliente
              </CardTitle>
              <Badge variant={isPending ? "secondary" : "default"}>
                {isPending ? "Pendente" : "Confirmada"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold text-lg">{proposta.cliente_nome}</p>
              {proposta.cliente_cnpj && (
                <p className="text-muted-foreground">CNPJ: {proposta.cliente_cnpj}</p>
              )}
            </div>
            
            {proposta.cliente_endereco && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  {proposta.cliente_endereco.rua && `${proposta.cliente_endereco.rua}, `}
                  {proposta.cliente_endereco.numero && `${proposta.cliente_endereco.numero} - `}
                  {proposta.cliente_endereco.bairro && `${proposta.cliente_endereco.bairro}, `}
                  {proposta.cliente_endereco.cidade && `${proposta.cliente_endereco.cidade}`}
                  {proposta.cliente_endereco.estado && `/${proposta.cliente_endereco.estado}`}
                  {proposta.cliente_endereco.cep && ` - CEP: ${proposta.cliente_endereco.cep}`}
                </p>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Proposta criada em {new Date(proposta.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </CardContent>
        </Card>

        {/* Items List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Itens da Proposta ({proposta.itens.length} {proposta.itens.length === 1 ? 'item' : 'itens'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proposta.itens.map((item, index) => (
                <div 
                  key={`${item.variantId}-${index}`}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                >
                  {item.imageUrl ? (
                    <img 
                      src={item.imageUrl} 
                      alt={item.title}
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Quantidade: {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      R$ {(parseFloat(item.price) * item.quantity).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      R$ {parseFloat(item.price).toFixed(2)} cada
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-6 pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal dos produtos:</span>
                <span>R$ {proposta.valor_produtos.toFixed(2)}</span>
              </div>
              
              {proposta.desconto_percentual > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Desconto ({proposta.desconto_percentual}%):</span>
                  <span>- R$ {(proposta.valor_produtos * proposta.desconto_percentual / 100).toFixed(2)}</span>
                </div>
              )}
              
              {proposta.valor_frete > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Frete:</span>
                  <span>R$ {proposta.valor_frete.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span>R$ {proposta.valor_total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confirm Button */}
        {isPending && (
          <Card className="border-2 border-primary/20">
            <CardContent className="pt-6">
              <Button
                onClick={handleConfirm}
                disabled={isConfirming}
                className="w-full h-14 text-lg bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                size="lg"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Confirmar Compra
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-3">
                Ao confirmar, você aceita os termos desta proposta comercial.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground pt-8 pb-4">
          <p>Central Gospel Editora © {new Date().getFullYear()}</p>
          <p>Em caso de dúvidas, entre em contato com seu vendedor.</p>
        </footer>
      </main>
    </div>
  );
}
