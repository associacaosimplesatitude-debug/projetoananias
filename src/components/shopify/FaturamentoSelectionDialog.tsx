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
import { FileText, CreditCard, Clock, Receipt, CheckCircle2, Truck, Percent, Package, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ShippingOption {
  type: 'pac' | 'sedex' | 'free' | 'retirada' | 'manual';
  label: string;
  cost: number;
  days?: number;
  endereco?: string;
  horario?: string;
  estimatedDate?: string;
}

// Função para adicionar dias úteis a uma data
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    // 0 = Domingo, 6 = Sábado
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      addedDays++;
    }
  }
  return result;
}

// Função para formatar data em português
function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export interface FreteManualData {
  transportadora: string;
  valor: number;
  observacao?: string;
  prazoEstimado?: string;
}

interface FaturamentoSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteNome: string;
  clienteCep: string | null;
  totalProdutos: number;
  items: Array<{ quantity: number }>;
  descontoB2B: number | null;
  onSelectFaturamento: (prazos: string[], desconto: number, frete: ShippingOption, freteManual?: FreteManualData) => void;
  onSelectPagamentoPadrao: (frete?: ShippingOption | null, freteManual?: FreteManualData) => void;
  canUseFreteManual?: boolean; // Apenas vendedor e gerente podem usar
}

