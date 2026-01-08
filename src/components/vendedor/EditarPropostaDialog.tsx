import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Plus, Minus, Trash2, Search, Loader2, Package, Truck, CheckCircle, Copy, MapPin, Store } from "lucide-react";
import { fetchShopifyProducts, ShopifyProduct } from "@/lib/shopify";
import { useVendedor } from "@/hooks/useVendedor";
import { ENDERECO_MATRIZ } from "@/constants/enderecoMatriz";

interface PropostaItem {
  variantId: string;
  quantity: number;
  title: string;
  price: string;
  sku?: string | null;
  imageUrl?: string | null;
  peso_kg?: number;
}

interface Proposta {
  id: string;
  token: string;
  cliente_id: string | null;
  cliente_nome: string;
  cliente_cnpj: string | null;
  cliente_endereco: Record<string, string> | null;
  itens: PropostaItem[];
  valor_total: number;
  valor_produtos: number;
  valor_frete: number | null;
  desconto_percentual: number | null;
  vendedor_nome: string | null;
  status: string;
  frete_tipo?: string | null;
  frete_transportadora?: string | null;
  frete_observacao?: string | null;
  frete_prazo_estimado?: string | null;
}

interface ShippingOption {
  type: string;
  label: string;
  cost: number;
  days?: number;
  estimatedDate?: string;
}

interface EditarPropostaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposta: Proposta | null;
  onSuccess: () => void;
}

// Função para adicionar dias úteis
const addBusinessDays = (date: Date, days: number): string => {
  let result = new Date(date);
  let addedDays = 0;
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      addedDays++;
    }
  }
  return result.toLocaleDateString('pt-BR');
};

