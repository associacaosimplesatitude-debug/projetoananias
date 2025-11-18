import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Task {
  id: string;
  church_id: string;
  church_name: string;
  stage_id: number;
  sub_task_id: string;
  status: string;
}

export default function AdminTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('church_stage_progress')
      .select(`
        *,
        churches (church_name)
      `)
      .neq('status', 'completed')
      .order('created_at', { ascending: true });
    
    const formattedTasks = data?.map(task => ({
      id: task.id,
      church_id: task.church_id,
      church_name: (task.churches as any)?.church_name || '',
      stage_id: task.stage_id,
      sub_task_id: task.sub_task_id,
      status: task.status,
    })) || [];
    
    setTasks(formattedTasks);
  };

  const completeTask = async (taskId: string) => {
    const { error } = await supabase
      .from('church_stage_progress')
      .update({ status: 'completed' })
      .eq('id', taskId);
    
    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível completar a tarefa',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Tarefa marcada como concluída',
      });
      fetchTasks();
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Gestão de Tarefas</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Tarefas Pendentes do Funil</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Igreja</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Sub-tarefa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.church_name}</TableCell>
                  <TableCell>Etapa {task.stage_id}</TableCell>
                  <TableCell>{task.sub_task_id}</TableCell>
                  <TableCell>
                    <Badge variant={task.status === 'in_progress' ? 'default' : 'secondary'}>
                      {task.status === 'in_progress' ? 'Em Andamento' : 'Pendente'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => completeTask(task.id)}
                      variant="outline"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Concluir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
