import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Megaphone, Users } from "lucide-react";
import WhatsAppCampaigns from "@/components/admin/WhatsAppCampaigns";
import WhatsAppPublicos from "@/components/admin/WhatsAppPublicos";

export default function MarketingPanel() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6" />
          Marketing
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie campanhas de WhatsApp e públicos-alvo.
        </p>
      </div>

      <Tabs defaultValue="campanhas" className="w-full">
        <TabsList>
          <TabsTrigger value="campanhas" className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="publicos" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Públicos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="campanhas" className="mt-4">
          <WhatsAppCampaigns />
        </TabsContent>
        <TabsContent value="publicos" className="mt-4">
          <WhatsAppPublicos />
        </TabsContent>
      </Tabs>
    </div>
  );
}