export function FaturamentoSelectionDialog({
  open,
  onOpenChange,
  clienteNome,
  clienteCep,
  totalProdutos,
  items,
  descontoB2B,
  onSelectFaturamento,
  onSelectPagamentoPadrao,
  canUseFreteManual = false,
}: FaturamentoSelectionDialogProps) {
  const [selectedPrazo, setSelectedPrazo] = useState<string>('');
  const [step, setStep] = useState<'choice' | 'config' | 'config_padrao' | 'config_padrao_manual'>('choice');
  const [desconto, setDesconto] = useState<string>('');
  const [selectedFrete, setSelectedFrete] = useState<string>('');
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);
  
  // Estados para frete manual
  const [tipoFrete, setTipoFrete] = useState<'automatico' | 'manual'>('automatico');
  const [freteManualTransportadora, setFreteManualTransportadora] = useState('');
  const [freteManualValor, setFreteManualValor] = useState('');
  const [freteManualObservacao, setFreteManualObservacao] = useState('');
  const [freteManualPrazo, setFreteManualPrazo] = useState('');

  // Auto-fill discount when dialog opens
  useEffect(() => {
    if (open && descontoB2B && descontoB2B > 0) {
      setDesconto(descontoB2B.toString());
    }
  }, [open, descontoB2B]);

  // Calculate total with discount - considera frete manual se selecionado
  const descontoPercent = parseFloat(desconto) || 0;
  const valorComDesconto = totalProdutos * (1 - descontoPercent / 100);
  const selectedShipping = shippingOptions.find(opt => opt.type === selectedFrete);
  const freteManualValorNum = parseFloat(freteManualValor) || 0;
  const valorFrete = tipoFrete === 'manual' ? freteManualValorNum : (selectedShipping?.cost || 0);
  const valorTotal = valorComDesconto + valorFrete;

  // Fetch shipping options when dialog opens
  useEffect(() => {
    if (open && clienteCep) {
      fetchShippingOptions();
    }
  }, [open, clienteCep]);

  const fetchShippingOptions = async () => {
    if (!clienteCep) {
      // No CEP, show only free option if applicable + retirada
      const options: ShippingOption[] = [];
      if (totalProdutos >= 199.90) {
        options.push({ type: 'free', label: 'Frete Grátis', cost: 0 });
      }
      // Sempre adicionar opção de retirada
      options.push({
        type: 'retirada',
        label: 'Retirada na Matriz',
        cost: 0,
        endereco: 'Estrada do Guerenguê, 1851 - Taquara, Rio de Janeiro - RJ',
        horario: 'Segunda a Sexta: 9h às 18h'
      });
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
      
      const today = new Date();
      
      // Add PAC option - 5 dias úteis
      if (data?.pac) {
        const pacDays = 5;
        const pacDate = addBusinessDays(today, pacDays);
        options.push({
          type: 'pac',
          label: `PAC - ${pacDays} dias úteis`,
          cost: data.pac.cost,
          days: pacDays,
          estimatedDate: formatDateBR(pacDate),
        });
      }

      // Add SEDEX option - 2 dias úteis
      if (data?.sedex) {
        const sedexDays = 2;
        const sedexDate = addBusinessDays(today, sedexDays);
        options.push({
          type: 'sedex',
          label: `SEDEX - ${sedexDays} dias úteis`,
          cost: data.sedex.cost,
          days: sedexDays,
          estimatedDate: formatDateBR(sedexDate),
        });
      }

      // Add free shipping if total >= R$199,90 - 10 dias úteis
      if (totalProdutos >= 199.90) {
        const freeDays = 10;
        const freeDate = addBusinessDays(today, freeDays);
        options.push({ 
          type: 'free', 
          label: `Frete Grátis (compras acima de R$199,90) - ${freeDays} dias úteis`, 
          cost: 0,
          days: freeDays,
          estimatedDate: formatDateBR(freeDate),
        });
      }

      // Sempre adicionar opção de retirada na matriz
      options.push({
        type: 'retirada',
        label: 'Retirada na Matriz',
        cost: 0,
        endereco: 'Estrada do Guerenguê, 1851 - Taquara, Rio de Janeiro - RJ',
        horario: 'Segunda a Sexta: 9h às 18h'
      });

      setShippingOptions(options);
      
      // Auto-select free if available, otherwise PAC
      if (totalProdutos >= 199.90) {
        setSelectedFrete('free');
      } else if (options.length > 0) {
        setSelectedFrete(options[0].type);
      }
    } catch (error) {
      console.error('Error fetching shipping:', error);
      toast.error('Erro ao calcular frete');
      // Fallback options
      const fallbackToday = new Date();
      const fallbackPacDate = addBusinessDays(fallbackToday, 5);
      const fallbackSedexDate = addBusinessDays(fallbackToday, 2);
      const fallbackFreeDate = addBusinessDays(fallbackToday, 10);
      const fallbackOptions: ShippingOption[] = [
        { type: 'pac', label: 'PAC - 5 dias úteis', cost: 15, days: 5, estimatedDate: formatDateBR(fallbackPacDate) },
        { type: 'sedex', label: 'SEDEX - 2 dias úteis', cost: 25, days: 2, estimatedDate: formatDateBR(fallbackSedexDate) },
      ];
      if (totalProdutos >= 199.90) {
        fallbackOptions.push({ 
          type: 'free', 
          label: 'Frete Grátis (compras acima de R$199,90) - 10 dias úteis', 
          cost: 0,
          days: 10,
          estimatedDate: formatDateBR(fallbackFreeDate),
        });
      }
      // Sempre adicionar retirada
      fallbackOptions.push({
        type: 'retirada',
        label: 'Retirada na Matriz',
        cost: 0,
        endereco: 'Estrada do Guerenguê, 1851 - Taquara, Rio de Janeiro - RJ',
        horario: 'Segunda a Sexta: 9h às 18h'
      });
      setShippingOptions(fallbackOptions);
    } finally {
      setIsLoadingShipping(false);
    }
  };

  // Função auxiliar para resetar estado
  const resetState = () => {
    setSelectedPrazo('');
    setDesconto('');
    setSelectedFrete('');
    setTipoFrete('automatico');
    setFreteManualTransportadora('');
    setFreteManualValor('');
    setFreteManualObservacao('');
    setFreteManualPrazo('');
  };

  const handleSelectFaturamento = () => {
    setStep('config');
  };

  const handleConfirmFaturamento = () => {
    if (!selectedPrazo) return;
    
    // Se for frete manual, validar campos obrigatórios
    if (tipoFrete === 'manual') {
      if (!freteManualTransportadora.trim()) {
        toast.error('Informe a transportadora');
        return;
      }
      if (!freteManualValor || parseFloat(freteManualValor) < 0) {
        toast.error('Informe o valor do frete');
        return;
      }
      
      const shipping: ShippingOption = {
        type: 'manual',
        label: `Manual - ${freteManualTransportadora}`,
        cost: parseFloat(freteManualValor),
      };
      
      const freteManualData: FreteManualData = {
        transportadora: freteManualTransportadora.trim(),
        valor: parseFloat(freteManualValor),
        observacao: freteManualObservacao.trim() || undefined,
        prazoEstimado: freteManualPrazo.trim() || undefined,
      };
      
      onSelectFaturamento([selectedPrazo], descontoPercent, shipping, freteManualData);
    } else {
      // Frete automático - cliente escolherá na proposta
      // Passa null como frete, indicando que cliente escolherá
      const nullShipping: ShippingOption = {
        type: 'free', // placeholder, será ignorado
        label: 'Cliente escolherá',
        cost: 0,
      };
      onSelectFaturamento([selectedPrazo], descontoPercent, nullShipping);
    }
    
    // Reset state for next time
    setTimeout(() => {
      setStep('choice');
      resetState();
    }, 300);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep('choice');
      resetState();
    }, 300);
  };

  const handlePagamentoPadrao = () => {
    // Se vendedor/gerente pode usar frete manual, mostrar tela de config de frete
    if (canUseFreteManual) {
      setStep('config_padrao');
    } else {
      // Fluxo normal - cliente escolhe frete na proposta
      onSelectPagamentoPadrao();
      setTimeout(() => {
        setStep('choice');
        resetState();
      }, 300);
    }
  };

  const selectPrazo = (value: string) => {
    setSelectedPrazo(value);
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
              <p className="text-xs text-muted-foreground mb-2">
                Selecione o prazo de pagamento:
              </p>
              <div className="grid grid-cols-3 gap-3">
                {prazos.map((prazo) => (
                  <button
                    key={prazo.value}
                    onClick={() => selectPrazo(prazo.value)}
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

            {/* Shipping Selection - Cliente escolhe na proposta OU Frete Manual */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Frete
              </Label>
              
              {tipoFrete === 'automatico' ? (
                /* Info: Cliente escolherá na proposta */
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Package className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        O cliente escolherá a forma de entrega na proposta
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Opções disponíveis: PAC, SEDEX, Retirada na Matriz ou Frete Grátis (acima de R$199,90)
                      </p>
                    </div>
                  </div>
                  
                  {/* Toggle para Frete Manual */}
                  {canUseFreteManual && (
                    <button
                      type="button"
                      onClick={() => setTipoFrete('manual')}
                      className="mt-3 w-full text-left text-xs text-blue-700 dark:text-blue-300 hover:underline flex items-center gap-1"
                    >
                      <Truck className="h-3 w-3" />
                      Usar frete manual (cotação externa)
                    </button>
                  )}
                </div>
              ) : (
                /* Campos de Frete Manual */
                <div className="space-y-3 p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Frete Manual</span>
                    <button
                      type="button"
                      onClick={() => setTipoFrete('automatico')}
                      className="text-xs text-amber-700 hover:underline"
                    >
                      ← Voltar para automático
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="transportadora" className="text-sm font-medium">
                      Transportadora <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="transportadora"
                      placeholder="Ex: Transportadora ABC, JadLog, etc."
                      value={freteManualTransportadora}
                      onChange={(e) => setFreteManualTransportadora(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="valorFrete" className="text-sm font-medium">
                      Valor do Frete (R$) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="valorFrete"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={freteManualValor}
                      onChange={(e) => setFreteManualValor(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="prazoEstimado" className="text-sm font-medium">
                      Prazo Estimado <span className="text-muted-foreground text-xs">(opcional)</span>
                    </Label>
                    <Input
                      id="prazoEstimado"
                      placeholder="Ex: 5 a 7 dias úteis"
                      value={freteManualPrazo}
                      onChange={(e) => setFreteManualPrazo(e.target.value)}
                    />
                  </div>
                  
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    O frete manual será somado ao total. O cliente não verá opções de frete.
                  </p>
                </div>
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
              {tipoFrete === 'manual' && freteManualValorNum > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Frete ({freteManualTransportadora || 'Manual'})</span>
                  <span>R$ {freteManualValorNum.toFixed(2)}</span>
                </div>
              )}
              {tipoFrete === 'automatico' && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Frete</span>
                  <span className="italic">Cliente escolherá</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total (sem frete)</span>
                <span className="text-lg">R$ {valorComDesconto.toFixed(2)}</span>
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
                disabled={
                  !selectedPrazo || 
                  (tipoFrete === 'manual' && (!freteManualTransportadora.trim() || !freteManualValor))
                }
              >
                <FileText className="w-4 h-4 mr-2" />
                Confirmar Faturamento
              </Button>
            </div>
          </div>
        )}

        {/* Step de escolha de tipo de frete para Pagamento Padrão (vendedor/gerente) */}
        {step === 'config_padrao' && (
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>Pagamento Padrão</strong> - Como deseja definir o frete?
              </p>
            </div>

            <div className="space-y-3">
              {/* Opção Frete Automático - cliente escolhe */}
              <Button
                variant="outline"
                className="w-full h-auto p-4 justify-start text-left border-2 hover:border-primary hover:bg-primary/5 transition-all"
                onClick={() => {
                  // Gera link direto, cliente escolhe frete na proposta
                  onSelectPagamentoPadrao(null);
                  setTimeout(() => {
                    setStep('choice');
                    resetState();
                  }, 300);
                }}
              >
                <div className="flex gap-4 items-start w-full">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Truck className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-base">Frete Automático</p>
                    <p className="text-sm text-muted-foreground font-normal mt-1">
                      O cliente escolherá a forma de entrega na proposta (PAC, SEDEX, Retirada, etc.)
                    </p>
                  </div>
                </div>
              </Button>

              {/* Opção Frete Manual */}
              <Button
                variant="outline"
                className="w-full h-auto p-4 justify-start text-left border-2 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all"
                onClick={() => setStep('config_padrao_manual')}
              >
                <div className="flex gap-4 items-start w-full">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Package className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-base">Frete Manual (Cotação Externa)</p>
                    <p className="text-sm text-muted-foreground font-normal mt-1">
                      Você define a transportadora e o valor do frete. Cliente não verá outras opções.
                    </p>
                  </div>
                </div>
              </Button>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStep('choice')}
              >
                Voltar
              </Button>
            </div>
          </div>
        )}

        {/* Step de preenchimento do frete manual para Pagamento Padrão */}
        {step === 'config_padrao_manual' && (
          <div className="space-y-5 mt-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Frete Manual</strong> - Informe os dados da cotação externa.
              </p>
            </div>

            {/* Campos de Frete Manual */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="transportadora-padrao" className="text-sm font-medium">
                  Transportadora <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="transportadora-padrao"
                  placeholder="Ex: Transportadora ABC, JadLog, etc."
                  value={freteManualTransportadora}
                  onChange={(e) => setFreteManualTransportadora(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="valorFrete-padrao" className="text-sm font-medium">
                  Valor do Frete (R$) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="valorFrete-padrao"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={freteManualValor}
                  onChange={(e) => setFreteManualValor(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="prazoEstimado-padrao" className="text-sm font-medium">
                  Prazo Estimado <span className="text-muted-foreground text-xs">(opcional)</span>
                </Label>
                <Input
                  id="prazoEstimado-padrao"
                  placeholder="Ex: 5 a 7 dias úteis"
                  value={freteManualPrazo}
                  onChange={(e) => setFreteManualPrazo(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="observacaoFrete-padrao" className="text-sm font-medium">
                  Observação Interna <span className="text-muted-foreground text-xs">(opcional)</span>
                </Label>
                <Input
                  id="observacaoFrete-padrao"
                  placeholder="Observação sobre a cotação (não visível ao cliente)"
                  value={freteManualObservacao}
                  onChange={(e) => setFreteManualObservacao(e.target.value)}
                />
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>R$ {totalProdutos.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Frete {freteManualTransportadora && `(${freteManualTransportadora})`}</span>
                <span>{freteManualValorNum === 0 ? 'Grátis' : `R$ ${freteManualValorNum.toFixed(2)}`}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-lg">R$ {(totalProdutos + freteManualValorNum).toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep('config_padrao')}
              >
                Voltar
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (!freteManualTransportadora.trim()) {
                    toast.error('Informe a transportadora');
                    return;
                  }
                  if (!freteManualValor || parseFloat(freteManualValor) < 0) {
                    toast.error('Informe o valor do frete');
                    return;
                  }
                  
                  const shipping: ShippingOption = {
                    type: 'manual',
                    label: `Manual - ${freteManualTransportadora}`,
                    cost: parseFloat(freteManualValor),
                  };
                  
                  const freteManualData: FreteManualData = {
                    transportadora: freteManualTransportadora.trim(),
                    valor: parseFloat(freteManualValor),
                    observacao: freteManualObservacao.trim() || undefined,
                    prazoEstimado: freteManualPrazo.trim() || undefined,
                  };
                  
                  onSelectPagamentoPadrao(shipping, freteManualData);
                  setTimeout(() => {
                    setStep('choice');
                    resetState();
                  }, 300);
                }}
                disabled={!freteManualTransportadora.trim() || !freteManualValor}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Gerar Proposta
              </Button>
            </div>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
