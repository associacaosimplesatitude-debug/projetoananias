import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Church {
  id: string;
  church_name: string;
  pastor_email: string;
  current_stage: number;
  city: string;
  state: string;
}

export default function AdminClients() {
  const [churches, setChurches] = useState<Church[]>([]);

  useEffect(() => {
    fetchChurches();
  }, []);

  const fetchChurches = async () => {
    const { data } = await supabase
      .from('churches')
      .select('*')
      .order('created_at', { ascending: false });
    
    setChurches(data || []);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Gestão de Clientes</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Lista de Igrejas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome da Igreja</TableHead>
                <TableHead>Email do Pastor</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Etapa Atual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {churches.map((church) => (
                <TableRow key={church.id}>
                  <TableCell className="font-medium">{church.church_name}</TableCell>
                  <TableCell>{church.pastor_email}</TableCell>
                  <TableCell>{church.city}, {church.state}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      Etapa {church.current_stage}/6
                    </Badge>
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
