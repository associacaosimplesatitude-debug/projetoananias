import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronDown, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();

  const runSync = async (body: Record<string, any>, label: string) => {
    setLoading(true);
    setProgress(null);

    try {
      let skip = 0;
      let totalAvailable = 0;
      let totalProcessed = 0;
      let totalQuantidade = 0;
      let totalErrors = 0;

      do {
        const { data, error } = await supabase.functions.invoke<SyncResult>(
          "bling-sync-royalties-sales",
          { body: { ...body, max_nfes: BATCH_SIZE, skip } }
        );

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Erro desconhecido");

        totalAvailable = data.total_nfes_available;
        totalProcessed += data.nfes_processed;
        totalQuantidade += data.summary.total_quantidade;
        totalErrors += data.errors;

        skip += BATCH_SIZE;
        setProgress({ current: Math.min(skip, totalAvailable), total: totalAvailable });

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

  const handleSync = async (days: number) => {
    setSelectedDays(days);
    let actualDays = days;
    if (days === -1) {
      const now = new Date();
      const jan1 = new Date(now.getFullYear(), 0, 1);
      actualDays = Math.ceil((now.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
    }
    await runSync({ days_back: actualDays }, `${days}d`);
  };

  const handleCustomSync = async () => {
    if (!customStartDate || !customEndDate) {
      toast({ title: "Selecione as duas datas", variant: "destructive" });
      return;
    }
    if (customStartDate > customEndDate) {
      toast({ title: "Data início deve ser anterior à data fim", variant: "destructive" });
      return;
    }
    setCustomDialogOpen(false);
    setSelectedDays(-2); // marker for custom
    await runSync({
      data_inicio: format(customStartDate, "yyyy-MM-dd"),
      data_fim: format(customEndDate, "yyyy-MM-dd"),
    }, "personalizado");
  };

  const getButtonLabel = () => {
    if (progress) {
      return `Sincronizando ${progress.current}/${progress.total}...`;
    }
    if (loading) return "Sincronizando...";
    if (selectedDays === -2) return "Sincronizar (custom)";
    return selectedDays === -1 ? "Sincronizar (Jan)" : `Sincronizar (${selectedDays}d)`;
  };

  return (
    <>
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCustomDialogOpen(true)}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              Período personalizado
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Período personalizado</DialogTitle>
            <DialogDescription>Selecione o intervalo de datas para sincronizar.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data início</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !customStartDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStartDate ? format(customStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStartDate} onSelect={setCustomStartDate} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data fim</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !customEndDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEndDate ? format(customEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEndDate} onSelect={setCustomEndDate} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCustomSync} disabled={!customStartDate || !customEndDate}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
