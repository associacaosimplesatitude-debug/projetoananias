import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BlingSyncButtonProps {
  onSyncComplete: () => void;
}

interface SyncResult {
  success: boolean;
  synced: number;
  skipped: number;
  errors: number;
  summary: {
    total_quantidade: number;
    total_valor_vendas: number;
    total_royalties: number;
  };
  error?: string;
}

export function BlingSyncButton({ onSyncComplete }: BlingSyncButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke<SyncResult>(
        "bling-sync-royalties-sales",
        {
          body: { days_back: 90, dry_run: false },
        }
      );

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Sincronização concluída",
          description: `${data.synced} pedidos sincronizados, ${data.skipped} ignorados, ${data.errors} erros. Total: ${data.summary.total_quantidade} livros vendidos.`,
        });
        onSyncComplete();
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      toast({
        title: "Erro na sincronização",
        description: error.message || "Não foi possível sincronizar com o Bling",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleSync}
      disabled={loading}
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Sincronizando..." : "Sincronizar com Bling"}
    </Button>
  );
}
