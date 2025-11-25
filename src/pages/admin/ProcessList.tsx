import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface Church {
  id: string;
  church_name: string;
  current_stage: number;
  process_status: string;
  client_type: 'igreja' | 'associacao';
}

export default function AdminProcessList() {
  const [churches, setChurches] = useState<Church[]>([]);

  useEffect(() => {
    fetchChurches();
  }, []);

  const fetchChurches = async () => {
    const { data } = await supabase
      .from('churches')
      .select('id, church_name, current_stage, process_status, client_type')
      .neq('process_status', 'completed')
      .lt('current_stage', 7)
      .order('current_stage', { ascending: false })
      .order('church_name', { ascending: true });
    
    setChurches((data || []) as Church[]);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Processos em Andamento</h1>
            <p className="text-muted-foreground mt-2">
              Clientes que ainda não concluíram a Etapa 6 do funil de abertura
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {churches.length} {churches.length === 1 ? 'processo' : 'processos'} em andamento
          </Badge>
        </div>
      
        <Card>
          <CardHeader>
            <CardTitle>Lista de Processos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Etapa Atual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {churches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Não há processos em andamento. Todos os clientes concluíram a Etapa 6.
                    </TableCell>
                  </TableRow>
                ) : (
                  churches.map((church) => (
                    <TableRow key={church.id}>
                      <TableCell className="font-medium">
                        <Link 
                          to={`/admin/client-view/${church.id}`}
                          className="text-primary hover:underline text-lg"
                        >
                          {church.church_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={church.client_type === 'igreja' ? 'default' : 'secondary'}>
                          {church.client_type === 'igreja' ? 'Igreja' : 'Associação'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5, 6].map((stage) => {
                            const isCompleted = (church.current_stage || 1) > stage;
                            const isCurrent = (church.current_stage || 1) === stage;
                            return (
                              <div
                                key={stage}
                                className={`w-9 h-9 flex items-center justify-center text-sm font-semibold rounded border ${
                                  isCompleted
                                    ? 'bg-green-500 text-white border-green-600'
                                    : isCurrent
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-muted text-muted-foreground border-border'
                                }`}
                              >
                                {stage}
                              </div>
                            );
                          })}
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
