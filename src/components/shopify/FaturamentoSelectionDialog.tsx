import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, CreditCard, Clock, Receipt, CheckCircle2, Truck, Percent, Package } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ShippingOption {
  type: 'pac' | 'sedex' | 'free';
  label: string;
  cost: number;
  days?: number;
}

interface FaturamentoSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteNome: string;
  clienteCep: string | null;
  totalProdutos: number;
  items: Array<{ quantity: number }>;
  onSelectFaturamento: (prazo: string, desconto: number, frete: ShippingOption) => void;
  onSelectPagamentoPadrao: () => void;
}

export function FaturamentoSelectionDialog({
  open,
  onOpenChange,
  clienteNome,
  clienteCep,
  totalProdutos,
  items,
  onSelectFaturamento,
  onSelectPagamentoPadrao,
}: FaturamentoSelectionDialogProps) {
  const [selectedPrazo, setSelectedPrazo] = useState<string | null>(null);
  const [step, setStep] = useState<'choice' | 'config'>('choice');
  const [desconto, setDesconto] = useState<string>('');
  const [selectedFrete, setSelectedFrete] = useState<string>('');
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);

  // Calculate total with discount
  const descontoPercent = parseFloat(desconto) || 0;
  const valorComDesconto = totalProdutos * (1 - descontoPercent / 100);
  const selectedShipping = shippingOptions.find(opt => opt.type === selectedFrete);
  const valorFrete = selectedShipping?.cost || 0;
  const valorTotal = valorComDesconto + valorFrete;

  // Fetch shipping options when dialog opens
  useEffect(() => {
    if (open && clienteCep) {
      fetchShippingOptions();
    }
  }, [open, clienteCep]);

  const fetchShippingOptions = async () => {
    if (!clienteCep) {
      // No CEP, show only free option if applicable
      const options: ShippingOption[] = [];
      if (totalProdutos >= 400) {
        options.push({ type: 'free', label: 'Frete Grátis', cost: 0 });
      }
      setShippingOptions(options);
      return;
    }

    setIsLoadingShipping(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-shipping', {
        body: {
          cep: clienteCep,
          items: items.map(item => ({ quantity: item.quantity })),
        }
      });

      if (error) throw error;

      const options: ShippingOption[] = [];
      
      // Add PAC option
      if (data?.pac) {
        options.push({
          type: 'pac',
          label: `PAC - ${data.pac.days} dias úteis`,
          cost: data.pac.cost,
          days: data.pac.days,
        });
      }

      // Add SEDEX option
      if (data?.sedex) {
        options.push({
          type: 'sedex',
          label: `SEDEX - ${data.sedex.days} dias úteis`,
          cost: data.sedex.cost,
          days: data.sedex.days,
        });
      }

      // Add free shipping if total >= R$400
      if (totalProdutos >= 400) {
        options.push({ type: 'free', label: 'Frete Grátis (compras acima de R$400)', cost: 0 });
      }

      setShippingOptions(options);
      
      // Auto-select free if available, otherwise PAC
      if (totalProdutos >= 400) {
        setSelectedFrete('free');
      } else if (options.length > 0) {
        setSelectedFrete(options[0].type);
      }
    } catch (error) {
      console.error('Error fetching shipping:', error);
      toast.error('Erro ao calcular frete');
      // Fallback options
      const fallbackOptions: ShippingOption[] = [
        { type: 'pac', label: 'PAC - 8 dias úteis', cost: 15, days: 8 },
        { type: 'sedex', label: 'SEDEX - 3 dias úteis', cost: 25, days: 3 },
      ];
      if (totalProdutos >= 400) {
        fallbackOptions.push({ type: 'free', label: 'Frete Grátis (compras acima de R$400)', cost: 0 });
      }
      setShippingOptions(fallbackOptions);
    } finally {
      setIsLoadingShipping(false);
    }
  };

  const handleSelectFaturamento = () => {
    setStep('config');
  };

  const handleConfirmFaturamento = () => {
    if (selectedPrazo && selectedFrete) {
      const shipping = shippingOptions.find(opt => opt.type === selectedFrete)!;
      onSelectFaturamento(selectedPrazo, descontoPercent, shipping);
      // Reset state for next time
      setTimeout(() => {
        setStep('choice');
        setSelectedPrazo(null);
        setDesconto('');
        setSelectedFrete('');
      }, 300);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep('choice');
      setSelectedPrazo(null);
      setDesconto('');
      setSelectedFrete('');
    }, 300);
  };

  const handlePagamentoPadrao = () => {
    onSelectPagamentoPadrao();
    setTimeout(() => {
      setStep('choice');
      setSelectedPrazo(null);
      setDesconto('');
      setSelectedFrete('');
    }, 300);
  };

  const prazos = [
    { value: '30', label: '30 dias', description: 'Vencimento em 1 mês' },
    { value: '60', label: '60 dias', description: 'Vencimento em 2 meses' },
    { value: '90', label: '90 dias', description: 'Vencimento em 3 meses' },
  ];

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-6 w-6 text-primary" />
            Forma de Pagamento
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            O cliente <strong className="text-foreground">{clienteNome}</strong> está habilitado para faturamento B2B.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {step === 'choice' && (
          <div className="space-y-3 mt-4">
            <Button
              variant="outline"
              className="w-full h-auto p-4 justify-start text-left border-2 hover:border-primary hover:bg-primary/5 transition-all"
              onClick={handleSelectFaturamento}
            >
              <div className="flex gap-4 items-start w-full">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-base">Faturar Pedido (B2B)</p>
                  <p className="text-sm text-muted-foreground font-normal mt-1">
                    Pagamento em 30, 60 ou 90 dias. Pedido criado diretamente no Bling.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Prazo estendido para clientes B2B</span>
                  </div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full h-auto p-4 justify-start text-left border-2 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all"
              onClick={handlePagamentoPadrao}
            >
              <div className="flex gap-4 items-start w-full">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CreditCard className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-base">Pagamento Padrão</p>
                  <p className="text-sm text-muted-foreground font-normal mt-1">
                    O cliente pagará via PIX, Cartão ou Boleto através do checkout padrão.
                  </p>
                </div>
              </div>
            </Button>
          </div>
        )}

        {step === 'config' && (
          <div className="space-y-5 mt-4">
            {/* Prazo Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Prazo de Pagamento
              </Label>
              <div className="grid grid-cols-3 gap-3">
                {prazos.map((prazo) => (
                  <button
                    key={prazo.value}
                    onClick={() => setSelectedPrazo(prazo.value)}
                    className={cn(
                      "relative p-3 rounded-lg border-2 transition-all text-center",
                      selectedPrazo === prazo.value
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-muted hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    {selectedPrazo === prazo.value && (
                      <CheckCircle2 className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary" />
                    )}
                    <div className="text-xl font-bold text-primary">{prazo.value}</div>
                    <div className="text-xs text-muted-foreground">dias</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Discount Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Desconto (%)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="Ex: 10"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
                {descontoPercent > 0 && (
                  <span className="text-sm text-green-600 font-medium">
                    -R$ {(totalProdutos * descontoPercent / 100).toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {/* Shipping Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Frete
              </Label>
              {isLoadingShipping ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
                  <Package className="h-4 w-4 animate-pulse" />
                  Calculando frete...
                </div>
              ) : (
                <RadioGroup value={selectedFrete} onValueChange={setSelectedFrete} className="space-y-2">
                  {shippingOptions.map((option) => (
                    <div
                      key={option.type}
                      className={cn(
                        "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-all",
                        selectedFrete === option.type 
                          ? "border-primary bg-primary/5" 
                          : "border-muted hover:border-primary/50"
                      )}
                      onClick={() => setSelectedFrete(option.type)}
                    >
                      <RadioGroupItem value={option.type} id={option.type} />
                      <Label htmlFor={option.type} className="flex-1 cursor-pointer flex justify-between items-center">
                        <span>{option.label}</span>
                        <span className={cn(
                          "font-semibold",
                          option.cost === 0 ? "text-green-600" : ""
                        )}>
                          {option.cost === 0 ? 'Grátis' : `R$ ${option.cost.toFixed(2)}`}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
              {!clienteCep && (
                <p className="text-xs text-amber-600">
                  CEP do cliente não cadastrado. Apenas frete grátis disponível.
                </p>
              )}
            </div>

            {/* Order Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>R$ {totalProdutos.toFixed(2)}</span>
              </div>
              {descontoPercent > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Desconto ({descontoPercent}%)</span>
                  <span>-R$ {(totalProdutos * descontoPercent / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Frete</span>
                <span className={valorFrete === 0 ? "text-green-600" : ""}>
                  {valorFrete === 0 ? 'Grátis' : `R$ ${valorFrete.toFixed(2)}`}
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-lg">R$ {valorTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep('choice')}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmFaturamento}
                disabled={!selectedPrazo || !selectedFrete}
              >
                <FileText className="w-4 h-4 mr-2" />
                Confirmar Faturamento
              </Button>
            </div>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
