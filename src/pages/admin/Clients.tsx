import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const churchSchema = z.object({
  church_name: z.string().trim().min(1, 'Nome da igreja é obrigatório').max(200),
  pastor_email: z.string().trim().email('Email inválido').max(255),
  pastor_name: z.string().trim().min(1, 'Nome do pastor é obrigatório').max(200),
  pastor_password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(100),
  pastor_rg: z.string().trim().min(1, 'RG é obrigatório').max(20),
  pastor_cpf: z.string().trim().min(11, 'CPF inválido').max(14),
  pastor_whatsapp: z.string().trim().min(10, 'WhatsApp inválido').max(20),
  cnpj: z.string().trim().max(18).optional(),
  city: z.string().trim().min(1, 'Cidade é obrigatória').max(100),
  state: z.string().trim().length(2, 'Estado deve ter 2 caracteres'),
  address: z.string().trim().max(200).optional(),
  neighborhood: z.string().trim().max(100).optional(),
  postal_code: z.string().trim().max(10).optional(),
  monthly_fee: z.number().positive().default(199.90),
  payment_due_day: z.number().int().min(5).max(30),
});

interface Church {
  id: string;
  church_name: string;
  pastor_email: string;
  pastor_name?: string;
  pastor_rg?: string;
  pastor_cpf?: string;
  pastor_whatsapp?: string;
  cnpj?: string;
  current_stage: number;
  city: string;
  state: string;
  address: string;
  neighborhood: string;
  postal_code: string;
  monthly_fee?: number;
  payment_due_day?: number;
}

export default function AdminClients() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedChurch, setSelectedChurch] = useState<Church | null>(null);
  const [formData, setFormData] = useState({
    church_name: '',
    pastor_email: '',
    pastor_name: '',
    pastor_password: '',
    pastor_rg: '',
    pastor_cpf: '',
    pastor_whatsapp: '',
    cnpj: '',
    city: '',
    state: '',
    address: '',
    neighborhood: '',
    postal_code: '',
    monthly_fee: 199.90,
    payment_due_day: 5,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
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

    // Validar dados
    try {
      churchSchema.parse(formData);
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    try {
      // Verificar se já existe um usuário com esse email
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formData.pastor_email.trim())
        .single();

      if (existingProfile) {
        toast({
          title: 'Erro',
          description: 'Este email já está cadastrado no sistema. Use um email diferente.',
          variant: 'destructive',
        });
        return;
      }

      // Criar cliente usando edge function (mantém sessão do admin)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      const { data, error: createError } = await supabase.functions.invoke('create-client', {
        body: {
          churchData: formData,
          password: formData.pastor_password,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (createError) {
        if (createError.message?.includes('already registered')) {
          toast({
            title: 'Erro',
            description: 'Este email já está cadastrado no sistema.',
            variant: 'destructive',
          });
          return;
        }
        throw createError;
      }

      // Enviar email com dados de acesso
      const loginUrl = `${window.location.origin}/auth`;
      
      await supabase.functions.invoke('send-welcome-email', {
        body: {
          pastorName: formData.pastor_name || 'Pastor(a)',
          pastorEmail: formData.pastor_email,
          churchName: formData.church_name,
          password: formData.pastor_password,
          loginUrl: loginUrl,
        },
      });

      toast({
        title: 'Sucesso',
        description: 'Cliente cadastrado e email enviado com os dados de acesso',
      });

      setOpen(false);
      setFormData({
        church_name: '',
        pastor_email: '',
        pastor_name: '',
        pastor_password: '',
        pastor_rg: '',
        pastor_cpf: '',
        pastor_whatsapp: '',
        cnpj: '',
        city: '',
        state: '',
        address: '',
        neighborhood: '',
        postal_code: '',
        monthly_fee: 199.90,
        payment_due_day: 5,
      });
      setErrors({});
      fetchChurches();
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível cadastrar o cliente',
        variant: 'destructive',
      });
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
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="grid gap-2">
                    <Label htmlFor="church_name">Nome da Igreja</Label>
                    <Input
                      id="church_name"
                      value={formData.church_name}
                      onChange={(e) => setFormData({ ...formData, church_name: e.target.value })}
                      required
                    />
                    {errors.church_name && (
                      <p className="text-sm text-destructive">{errors.church_name}</p>
                    )}
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="pastor_name">Nome do Pastor</Label>
                    <Input
                      id="pastor_name"
                      value={formData.pastor_name}
                      onChange={(e) => setFormData({ ...formData, pastor_name: e.target.value })}
                      required
                    />
                    {errors.pastor_name && (
                      <p className="text-sm text-destructive">{errors.pastor_name}</p>
                    )}
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
                    {errors.pastor_email && (
                      <p className="text-sm text-destructive">{errors.pastor_email}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="pastor_password">Senha de Acesso</Label>
                    <Input
                      id="pastor_password"
                      type="password"
                      value={formData.pastor_password}
                      onChange={(e) => setFormData({ ...formData, pastor_password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      required
                    />
                    {errors.pastor_password && (
                      <p className="text-sm text-destructive">{errors.pastor_password}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="pastor_rg">RG</Label>
                      <Input
                        id="pastor_rg"
                        value={formData.pastor_rg}
                        onChange={(e) => setFormData({ ...formData, pastor_rg: e.target.value })}
                        placeholder="00.000.000-0"
                        required
                      />
                      {errors.pastor_rg && (
                        <p className="text-sm text-destructive">{errors.pastor_rg}</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pastor_cpf">CPF</Label>
                      <Input
                        id="pastor_cpf"
                        value={formData.pastor_cpf}
                        onChange={(e) => setFormData({ ...formData, pastor_cpf: e.target.value })}
                        placeholder="000.000.000-00"
                        maxLength={14}
                        required
                      />
                      {errors.pastor_cpf && (
                        <p className="text-sm text-destructive">{errors.pastor_cpf}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="pastor_whatsapp">WhatsApp</Label>
                    <Input
                      id="pastor_whatsapp"
                      value={formData.pastor_whatsapp}
                      onChange={(e) => setFormData({ ...formData, pastor_whatsapp: e.target.value })}
                      placeholder="(00) 00000-0000"
                      maxLength={20}
                      required
                    />
                    {errors.pastor_whatsapp && (
                      <p className="text-sm text-destructive">{errors.pastor_whatsapp}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                    {errors.cnpj && (
                      <p className="text-sm text-destructive">{errors.cnpj}</p>
                    )}
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

                  <div className="border-t pt-4 mt-2">
                    <h3 className="font-medium mb-4">Informações de Pagamento</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="monthly_fee">Valor Mensal</Label>
                        <Input
                          id="monthly_fee"
                          type="number"
                          step="0.01"
                          value={formData.monthly_fee}
                          onChange={(e) => setFormData({ ...formData, monthly_fee: parseFloat(e.target.value) })}
                          required
                        />
                        {errors.monthly_fee && (
                          <p className="text-sm text-destructive">{errors.monthly_fee}</p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="payment_due_day">Dia de Vencimento</Label>
                        <Select
                          value={formData.payment_due_day.toString()}
                          onValueChange={(value) => setFormData({ ...formData, payment_due_day: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o dia" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">Dia 05</SelectItem>
                            <SelectItem value="10">Dia 10</SelectItem>
                            <SelectItem value="15">Dia 15</SelectItem>
                            <SelectItem value="20">Dia 20</SelectItem>
                            <SelectItem value="25">Dia 25</SelectItem>
                            <SelectItem value="30">Dia 30</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.payment_due_day && (
                          <p className="text-sm text-destructive">{errors.payment_due_day}</p>
                        )}
                      </div>
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
