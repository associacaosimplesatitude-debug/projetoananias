import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, FileText, Send, History } from "lucide-react";
import { EmailTemplatesTab } from "@/components/royalties/EmailTemplatesTab";
import { SendEmailTab } from "@/components/royalties/SendEmailTab";
import { EmailLogsTab } from "@/components/royalties/EmailLogsTab";

export default function RoyaltiesEmails() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Emails Transacionais</h1>
        <p className="text-muted-foreground">
          Gerencie templates de email e envie notificações para autores
        </p>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="enviar" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Enviar Email
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <EmailTemplatesTab />
        </TabsContent>

        <TabsContent value="enviar">
          <SendEmailTab />
        </TabsContent>

        <TabsContent value="historico">
          <EmailLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
