import { Navigate } from "react-router-dom";
import WhatsAppChat from "@/components/admin/WhatsAppChat";
import { useWhatsAppRole } from "@/hooks/useWhatsAppRole";
import { Loader2 } from "lucide-react";

export default function VendedorWhatsApp() {
  const { loading, isVendedor, isSuperAdmin, isGerente, vendedorId } = useWhatsAppRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando...
      </div>
    );
  }

  // Admin/gerente devem usar /admin/whatsapp
  if (isSuperAdmin || isGerente) {
    return <Navigate to="/admin/whatsapp" replace />;
  }

  if (!isVendedor || !vendedorId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Você não tem acesso a conversas do WhatsApp.
      </div>
    );
  }


  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Minhas Conversas WhatsApp</h1>
        <p className="text-muted-foreground">
          Conversas que o gerente encaminhou para você. O agente de IA está pausado nestas conversas — você responde diretamente ao cliente.
        </p>
      </div>
      <WhatsAppChat scope="vendedor" vendedorId={vendedorId} />
    </div>
  );
}
