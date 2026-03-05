import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Rocket, Calendar, Tag } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const categoryColors: Record<string, string> = {
  vendas: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  ebd: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  integracao: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  admin: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  financeiro: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  whatsapp: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  royalties: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
};

const categoryLabels: Record<string, string> = {
  vendas: "Vendas",
  ebd: "EBD",
  integracao: "Integração",
  admin: "Admin",
  financeiro: "Financeiro",
  whatsapp: "WhatsApp",
  royalties: "Royalties",
};

export default function Implementacoes() {
  const { data: implementations, isLoading } = useQuery({
    queryKey: ["system-implementations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_implementations")
        .select("*")
        .order("implemented_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Rocket className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Implementações</h1>
          <p className="text-muted-foreground text-sm">
            Histórico de funcionalidades implementadas no sistema
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas Implementações</CardTitle>
          <CardDescription>
            Acompanhe as atualizações e novas funcionalidades do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <Skeleton className="h-10 w-24 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : !implementations?.length ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma implementação registrada.
            </p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[5.5rem] top-0 bottom-0 w-px bg-border" />

              <div className="space-y-6">
                {implementations.map((impl, index) => {
                  const prevDate = index > 0 ? implementations[index - 1].implemented_at : null;
                  const showDate = impl.implemented_at !== prevDate;

                  return (
                    <div key={impl.id} className="flex gap-4 items-start relative">
                      {/* Date column */}
                      <div className="w-20 flex-shrink-0 text-right">
                        {showDate && (
                          <div className="text-xs font-medium text-muted-foreground">
                            {format(new Date(impl.implemented_at + "T12:00:00"), "dd MMM yyyy", { locale: ptBR })}
                          </div>
                        )}
                      </div>

                      {/* Dot */}
                      <div className="relative z-10 flex-shrink-0 mt-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-2">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className="font-medium text-sm">{impl.title}</span>
                          {impl.category && (
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 ${categoryColors[impl.category] || ""}`}
                            >
                              {categoryLabels[impl.category] || impl.category}
                            </Badge>
                          )}
                        </div>
                        {impl.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {impl.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
