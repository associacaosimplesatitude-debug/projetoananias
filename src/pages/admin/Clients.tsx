import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Church {
  id: string;
  church_name: string;
  pastor_email: string;
  current_stage: number;
  city: string;
  state: string;
  address: string;
  neighborhood: string;
  postal_code: string;
}

export default function AdminClients() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedChurch, setSelectedChurch] = useState<Church | null>(null);
  const [formData, setFormData] = useState({
    church_name: '',
    pastor_email: '',
    city: '',
    state: '',
    address: '',
    neighborhood: '',
    postal_code: '',
  });
  const { toast } = useToast();
  const { user } = useAuth();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    const { error } = await supabase
      .from('churches')
      .insert({
        ...formData,
        user_id: user.id,
      });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível cadastrar o cliente',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sucesso',
        description: 'Cliente cadastrado com sucesso',
      });
      setOpen(false);
      setFormData({
        church_name: '',
        pastor_email: '',
        city: '',
        state: '',
        address: '',
        neighborhood: '',
        postal_code: '',
      });
      fetchChurches();
    }
  };

  const getStageColor = (stage: number) => {
    if (stage === 6) return 'default';
    if (stage >= 4) return 'secondary';
    return 'outline';
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Gestão de Clientes</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Cadastrar Nova Igreja</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do novo cliente para iniciar o funil
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="church_name">Nome da Igreja</Label>
                    <Input
                      id="church_name"
                      value={formData.church_name}
                      onChange={(e) => setFormData({ ...formData, church_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pastor_email">Email do Pastor</Label>
                    <Input
                      id="pastor_email"
                      type="email"
                      value={formData.pastor_email}
                      onChange={(e) => setFormData({ ...formData, pastor_email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="state">Estado</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        maxLength={2}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input
                        id="neighborhood"
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="postal_code">CEP</Label>
                      <Input
                        id="postal_code"
                        value={formData.postal_code}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Cadastrar Cliente</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      
        <Card>
          <CardHeader>
            <CardTitle>Lista de Igrejas ({churches.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Igreja</TableHead>
                  <TableHead>Email do Pastor</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Etapa Atual</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {churches.map((church) => (
                  <TableRow key={church.id}>
                    <TableCell className="font-medium">{church.church_name}</TableCell>
                    <TableCell>{church.pastor_email}</TableCell>
                    <TableCell>{church.city}, {church.state}</TableCell>
                    <TableCell>
                      <Badge variant={getStageColor(church.current_stage || 1)}>
                        Etapa {church.current_stage || 1}/6
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedChurch(church);
                          setViewOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes do Cliente</DialogTitle>
            </DialogHeader>
            {selectedChurch && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Nome da Igreja</Label>
                  <p className="font-medium">{selectedChurch.church_name}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Email do Pastor</Label>
                  <p className="font-medium">{selectedChurch.pastor_email}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Endereço Completo</Label>
                  <p className="font-medium">
                    {selectedChurch.address && `${selectedChurch.address}, `}
                    {selectedChurch.neighborhood && `${selectedChurch.neighborhood}, `}
                    {selectedChurch.city}, {selectedChurch.state}
                    {selectedChurch.postal_code && ` - CEP: ${selectedChurch.postal_code}`}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Etapa Atual do Funil</Label>
                  <p className="font-medium">Etapa {selectedChurch.current_stage || 1} de 6</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
