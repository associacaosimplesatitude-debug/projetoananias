import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BlingSyncButtonProps {
  onSyncComplete: () => void;
}

interface SyncResult {
  success: boolean;
  synced: number;
  skipped: number;
  errors: number;
  nfes_processed: number;
  total_nfes_available: number;
  summary: {
    total_quantidade: number;
    total_valor_vendas: number;
    total_royalties: number;
  };
  error?: string;
}

const BATCH_SIZE = 50;

const PERIOD_OPTIONS = [
  { days: 30, label: "30 dias" },
  { days: 60, label: "60 dias" },
  { days: 90, label: "90 dias" },
  { days: 180, label: "180 dias" },
  { days: -1, label: "Desde 01/Jan" },
];

export function BlingSyncButton({ onSyncComplete }: BlingSyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [selectedDays, setSelectedDays] = useState(60);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const handleSync = async (days: number) => {
    setLoading(true);
    setSelectedDays(days);
    setProgress(null);

    try {
      let actualDays = days;
      if (days === -1) {
        const now = new Date();
        const jan1 = new Date(now.getFullYear(), 0, 1);
        actualDays = Math.ceil((now.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
      }

      let skip = 0;
      let totalAvailable = 0;
      let totalProcessed = 0;
      let totalQuantidade = 0;
      let totalErrors = 0;

      // Loop em lotes
      do {
        const { data, error } = await supabase.functions.invoke<SyncResult>(
          "bling-sync-royalties-sales",
          { body: { days_back: actualDays, max_nfes: BATCH_SIZE, skip, dry_run: false } }
        );

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Erro desconhecido");

        totalAvailable = data.total_nfes_available;
        totalProcessed += data.nfes_processed;
        totalQuantidade += data.summary.total_quantidade;
        totalErrors += data.errors;

        skip += BATCH_SIZE;
        setProgress({ current: Math.min(skip, totalAvailable), total: totalAvailable });

        // Delay entre lotes
        if (skip < totalAvailable) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } while (skip < totalAvailable);

      toast({
        title: "Sincronização concluída",
        description: `${totalProcessed} NF-es processadas. ${totalQuantidade} livros vendidos encontrados.${totalErrors > 0 ? ` ${totalErrors} erros.` : ""}`,
      });
      onSyncComplete();
    } catch (error: any) {
      console.error("Sync error:", error);
      toast({
        title: "Erro na sincronização",
        description: error.message || "Não foi possível sincronizar com o Bling",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const getButtonLabel = () => {
    if (progress) {
      return `Sincronizando ${progress.current}/${progress.total}...`;
    }
    if (loading) return "Sincronizando...";
    return selectedDays === -1 ? "Sincronizar (Jan)" : `Sincronizar (${selectedDays}d)`;
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        onClick={() => handleSync(selectedDays)}
        disabled={loading}
        className="rounded-r-none"
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {getButtonLabel()}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={loading} className="rounded-l-none border-l-0">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {PERIOD_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.days}
              onClick={() => handleSync(option.days)}
            >
              {option.days === -1 ? option.label : `Últimos ${option.label}`}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
