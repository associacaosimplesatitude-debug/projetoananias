import { MessageCircle, Loader2 } from "lucide-react";
import WhatsAppChat from "@/components/admin/WhatsAppChat";
import { useWhatsAppRole } from "@/hooks/useWhatsAppRole";
import { BackfillLeadsButton } from "@/components/admin/whatsapp/BackfillLeadsButton";

const AtendimentoWhatsApp = () => {
  const { loading, isSuperAdmin, isGerente } = useWhatsAppRole();

  const scope: "superadmin" | "gerente" | "vendedor" = isSuperAdmin
    ? "superadmin"
    : isGerente
    ? "gerente"
    : "vendedor";

  return (
    <div className="-m-6 flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background">
        <MessageCircle className="h-5 w-5" style={{ color: '#25D366' }} />
        <h1 className="text-lg font-semibold">Atendimento WhatsApp</h1>
        {isSuperAdmin && (
          <div className="ml-auto">
            <BackfillLeadsButton />
          </div>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <WhatsAppChat scope={scope} />
        )}
      </div>
    </div>
  );
};

export default AtendimentoWhatsApp;
