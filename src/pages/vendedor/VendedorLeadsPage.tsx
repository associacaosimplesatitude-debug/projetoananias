import { VendedorLeadsTab } from "@/components/vendedor/VendedorLeadsTab";
import { useVendedor } from "@/hooks/useVendedor";

export default function VendedorLeadsPage() {
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
        <h2 className="text-2xl font-bold">Leads</h2>
        <p className="text-muted-foreground">Gestão de leads para reativação</p>
      </div>
      <VendedorLeadsTab vendedorId={vendedor?.id || ""} />
    </div>
  );
}
