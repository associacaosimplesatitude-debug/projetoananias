import { VendedorLeadsKanban } from "@/components/vendedor/VendedorLeadsKanban";
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
    <div className="space-y-4 h-full">
      <div>
        <h2 className="text-2xl font-bold">Leads de Landing Page</h2>
        <p className="text-muted-foreground">
          Gerencie seus leads atribuídos - arraste entre as colunas para atualizar o status
        </p>
      </div>
      <VendedorLeadsKanban vendedorId={vendedor?.id || ""} />
    </div>
  );
}
