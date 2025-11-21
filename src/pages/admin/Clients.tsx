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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Eye, Calendar, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';
import { Link } from 'react-router-dom';

const churchSchema = z.object({
  church_name: z.string().trim().min(1, 'Nome é obrigatório').max(200),
  pastor_email: z.string().trim().email('Email inválido').max(255),
  pastor_name: z.string().trim().min(1, 'Nome é obrigatório').max(200),
  pastor_password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(100),
  pastor_rg: z.string().trim().min(1, 'RG é obrigatório').max(20),
  pastor_cpf: z.string().trim().min(11, 'CPF inválido').max(14),
  pastor_whatsapp: z.string().trim().min(10, 'WhatsApp inválido').max(20),
  has_cnpj: z.boolean(),
  cnpj: z.string().trim().max(18).optional(),
  city: z.string().trim().min(1, 'Cidade é obrigatória').max(100),
  state: z.string().trim().length(2, 'Estado deve ter 2 caracteres'),
  address: z.string().trim().max(200).optional(),
  neighborhood: z.string().trim().max(100).optional(),
  postal_code: z.string().trim().max(10).optional(),
  monthly_fee: z.number().positive().default(199.90),
  payment_due_day: z.number().int().min(5).max(30),
  client_type: z.enum(['igreja', 'associacao']).default('igreja'),
}).refine((data) => {
  if (data.has_cnpj && !data.cnpj) {
    return false;
  }
  return true;
}, {
  message: "CNPJ é obrigatório quando a organização já possui CNPJ",
  path: ["cnpj"],
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
  process_status?: string;
  client_type?: 'igreja' | 'associacao';
}

export default function AdminClients() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [selectedChurch, setSelectedChurch] = useState<Church | null>(null);
  const [mandateData, setMandateData] = useState({
    start_date: '',
    end_date: '',
    notes: '',
  });
  const [formData, setFormData] = useState({
    church_name: '',
    pastor_email: '',
    pastor_name: '',
    pastor_password: '',
    pastor_rg: '',
    pastor_cpf: '',
    pastor_whatsapp: '',
    has_cnpj: false,
    cnpj: '',
    city: '',
    state: '',
    address: '',
    neighborhood: '',
    postal_code: '',
    monthly_fee: 199.90,
    payment_due_day: 5,
    client_type: 'igreja' as 'igreja' | 'associacao',
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
    
    setChurches((data || []) as Church[]);
  };

  const loadMandateData = async (churchId: string) => {
    try {
      const { data } = await supabase
        .from('board_mandates')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setMandateData({
          start_date: data.start_date,
          end_date: data.end_date,
          notes: data.notes || '',
        });
      } else {
        setMandateData({
          start_date: '',
          end_date: '',
          notes: '',
        });
      }
    } catch (error) {
      console.error('Error loading mandate:', error);
    }
  };

  const handleMandateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedChurch) return;

    try {
      // Check if mandate already exists
      const { data: existingMandate } = await supabase
        .from('board_mandates')
        .select('id')
        .eq('church_id', selectedChurch.id)
        .maybeSingle();

      if (existingMandate) {
        // Update existing mandate
        const { error } = await supabase
          .from('board_mandates')
          .update({
            start_date: mandateData.start_date,
            end_date: mandateData.end_date,
            notes: mandateData.notes,
          })
          .eq('id', existingMandate.id);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Mandato atualizado com sucesso',
        });
      } else {
        // Create new mandate
        const { error } = await supabase
          .from('board_mandates')
          .insert({
            church_id: selectedChurch.id,
            start_date: mandateData.start_date,
            end_date: mandateData.end_date,
            notes: mandateData.notes,
          });

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Mandato cadastrado com sucesso',
        });
      }

      setMandateOpen(false);
      setMandateData({ start_date: '', end_date: '', notes: '' });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar o mandato',
        variant: 'destructive',
      });
    }
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
        has_cnpj: false,
        cnpj: '',
        city: '',
        state: '',
        address: '',
        neighborhood: '',
        postal_code: '',
        monthly_fee: 199.90,
        payment_due_day: 5,
        client_type: 'igreja' as 'igreja' | 'associacao',
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
                  <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do novo cliente para iniciar o funil
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="grid gap-2">
                    <Label htmlFor="client_type">Tipo de Cliente *</Label>
                    <Select
                      value={formData.client_type}
                      onValueChange={(value: 'igreja' | 'associacao') => setFormData({ ...formData, client_type: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="igreja">Igreja</SelectItem>
                        <SelectItem value="associacao">Associação</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.client_type && (
                      <p className="text-sm text-destructive">{errors.client_type}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="church_name">Nome</Label>
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
                    <Label htmlFor="pastor_name">Nome do Responsável</Label>
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
                    <Label htmlFor="pastor_email">Email</Label>
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
                    <Label>{formData.client_type === 'igreja' ? 'A igreja já possui CNPJ?' : 'A associação já possui CNPJ?'}</Label>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="has_cnpj_yes"
                          name="has_cnpj"
                          checked={formData.has_cnpj === true}
                          onChange={() => setFormData({ ...formData, has_cnpj: true })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="has_cnpj_yes" className="font-normal cursor-pointer">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="has_cnpj_no"
                          name="has_cnpj"
                          checked={formData.has_cnpj === false}
                          onChange={() => setFormData({ ...formData, has_cnpj: false, cnpj: '' })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="has_cnpj_no" className="font-normal cursor-pointer">Não</Label>
                      </div>
                    </div>
                  </div>

                  {formData.has_cnpj && (
                    <div className="grid gap-2">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        value={formData.cnpj}
                        onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                        required={formData.has_cnpj}
                      />
                      {errors.cnpj && (
                        <p className="text-sm text-destructive">{errors.cnpj}</p>
                      )}
                    </div>
                  )}
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
            <CardTitle>Lista de Clientes ({churches.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Etapa Atual</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {churches.map((church) => (
                  <TableRow key={church.id}>
                    <TableCell className="font-medium">
                      <Link 
                        to={`/admin/client-view/${church.id}`}
                        className="text-primary hover:underline"
                      >
                        {church.church_name}
                      </Link>
                    </TableCell>
                    <TableCell>{church.pastor_email}</TableCell>
                    <TableCell>
                      <Badge variant={church.client_type === 'igreja' ? 'default' : 'secondary'}>
                        {church.client_type === 'igreja' ? 'Igreja' : 'Associação'}
                      </Badge>
                    </TableCell>
                    <TableCell>{church.city}, {church.state}</TableCell>
                    <TableCell>{church.cnpj || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5, 6].map((stage) => {
                          const isCompleted = church.process_status === 'completed' || (church.current_stage || 1) >= stage;
                          return (
                            <div
                              key={stage}
                              className={`w-7 h-7 flex items-center justify-center text-xs font-semibold rounded border ${
                                isCompleted
                                  ? 'bg-green-500 text-white border-green-600'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              {stage}
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedChurch(church);
                            setViewOpen(true);
                          }}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={async () => {
                            setSelectedChurch(church);
                            await loadMandateData(church.id);
                            setMandateOpen(true);
                          }}
                          title="Cadastrar Mandato"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => window.location.href = `/admin/clients/${church.id}`}
                          title="Gerenciar Cliente"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
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
                  <Label className="text-sm text-muted-foreground">CNPJ</Label>
                  <p className="font-medium">{selectedChurch.cnpj || 'Não informado'}</p>
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

        <Dialog open={mandateOpen} onOpenChange={setMandateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Mandato da Diretoria</DialogTitle>
              <DialogDescription>
                {selectedChurch?.church_name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleMandateSubmit} className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data de Início do Mandato</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={mandateData.start_date}
                    onChange={(e) => setMandateData({ ...mandateData, start_date: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="end_date">Data de Término do Mandato</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={mandateData.end_date}
                    onChange={(e) => setMandateData({ ...mandateData, end_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações (opcional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Adicione observações sobre o mandato..."
                    value={mandateData.notes}
                    onChange={(e) => setMandateData({ ...mandateData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setMandateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Salvar Mandato
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
