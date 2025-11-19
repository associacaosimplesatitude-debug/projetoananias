import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Filter, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { initialStages } from '@/data/stages';

interface Task {
  id: string;
  church_id: string;
  church_name: string;
  stage_id: number;
  sub_task_id: string;
  status: string;
  created_at: string;
}

export default function AdminTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    filterTasks();
  }, [tasks, stageFilter, statusFilter]);

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('church_stage_progress')
      .select(`
        *,
        churches (church_name)
      `)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: true });
    
    const formattedTasks = data?.map(task => ({
      id: task.id,
      church_id: task.church_id,
      church_name: (task.churches as any)?.church_name || '',
      stage_id: task.stage_id,
      sub_task_id: task.sub_task_id,
      status: task.status,
      created_at: task.created_at,
    })) || [];
    
    setTasks(formattedTasks);
  };

  const filterTasks = () => {
    let filtered = [...tasks];

    if (stageFilter !== 'all') {
      filtered = filtered.filter(task => task.stage_id === parseInt(stageFilter));
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    setFilteredTasks(filtered);
  };

  const getSubTaskName = (stageId: number, subTaskId: string) => {
    const stage = initialStages.find(s => s.id === stageId);
    const subTask = stage?.subTasks.find(st => st.id === subTaskId);
    return subTask?.name || subTaskId;
  };

  const getStageName = (stageId: number) => {
    const stage = initialStages.find(s => s.id === stageId);
    return stage?.name || `Etapa ${stageId}`;
  };

  const approveTask = async (taskId: string) => {
    const { error } = await supabase
      .from('church_stage_progress')
      .update({ status: 'completed' })
      .eq('id', taskId);
    
    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível aprovar a tarefa',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Tarefa aprovada',
      });
      fetchTasks();
    }
  };

  const rejectTask = async (taskId: string) => {
    const { error } = await supabase
      .from('church_stage_progress')
      .update({ status: 'rejected' })
      .eq('id', taskId);
    
    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível reprovar a tarefa',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Tarefa reprovada',
      });
      fetchTasks();
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Gestão de Tarefas</h1>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {filteredTasks.length} tarefas pendentes
          </Badge>
        </div>
      
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Tarefas Pendentes do Funil</CardTitle>
              <div className="flex gap-2">
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Filtrar por etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as etapas</SelectItem>
                    {initialStages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id.toString()}>
                        Etapa {stage.id}: {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Igreja</TableHead>
                  <TableHead>Etapa do Funil</TableHead>
                  <TableHead>Sub-tarefa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma tarefa encontrada com os filtros selecionados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.church_name}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">Etapa {task.stage_id}</div>
                          <div className="text-xs text-muted-foreground">{getStageName(task.stage_id)}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getSubTaskName(task.stage_id, task.sub_task_id)}</TableCell>
                      <TableCell>
                        <Badge variant={task.status === 'in_progress' ? 'default' : 'secondary'}>
                          {task.status === 'in_progress' ? 'Em Andamento' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            onClick={() => approveTask(task.id)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => rejectTask(task.id)}
                            variant="destructive"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Reprovar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