export function EditarPropostaDialog({ 
  open, 
  onOpenChange, 
  proposta, 
  onSuccess 
}: EditarPropostaDialogProps) {
  const { vendedor } = useVendedor();
  const [itens, setItens] = useState<PropostaItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [newPropostaLink, setNewPropostaLink] = useState("");
  const [messageCopied, setMessageCopied] = useState(false);
  
  // Dados de frete - modo automático ou manual
  const [usarFreteManual, setUsarFreteManual] = useState(false);
  const [transportadora, setTransportadora] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [prazoEntrega, setPrazoEntrega] = useState("");
  
  // Opções de frete calculadas
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedFreteType, setSelectedFreteType] = useState<string>("");
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);

  // Buscar produtos Shopify
  const { data: produtos } = useQuery({
    queryKey: ["produtos-shopify-editar"],
    queryFn: () => fetchShopifyProducts(500),
    enabled: open,
  });

  // Inicializar dados quando proposta muda
  useEffect(() => {
    if (proposta && open) {
      setItens(proposta.itens || []);
      setTransportadora(proposta.frete_transportadora || "");
      setValorFrete(proposta.valor_frete?.toString() || "");
      setPrazoEntrega(proposta.frete_prazo_estimado || "");
      setShowSuccessMessage(false);
      setNewPropostaLink("");
      setUsarFreteManual(proposta.frete_tipo === "manual");
      setSelectedFreteType(proposta.frete_tipo || "");
      setShippingOptions([]);
    }
  }, [proposta, open]);

  // Calcular opções de frete quando itens mudam
  const calcularFreteOpcoes = useCallback(async () => {
    const cep = proposta?.cliente_endereco?.cep;
    if (!cep || itens.length === 0 || usarFreteManual) {
      return;
    }

    setIsLoadingShipping(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-shipping', {
        body: {
          cep: cep.replace(/\D/g, ''),
          items: itens.map(item => ({ quantity: item.quantity })),
        }
      });

      if (error) throw error;

      const options: ShippingOption[] = [];
      const today = new Date();

      // PAC
      if (data?.pac?.cost) {
        options.push({
          type: 'pac',
          label: 'PAC (Correios)',
          cost: data.pac.cost,
          days: 5,
          estimatedDate: addBusinessDays(today, 5),
        });
      }

      // SEDEX
      if (data?.sedex?.cost) {
        options.push({
          type: 'sedex',
          label: 'SEDEX (Correios)',
          cost: data.sedex.cost,
          days: 2,
          estimatedDate: addBusinessDays(today, 2),
        });
      }

      // Retirada na Matriz - sempre grátis
      options.push({
        type: 'retirada',
        label: 'Retirada na Matriz',
        cost: 0,
      });

      // Frete Grátis se valor >= R$199,90
      if (calculo.valorProdutos >= 199.90) {
        options.push({
          type: 'free',
          label: 'Frete Grátis (compras acima de R$199,90)',
          cost: 0,
          days: 10,
          estimatedDate: addBusinessDays(today, 10),
        });
      }

      setShippingOptions(options);
      
      // Auto-selecionar a melhor opção
      if (!selectedFreteType || !options.find(o => o.type === selectedFreteType)) {
        if (calculo.valorProdutos >= 199.90) {
          setSelectedFreteType('free');
          setValorFrete("0");
        } else if (options.length > 0) {
          // Selecionar PAC por padrão
          const pacOption = options.find(o => o.type === 'pac');
          if (pacOption) {
            setSelectedFreteType('pac');
            setValorFrete(pacOption.cost.toString());
          } else {
            setSelectedFreteType(options[0].type);
            setValorFrete(options[0].cost.toString());
          }
        }
      }
    } catch (error) {
      console.error('Erro ao calcular frete:', error);
      toast.error('Erro ao calcular opções de frete. Use o modo manual.');
      setUsarFreteManual(true);
    } finally {
      setIsLoadingShipping(false);
    }
  }, [proposta?.cliente_endereco?.cep, itens, usarFreteManual]);

  // Calcular totais
  const calculo = useMemo(() => {
    const subtotal = itens.reduce((acc, item) => 
      acc + (parseFloat(item.price) * item.quantity), 0
    );
    const descontoPercentual = proposta?.desconto_percentual || 0;
    const descontoValor = subtotal * (descontoPercentual / 100);
    const valorProdutos = subtotal - descontoValor;
    const frete = parseFloat(valorFrete) || 0;
    const total = valorProdutos + frete;
    
    return { subtotal, descontoPercentual, descontoValor, valorProdutos, frete, total };
  }, [itens, proposta?.desconto_percentual, valorFrete]);

  // Recalcular frete quando itens mudam
  useEffect(() => {
    if (open && proposta && !usarFreteManual && itens.length > 0) {
      calcularFreteOpcoes();
    }
  }, [itens, open, proposta, usarFreteManual, calcularFreteOpcoes]);

  // Atualizar valor do frete quando seleciona uma opção
  useEffect(() => {
    if (!usarFreteManual && selectedFreteType) {
      const option = shippingOptions.find(o => o.type === selectedFreteType);
      if (option) {
        setValorFrete(option.cost.toString());
        setTransportadora(option.label);
        setPrazoEntrega(option.estimatedDate ? `Previsão: ${option.estimatedDate}` : '');
      }
    }
  }, [selectedFreteType, shippingOptions, usarFreteManual]);

  // Filtrar produtos para busca
  const produtosFiltrados = useMemo(() => {
    if (!produtos || !searchTerm.trim()) return [];
    const termo = searchTerm.toLowerCase();
    return produtos.filter(p => {
      const variant = p.node.variants?.edges?.[0]?.node;
      const sku = variant?.sku?.toLowerCase() || '';
      return p.node.title.toLowerCase().includes(termo) || sku.includes(termo);
    }).slice(0, 10);
  }, [produtos, searchTerm]);

  // Adicionar produto
  const adicionarProduto = useCallback((product: ShopifyProduct) => {
    const variant = product.node.variants?.edges?.[0]?.node;
    if (!variant) return;
    
    const imageUrl = product.node.images?.edges?.[0]?.node?.url || null;
    
    setItens(prev => {
      const existe = prev.find(item => item.variantId === variant.id);
      if (existe) {
        return prev.map(item => 
          item.variantId === variant.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { 
        variantId: variant.id,
        title: product.node.title,
        quantity: 1,
        price: variant.price.amount,
        sku: variant.sku,
        imageUrl
      }];
    });
    setSearchTerm("");
  }, []);

  // Alterar quantidade
  const alterarQuantidade = useCallback((variantId: string, delta: number) => {
    setItens(prev => 
      prev.map(item => {
        if (item.variantId === variantId) {
          const novaQtd = item.quantity + delta;
          return novaQtd > 0 ? { ...item, quantity: novaQtd } : item;
        }
        return item;
      }).filter(item => item.quantity > 0)
    );
  }, []);

  // Remover produto
  const removerProduto = useCallback((variantId: string) => {
    setItens(prev => prev.filter(item => item.variantId !== variantId));
  }, []);

  // Salvar alterações
  const handleSalvar = async () => {
    if (!proposta || itens.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }

    setIsSaving(true);
    
    try {
      // Gerar novo token
      const novoToken = crypto.randomUUID();
      const frete = parseFloat(valorFrete) || 0;
      
      // Atualizar proposta - converter itens para JSON compatível
      const itensJson = JSON.parse(JSON.stringify(itens));
      
      const freteType = usarFreteManual ? "manual" : selectedFreteType;
      
      const { error } = await supabase
        .from("vendedor_propostas")
        .update({
          itens: itensJson,
          valor_produtos: calculo.valorProdutos,
          valor_frete: frete,
          valor_total: calculo.valorProdutos + frete,
          token: novoToken,
          frete_tipo: freteType,
          frete_transportadora: transportadora || null,
          frete_prazo_estimado: prazoEntrega || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposta.id);
      
      if (error) throw error;
      
      const link = `https://gestaoebd.com.br/proposta/${novoToken}`;
      setNewPropostaLink(link);
      setShowSuccessMessage(true);
      
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar alterações");
    } finally {
      setIsSaving(false);
    }
  };

  // Copiar mensagem completa - versão simplificada para edição
  const copiarMensagemCompleta = async () => {
    const mensagem = `Prezado(a) ${proposta?.cliente_nome || '[Nome do Cliente]'},

Segue a nova proposta com as alterações solicitadas!

Clique no link abaixo para conferir os detalhes atualizados:

${newPropostaLink}

Após verificar, clique em "CONFIRMAR COMPRA" para finalizar.

Qualquer dúvida, estou à disposição!

Atenciosamente,
${vendedor?.nome || '[Nome do Vendedor]'}`;

    await navigator.clipboard.writeText(mensagem);
    setMessageCopied(true);
    toast.success("Mensagem copiada!");
    setTimeout(() => setMessageCopied(false), 3000);
  };

  // Fechar e limpar
  const handleClose = () => {
    if (showSuccessMessage) {
      onSuccess();
    }
    onOpenChange(false);
    setShowSuccessMessage(false);
    setSearchTerm("");
  };

  if (!proposta) return null;

  // Tela de sucesso após salvar
  if (showSuccessMessage) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Proposta Atualizada com Sucesso!
            </DialogTitle>
            <DialogDescription>
              Copie a mensagem abaixo e envie ao cliente para que ele confirme a compra.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-blue-800">Mensagem para enviar ao cliente:</p>
              <div className="bg-white rounded border p-3 text-sm text-muted-foreground whitespace-pre-line">
{`Prezado(a) ${proposta.cliente_nome || '[Nome do Cliente]'},

Segue a nova proposta com as alterações solicitadas!

Clique no link abaixo para conferir os detalhes atualizados:

${newPropostaLink}

Após verificar, clique em "CONFIRMAR COMPRA" para finalizar.

Qualquer dúvida, estou à disposição!

Atenciosamente,
${vendedor?.nome || '[Nome do Vendedor]'}`}
              </div>
              <Button
                variant={messageCopied ? "default" : "secondary"}
                size="sm"
                className={messageCopied ? "bg-green-600 hover:bg-green-700 w-full" : "w-full"}
                onClick={copiarMensagemCompleta}
              >
                {messageCopied ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mensagem Copiada!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Mensagem Completa
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <div className="flex justify-center">
            <Button variant="outline" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const clienteCep = proposta.cliente_endereco?.cep;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Proposta</DialogTitle>
          <DialogDescription>
            Cliente: <strong>{proposta.cliente_nome}</strong>
            {clienteCep && <span className="ml-2 text-xs">• CEP: {clienteCep}</span>}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Produtos da proposta */}
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-3">
              <Package className="h-4 w-4" />
              Produtos da Proposta
            </h4>
            <ScrollArea className="h-[150px] border rounded-lg p-2">
              {itens.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum produto na proposta
                </div>
              ) : (
                <div className="space-y-2">
                  {itens.map((item) => (
                    <div key={item.variantId} className="flex items-center gap-2 p-2 rounded-lg border text-sm">
                      {item.imageUrl && (
                        <img 
                          src={item.imageUrl} 
                          alt={item.title}
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.sku && `SKU: ${item.sku} • `}
                          R$ {parseFloat(item.price).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => alterarQuantidade(item.variantId, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-xs">{item.quantity}</span>
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => alterarQuantidade(item.variantId, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removerProduto(item.variantId)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Adicionar produto */}
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <Plus className="h-4 w-4" />
              Adicionar Produto
            </h4>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            {produtosFiltrados.length > 0 && (
              <div className="mt-2 border rounded-lg max-h-[120px] overflow-y-auto">
                {produtosFiltrados.map((product) => {
                  const variant = product.node.variants?.edges?.[0]?.node;
                  return (
                    <div
                      key={product.node.id}
                      className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer text-sm border-b last:border-0"
                      onClick={() => adicionarProduto(product)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{product.node.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {variant?.sku && `SKU: ${variant.sku} • `}
                          R$ {parseFloat(variant?.price?.amount || "0").toFixed(2)}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-primary" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Frete */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Forma de Envio
              </h4>
              <div className="flex items-center gap-2">
                <Label htmlFor="frete-manual" className="text-xs text-muted-foreground">Frete Manual</Label>
                <Switch
                  id="frete-manual"
                  checked={usarFreteManual}
                  onCheckedChange={setUsarFreteManual}
                />
              </div>
            </div>

            {usarFreteManual ? (
              // Modo manual - campos de texto
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Transportadora</label>
                  <Input
                    value={transportadora}
                    onChange={(e) => setTransportadora(e.target.value)}
                    placeholder="Ex: Jamef"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valor (R$)</label>
                  <Input
                    type="number"
                    value={valorFrete}
                    onChange={(e) => setValorFrete(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Prazo</label>
                  <Input
                    value={prazoEntrega}
                    onChange={(e) => setPrazoEntrega(e.target.value)}
                    placeholder="Ex: 5 dias úteis"
                  />
                </div>
              </div>
            ) : (
              // Modo automático - opções de frete
              <div className="space-y-3">
                {!clienteCep ? (
                  <div className="text-center py-4 text-amber-600 bg-amber-50 rounded-lg text-sm">
                    <MapPin className="h-4 w-4 inline mr-1" />
                    Cliente sem CEP cadastrado. Use o modo manual.
                  </div>
                ) : isLoadingShipping ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Loader2 className="h-4 w-4 inline mr-2 animate-spin" />
                    Calculando opções de frete...
                  </div>
                ) : shippingOptions.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Nenhuma opção de frete disponível. Use o modo manual.
                  </div>
                ) : (
                  <RadioGroup value={selectedFreteType} onValueChange={setSelectedFreteType}>
                    {shippingOptions.map((option) => (
                      <div
                        key={option.type}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedFreteType === option.type 
                            ? 'border-primary bg-primary/5' 
                            : 'hover:bg-accent'
                        }`}
                        onClick={() => setSelectedFreteType(option.type)}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={option.type} id={option.type} />
                          <div>
                            <Label htmlFor={option.type} className="font-medium cursor-pointer">
                              {option.type === 'retirada' && <Store className="h-3 w-3 inline mr-1" />}
                              {option.label}
                            </Label>
                            {option.type === 'retirada' ? (
                              <p className="text-xs text-muted-foreground">
                                {ENDERECO_MATRIZ.rua}, {ENDERECO_MATRIZ.numero} - {ENDERECO_MATRIZ.bairro}
                              </p>
                            ) : option.estimatedDate && (
                              <p className="text-xs text-muted-foreground">
                                Previsão: {option.estimatedDate} ({option.days} dias úteis)
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`font-semibold ${option.cost === 0 ? 'text-green-600' : ''}`}>
                          {option.cost === 0 ? 'Grátis' : `R$ ${option.cost.toFixed(2)}`}
                        </span>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Resumo */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>R$ {calculo.subtotal.toFixed(2)}</span>
            </div>
            {calculo.descontoPercentual > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Desconto ({calculo.descontoPercentual.toFixed(0)}%):</span>
                <span>- R$ {calculo.descontoValor.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frete:</span>
              <span className={calculo.frete === 0 ? 'text-green-600' : ''}>
                {calculo.frete === 0 ? 'Grátis' : `R$ ${calculo.frete.toFixed(2)}`}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span className="text-green-600">R$ {calculo.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={isSaving || itens.length === 0}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar e Gerar Novo Link"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
