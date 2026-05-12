import { MessageCircle } from "lucide-react";
import WhatsAppChat from "@/components/admin/WhatsAppChat";

const AtendimentoWhatsApp = () => {
  return (
    <div className="-m-6 flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background">
        <MessageCircle className="h-5 w-5" style={{ color: '#25D366' }} />
        <h1 className="text-lg font-semibold">Atendimento WhatsApp</h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <WhatsAppChat scope="admin" />
      </div>
    </div>
  );
};

export default AtendimentoWhatsApp;
