import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Loader2 } from "lucide-react";

interface VincularComissaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parcelaId: string;
  clienteNome: string;
  onConfirm: (data: {
    parcelaId: string;
    shopifyPedidoId: string;
    notaFiscalNumero: string;
    linkDanfe: string;
    blingOrderId?: number;
  }) => void;
  isLoading?: boolean;
}

export function VincularComissaoDialog({
  open,
  onOpenChange,
  parcelaId,
  clienteNome,
  onConfirm,
  isLoading = false,
}: VincularComissaoDialogProps) {
  const [shopifyPedidoId, setShopifyPedidoId] = useState("");
  const [notaFiscalNumero, setNotaFiscalNumero] = useState("");
  const [linkDanfe, setLinkDanfe] = useState("");
  const [blingOrderId, setBlingOrderId] = useState("");

  const handleConfirm = () => {
    if (!isValid) return;
    
    onConfirm({
      parcelaId,
      shopifyPedidoId: shopifyPedidoId.trim(),
      notaFiscalNumero: notaFiscalNumero.trim(),
      linkDanfe: linkDanfe.trim(),
      blingOrderId: blingOrderId ? parseInt(blingOrderId, 10) : undefined,
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setShopifyPedidoId("");
      setNotaFiscalNumero("");
      setLinkDanfe("");
      setBlingOrderId("");
    }
    onOpenChange(newOpen);
  };

  // UUID validation regex
  const isValidUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // URL validation
  const isValidURL = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  const isValid =
    shopifyPedidoId.trim() !== "" &&
    isValidUUID(shopifyPedidoId.trim()) &&
    notaFiscalNumero.trim() !== "" &&
    linkDanfe.trim() !== "" &&
    isValidURL(linkDanfe.trim()) &&
    (blingOrderId === "" || !isNaN(parseInt(blingOrderId, 10)));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-purple-600" />
            Vincular Comissão Manualmente
          </DialogTitle>
          <DialogDescription>
            Vincule manualmente a NF e DANFE para a comissão do cliente "{clienteNome}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Parcela ID - Readonly */}
          <div className="space-y-2">
            <Label htmlFor="parcela-id">Parcela ID</Label>
            <Input
              id="parcela-id"
              value={parcelaId}
              readOnly
              disabled
              className="bg-muted font-mono text-xs"
            />
          </div>

          {/* Shopify Pedido ID */}
          <div className="space-y-2">
            <Label htmlFor="shopify-pedido-id">
              Shopify Pedido ID <span className="text-red-500">*</span>
            </Label>
            <Input
              id="shopify-pedido-id"
              placeholder="ex: 550e8400-e29b-41d4-a716-446655440000"
              value={shopifyPedidoId}
              onChange={(e) => setShopifyPedidoId(e.target.value)}
              className="font-mono text-sm"
            />
            {shopifyPedidoId && !isValidUUID(shopifyPedidoId.trim()) && (
              <p className="text-xs text-red-500">UUID inválido</p>
            )}
          </div>

          {/* Nota Fiscal Numero */}
          <div className="space-y-2">
            <Label htmlFor="nota-fiscal-numero">
              Nota Fiscal Número <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nota-fiscal-numero"
              placeholder="ex: 030123"
              value={notaFiscalNumero}
              onChange={(e) => setNotaFiscalNumero(e.target.value)}
            />
          </div>

          {/* Link DANFE */}
          <div className="space-y-2">
            <Label htmlFor="link-danfe">
              Link DANFE <span className="text-red-500">*</span>
            </Label>
            <Input
              id="link-danfe"
              placeholder="https://..."
              value={linkDanfe}
              onChange={(e) => setLinkDanfe(e.target.value)}
            />
            {linkDanfe && !isValidURL(linkDanfe.trim()) && (
              <p className="text-xs text-red-500">URL inválida</p>
            )}
          </div>

          {/* Bling Order ID - Optional */}
          <div className="space-y-2">
            <Label htmlFor="bling-order-id">
              Bling Order ID <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="bling-order-id"
              placeholder="ex: 12345678"
              value={blingOrderId}
              onChange={(e) => setBlingOrderId(e.target.value)}
              type="number"
            />
            <p className="text-xs text-muted-foreground">
              Se informado, atualiza também o pedido Shopify caso não tenha vínculo com Bling.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Salvar Vínculo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
