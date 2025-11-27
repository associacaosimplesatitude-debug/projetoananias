import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon } from "lucide-react";
import { format, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface RevistaDetailDialogProps {
  revista: {
    id: string;
    titulo: string;
    faixa_etaria_alvo: string;
    sinopse: string | null;
    autor: string | null;
    imagem_url: string | null;
    num_licoes: number;
    preco_cheio: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId?: string;
}

const diasSemana = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function RevistaDetailDialog({ revista, open, onOpenChange, churchId }: RevistaDetailDialogProps) {
  const [diaSemana, setDiaSemana] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const queryClient = useQueryClient();

  // Calcular preços
  const precoDesconto = revista.preco_cheio * 0.65; // 35% de desconto
  const descontoValor = revista.preco_cheio - precoDesconto;

  // Verificar se a igreja já comprou esta revista
  const { data: revistaComprada } = useQuery({
    queryKey: ['revista-comprada', churchId, revista.id],
    queryFn: async () => {
      if (!churchId) return null;
      
      const { data, error } = await supabase
        .from('ebd_revistas_compradas')
        .select('*')
        .eq('church_id', churchId)
        .eq('revista_id', revista.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open && !!churchId,
  });

  const { data: licoes, isLoading: loadingLicoes } = useQuery({
    queryKey: ['ebd-licoes-revista', revista.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_licoes')
        .select('*')
        .eq('revista_id', revista.id)
        .order('numero_licao');

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const salvarPlanejamentoMutation = useMutation({
    mutationFn: async () => {
      if (!churchId || !diaSemana || !dataInicio) {
        throw new Error("Dados incompletos");
      }

      const dataTermino = addWeeks(dataInicio, revista.num_licoes - 1);

      const { error } = await supabase
        .from('ebd_planejamento')
        .insert({
          church_id: churchId,
          revista_id: revista.id,
          data_inicio: format(dataInicio, 'yyyy-MM-dd'),
          dia_semana: diaSemana,
          data_termino: format(dataTermino, 'yyyy-MM-dd'),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebd-planejamentos'] });
      toast.success('Revista adicionada ao planejamento!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro ao salvar planejamento');
      console.error(error);
    },
  });

  const handleUsarRevista = () => {
    if (!revistaComprada && revista.preco_cheio > 0) {
      toast.error('Você precisa comprar esta revista primeiro');
      return;
    }
    if (!diaSemana || !dataInicio) {
      toast.error('Selecione o dia da semana e a data de início');
      return;
    }
    salvarPlanejamentoMutation.mutate();
  };

  const handleComprar = () => {
    // TODO: Implementar fluxo de pagamento
    toast.info('Fluxo de pagamento será implementado em breve');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{revista.titulo}</DialogTitle>
          <DialogDescription className="flex items-center gap-2 mt-2">
            <span>Faixa etária:</span>
            <Badge variant="secondary">{revista.faixa_etaria_alvo}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Imagem e Dados */}
          <div className="space-y-4">
            {revista.imagem_url && (
              <div className="aspect-[3/4] bg-muted rounded-lg overflow-hidden">
                <img
                  src={revista.imagem_url}
                  alt={revista.titulo}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {revista.autor && (
              <div>
                <h3 className="font-semibold mb-1">Autor</h3>
                <p className="text-sm text-muted-foreground">{revista.autor}</p>
              </div>
            )}

            {revista.sinopse && (
              <div>
                <h3 className="font-semibold mb-1">Sinopse</h3>
                <p className="text-sm text-muted-foreground">{revista.sinopse}</p>
              </div>
            )}

            {/* Seção de Preço */}
            {revista.preco_cheio > 0 && (
              <div className="pt-4 border-t space-y-3">
                <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Preço Original:</span>
                    <span className="text-sm line-through text-muted-foreground">
                      R$ {revista.preco_cheio.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Desconto (35%):</span>
                    <span className="text-sm text-green-600 font-semibold">
                      -R$ {descontoValor.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="font-bold">Seu Preço:</span>
                    <span className="text-2xl font-bold text-primary">
                      R$ {precoDesconto.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-center mt-2">
                    <Badge className="bg-green-600 text-white">
                      ✓ Você tem 35% de desconto!
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-4 border-t">
              <div className="space-y-2">
                <Label>Dia da Aula</Label>
                <Select value={diaSemana} onValueChange={setDiaSemana}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o dia" />
                  </SelectTrigger>
                  <SelectContent>
                    {diasSemana.map((dia) => (
                      <SelectItem key={dia} value={dia}>
                        {dia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dataInicio && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataInicio ? format(dataInicio, "PPP", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dataInicio}
                      onSelect={setDataInicio}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {dataInicio && (
                <p className="text-sm text-muted-foreground">
                  Término previsto: {format(addWeeks(dataInicio, revista.num_licoes - 1), "PPP", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>

          {/* Coluna Direita - Lições */}
          <div>
            <h3 className="font-semibold mb-3">Lições ({revista.num_licoes})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {loadingLicoes ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !licoes || licoes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma lição cadastrada ainda
                </div>
              ) : (
                licoes.map((licao) => (
                  <div key={licao.id} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex gap-2">
                      <span className="font-medium text-sm text-primary">
                        {licao.numero_licao}.
                      </span>
                      <span className="text-sm">{licao.titulo}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          
          {revistaComprada || revista.preco_cheio === 0 ? (
            <Button 
              onClick={handleUsarRevista} 
              disabled={salvarPlanejamentoMutation.isPending}
              className="bg-primary"
            >
              {salvarPlanejamentoMutation.isPending ? 'Salvando...' : 'USAR ESSA REVISTA'}
            </Button>
          ) : (
            <Button 
              onClick={handleComprar}
              className="bg-green-600 hover:bg-green-700"
            >
              COMPRAR AGORA - R$ {precoDesconto.toFixed(2)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
