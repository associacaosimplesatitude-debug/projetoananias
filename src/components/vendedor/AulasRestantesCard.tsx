import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Target, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AulasRestantesCardProps {
  vendedorId: string;
}

interface ChurchProgress {
  church_id: string;
  church_name: string;
  vendedor_id: string | null;
  remaining: number;
  total: number;
  completed: number;
  data_termino: string;
}

export function AulasRestantesCard({ vendedorId }: AulasRestantesCardProps) {
  const navigate = useNavigate();
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [selectedProgressRange, setSelectedProgressRange] = useState<'high' | 'medium' | 'low' | null>(null);

  // Query to fetch churches with their REMAINING lessons progress for this vendedor
  const { data: churchProgress } = useQuery({
    queryKey: ['vendedor-church-lesson-progress', vendedorId],
    queryFn: async () => {
      // Get clientes do vendedor
      const { data: clientes, error: clientesError } = await supabase
        .from('ebd_clientes')
        .select('id, nome_igreja')
        .eq('vendedor_id', vendedorId);
      if (clientesError) throw clientesError;

      if (!clientes || clientes.length === 0) return [];

      // Get planejamento for each cliente
      const { data: planejamentos, error: planError } = await supabase
        .from('ebd_planejamento')
        .select(`
          id,
          church_id,
          data_inicio,
          data_termino,
          dia_semana,
          revista:ebd_revistas(id, titulo, num_licoes)
        `)
        .in('church_id', clientes.map(c => c.id));
      if (planError) throw planError;

      // Calculate REMAINING lessons for each church - ONLY from ACTIVE planejamentos
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const churchProgressMap: Record<string, ChurchProgress> = {};

      clientes.forEach(cliente => {
        const churchPlanejamentos = planejamentos?.filter(p => p.church_id === cliente.id) || [];
        
        // Filter ONLY ACTIVE planejamentos (data_termino >= today)
        const activePlans = churchPlanejamentos.filter(plan => {
          if (!plan.data_termino) return false;
          const endDate = new Date(plan.data_termino + 'T23:59:59');
          return endDate >= today;
        });

        // Get the first active planejamento (closest to ending)
        let bestPlan: any = null;
        let minRemaining = Infinity;

        activePlans.forEach(plan => {
          const revista = plan.revista as any;
          if (revista && plan.data_termino) {
            const startDate = new Date(plan.data_inicio);
            const totalLessons = revista.num_licoes || 13;
            
            // Calculate elapsed weeks since start
            let elapsedWeeks = 0;
            if (today >= startDate) {
              elapsedWeeks = Math.floor((today.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
            }
            
            const completedLessons = Math.min(elapsedWeeks, totalLessons);
            const remainingLessons = Math.max(0, totalLessons - completedLessons);
            
            if (remainingLessons < minRemaining) {
              minRemaining = remainingLessons;
              bestPlan = {
                remaining: remainingLessons,
                total: totalLessons,
                completed: completedLessons,
                data_termino: plan.data_termino,
              };
            }
          }
        });

        if (bestPlan) {
          churchProgressMap[cliente.id] = {
            church_id: cliente.id,
            church_name: cliente.nome_igreja,
            vendedor_id: vendedorId,
            remaining: bestPlan.remaining,
            total: bestPlan.total,
            completed: bestPlan.completed,
            data_termino: bestPlan.data_termino,
          };
        }
      });

      return Object.values(churchProgressMap);
    },
    enabled: !!vendedorId,
  });

  // Group by REMAINING lessons
  const progressGroups = useMemo(() => {
    if (!churchProgress) return { high: [], medium: [], low: [] };
    
    return {
      high: churchProgress.filter(c => c.remaining >= 9 && c.remaining <= 13),
      medium: churchProgress.filter(c => c.remaining >= 5 && c.remaining <= 8),
      low: churchProgress.filter(c => c.remaining >= 0 && c.remaining <= 4),
    };
  }, [churchProgress]);

  const totalWithProgress = (churchProgress?.length || 0);

  if (totalWithProgress === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Aulas Restantes por Igreja
          </CardTitle>
          <CardDescription>Baseado no planejamento escolar dos seus clientes. Clique para ver detalhes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => { setSelectedProgressRange('high'); setProgressDialogOpen(true); }}
              className="p-4 rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-red-700 dark:text-red-300">9 a 13 restantes</span>
                <Badge className="bg-red-500 hover:bg-red-600">{progressGroups.high.length}</Badge>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Muitas aulas ainda</p>
              <Progress value={30} className="mt-2 h-2 [&>div]:bg-red-500" />
            </button>

            <button
              onClick={() => { setSelectedProgressRange('medium'); setProgressDialogOpen(true); }}
              className="p-4 rounded-lg border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950 hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">5 a 8 restantes</span>
                <Badge className="bg-yellow-500 hover:bg-yellow-600">{progressGroups.medium.length}</Badge>
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Chegando perto do fim</p>
              <Progress value={60} className="mt-2 h-2 [&>div]:bg-yellow-500" />
            </button>

            <button
              onClick={() => { setSelectedProgressRange('low'); setProgressDialogOpen(true); }}
              className="p-4 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">0 a 4 restantes</span>
                <Badge className="bg-green-500 hover:bg-green-600">{progressGroups.low.length}</Badge>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">🛒 Prontas para comprar revistas!</p>
              <Progress value={90} className="mt-2 h-2 [&>div]:bg-green-500" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Progress Dialog */}
      <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedProgressRange === 'high' && <Badge className="bg-red-500">9 a 13 restantes</Badge>}
              {selectedProgressRange === 'medium' && <Badge className="bg-yellow-500">5 a 8 restantes</Badge>}
              {selectedProgressRange === 'low' && <Badge className="bg-green-500">0 a 4 restantes</Badge>}
              Igrejas com turmas terminando
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {selectedProgressRange && progressGroups[selectedProgressRange].length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhuma igreja nesta faixa</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Igreja</TableHead>
                    <TableHead>Aulas Restantes</TableHead>
                    <TableHead>Término</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProgressRange && progressGroups[selectedProgressRange].map((church) => (
                    <TableRow key={church.church_id}>
                      <TableCell className="font-medium">{church.church_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={(church.completed / church.total) * 100} 
                            className={`w-20 h-2 ${
                              selectedProgressRange === 'high' ? '[&>div]:bg-red-500' :
                              selectedProgressRange === 'medium' ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'
                            }`} 
                          />
                          <span className="text-sm font-medium">{church.completed} de {church.total}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {church.data_termino ? format(new Date(church.data_termino + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigate(`/vendedor/shopify?clienteId=${church.church_id}&clienteNome=${encodeURIComponent(church.church_name)}`);
                            setProgressDialogOpen(false);
                          }}
                        >
                          <ShoppingCart className="h-4 w-4 mr-1" />
                          Fazer Pedido
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
