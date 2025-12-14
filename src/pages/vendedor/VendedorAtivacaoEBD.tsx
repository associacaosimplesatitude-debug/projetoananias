import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  ArrowLeft, 
  CalendarIcon, 
  Play, 
  BookOpen, 
  User, 
  Mail,
  CheckCircle,
  Loader2
} from "lucide-react";
import { format, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Cliente {
  id: string;
  cnpj: string;
  nome_igreja: string;
  nome_superintendente: string | null;
  email_superintendente: string | null;
  telefone: string | null;
  status_ativacao_ebd: boolean;
  senha_temporaria: string | null;
}

interface Revista {
  id: string;
  titulo: string;
  faixa_etaria_alvo: string;
  imagem_url: string | null;
  num_licoes: number;
}

const DIAS_AULA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export default function VendedorAtivacaoEBD() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clienteId = searchParams.get("clienteId");
  const clienteNome = searchParams.get("clienteNome");

  const [loading, setLoading] = useState(false);
  const [emailSuperintendente, setEmailSuperintendente] = useState("");
  const [diaAula, setDiaAula] = useState("Domingo");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [revistasSelecionadas, setRevistasSelecionadas] = useState<string[]>([]);

  // Fetch client data
  const { data: cliente, isLoading: clienteLoading } = useQuery({
    queryKey: ["vendedor-cliente", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, cnpj, nome_igreja, nome_superintendente, email_superintendente, telefone, status_ativacao_ebd, senha_temporaria")
        .eq("id", clienteId)
        .single();
      
      if (error) throw error;
      return data as Cliente;
    },
    enabled: !!clienteId,
  });

  // Fetch all magazines for selection
  const { data: revistas = [], isLoading: revistasLoading } = useQuery({
    queryKey: ["ebd-revistas-ativacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_revistas")
        .select("id, titulo, faixa_etaria_alvo, imagem_url, num_licoes")
        .order("faixa_etaria_alvo")
        .order("titulo");

      if (error) throw error;
      return data as Revista[];
    },
  });

  // Set email when client data loads
  useEffect(() => {
    if (cliente?.email_superintendente) {
      setEmailSuperintendente(cliente.email_superintendente);
    }
  }, [cliente]);

  // Load cart from sessionStorage if coming from catalog
  useEffect(() => {
    const savedCart = sessionStorage.getItem('vendedor-cart');
    if (savedCart) {
      try {
        const cartItems = JSON.parse(savedCart);
        const revistaIds = cartItems.map((item: { revista: { id: string } }) => item.revista.id);
        setRevistasSelecionadas(revistaIds);
      } catch (e) {
        console.error('Error loading cart:', e);
      }
    }
  }, []);

  const toggleRevista = (revistaId: string) => {
    setRevistasSelecionadas(prev => 
      prev.includes(revistaId) 
        ? prev.filter(id => id !== revistaId)
        : [...prev, revistaId]
    );
  };

  const handleSubmit = async () => {
    if (!emailSuperintendente || !dataInicio) {
      toast.error("E-mail do Superintendente e Data de Início são obrigatórios");
      return;
    }

    if (!clienteId) {
      toast.error("Cliente não encontrado");
      return;
    }

    setLoading(true);
    try {
      // Calculate next purchase date (13 weeks from start date)
      const dataProximaCompra = addWeeks(dataInicio, 13);

      // 1. Create or update the superintendent user via edge function
      // Use existing password from ebd_clientes or generate a new one
      const tempPassword = cliente?.senha_temporaria || (Math.random().toString(36).slice(-8) + "A1!");
      const fullName = cliente?.nome_superintendente || "Superintendente";

      let userId: string | null = null;

      try {
        const { data: userData, error: userError } = await supabase.functions.invoke(
          "create-ebd-user",
          {
            body: {
              email: emailSuperintendente,
              password: tempPassword,
              fullName,
              clienteId,
            },
          }
        );

        if (userError) {
          console.error("Error creating/updating user:", userError, userData);
          throw userError;
        }

        userId = userData?.userId ?? null;
      } catch (e) {
        console.error("Error in user creation flow:", e);
        throw e;
      }

      // 2. Update the cliente record with the generated password and activation data
      const { error: updateError } = await supabase
        .from("ebd_clientes")
        .update({
          email_superintendente: emailSuperintendente,
          dia_aula: diaAula,
          data_inicio_ebd: format(dataInicio, "yyyy-MM-dd"),
          data_proxima_compra: format(dataProximaCompra, "yyyy-MM-dd"),
          status_ativacao_ebd: true,
          superintendente_user_id: userId,
          senha_temporaria: tempPassword, // Save the generated password
        })
        .eq("id", clienteId);

      if (updateError) throw updateError;

      // 3. Send welcome email
      try {
        await supabase.functions.invoke("send-welcome-email", {
          body: {
            email: emailSuperintendente,
            nome: fullName,
            igreja: cliente?.nome_igreja || clienteNome,
            senha: tempPassword,
          },
        });
      } catch (emailError) {
        console.error("Error sending welcome email:", emailError);
        // Continue anyway
      }

      // Clear cart from sessionStorage
      sessionStorage.removeItem('vendedor-cart');

      toast.success("Painel EBD ativado com sucesso! E-mail de boas-vindas enviado.");
      navigate("/vendedor");
    } catch (error) {
      console.error("Error activating client:", error);
      toast.error("Erro ao ativar cliente");
    } finally {
      setLoading(false);
    }
  };

  const handleVoltar = () => {
    navigate("/vendedor");
  };

  if (!clienteId || !clienteNome) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nenhum cliente selecionado. Volte e selecione um cliente primeiro.
            </p>
            <Button 
              className="mt-4"
              onClick={() => navigate('/vendedor')}
            >
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (clienteLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Group magazines by age range
  const revistasPorFaixa = revistas.reduce((acc, revista) => {
    const faixa = revista.faixa_etaria_alvo;
    if (!acc[faixa]) acc[faixa] = [];
    acc[faixa].push(revista);
    return acc;
  }, {} as Record<string, Revista[]>);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={handleVoltar}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Play className="h-6 w-6 text-primary" />
            Ativar Painel EBD
          </h1>
          <p className="text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{clienteNome}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Dados de Ativação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Dados de Ativação
            </CardTitle>
            <CardDescription>
              Configure os dados para ativação do Painel EBD
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  E-mail do Superintendente *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={emailSuperintendente}
                  onChange={(e) => setEmailSuperintendente(e.target.value)}
                  placeholder="email@igreja.com"
                />
                <p className="text-xs text-muted-foreground">
                  Um usuário será criado e as credenciais enviadas para este e-mail
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4" />
                  Dia da Aula *
                </Label>
                <Select value={diaAula} onValueChange={setDiaAula}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS_AULA.map((dia) => (
                      <SelectItem key={dia} value={dia}>{dia}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                Data de Início da EBD *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full md:w-[280px] justify-start text-left font-normal",
                      !dataInicio && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? (
                      format(dataInicio, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={setDataInicio}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              {dataInicio && (
                <p className="text-sm text-muted-foreground">
                  Próxima compra prevista: <strong>{format(addWeeks(dataInicio, 13), "dd/MM/yyyy", { locale: ptBR })}</strong>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Seleção de Revistas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Revistas em Uso
            </CardTitle>
            <CardDescription>
              Selecione as revistas que o cliente já comprou ou que estão em uso
              {revistasSelecionadas.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {revistasSelecionadas.length} selecionada(s)
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {revistasLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-6">
                  {Object.entries(revistasPorFaixa).map(([faixa, revistasDoGrupo]) => (
                    <div key={faixa}>
                      <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                        {faixa}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {revistasDoGrupo.map((revista) => {
                          const isSelected = revistasSelecionadas.includes(revista.id);
                          return (
                            <div
                              key={revista.id}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                                isSelected 
                                  ? "bg-primary/10 border-primary" 
                                  : "hover:bg-muted/50"
                              )}
                              onClick={() => toggleRevista(revista.id)}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleRevista(revista.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm line-clamp-1">
                                  {revista.titulo}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {revista.num_licoes} lições
                                </p>
                              </div>
                              {isSelected && (
                                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleVoltar}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !emailSuperintendente || !dataInicio}
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ativando...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Ativar Painel EBD
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
