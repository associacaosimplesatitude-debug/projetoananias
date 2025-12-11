import { VendedorPedidosTab } from "@/components/vendedor/VendedorPedidosTab";
import { useVendedor } from "@/hooks/useVendedor";

export default function VendedorPedidosPage() {
  const { vendedor, isLoading } = useVendedor();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Pedidos</h2>
        <p className="text-muted-foreground">Histórico de pedidos dos seus clientes</p>
      </div>
      <VendedorPedidosTab vendedorId={vendedor?.id || ""} />
    </div>
  );
}
