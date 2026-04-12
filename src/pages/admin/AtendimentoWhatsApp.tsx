import { MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const AtendimentoWhatsApp = () => {
  return (
    <div className="-m-6 flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" style={{ color: '#25D366' }} />
          <h1 className="text-lg font-semibold">Atendimento WhatsApp</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('https://crm.houseassessoria.com.br/login', '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          Abrir em nova aba
        </Button>
      </div>
      <iframe
        src="https://crm.houseassessoria.com.br/login"
        title="Atendimento WhatsApp"
        allow="microphone; camera; clipboard-read; clipboard-write"
        className="flex-1 w-full"
        style={{ border: 'none' }}
      />
    </div>
  );
};

export default AtendimentoWhatsApp;
