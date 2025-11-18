import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { UserPlus, Trash2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';
import { PermissionsDialog } from '@/components/church-members/PermissionsDialog';

const createMemberSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido' }).max(255),
  password: z.string().min(6, { message: 'Senha deve ter no mínimo 6 caracteres' }).max(100),
  fullName: z.string().trim().min(1, { message: 'Nome completo obrigatório' }).max(200),
});

interface Member {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export default function ChurchMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const [newMember, setNewMember] = useState({
    email: '',
    password: '',
    fullName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchChurchAndMembers();
  }, [user]);

  const fetchChurchAndMembers = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Buscar a igreja do usuário logado
      const { data: church } = await supabase
        .from('churches')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (church) {
        setChurchId(church.id);

        // Buscar membros da igreja
        const { data: membersData } = await supabase
          .from('profiles')
          .select('*')
          .eq('church_id', church.id)
          .order('created_at', { ascending: false });

        setMembers(membersData || []);
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os membros',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const validateMember = () => {
    try {
      createMemberSchema.parse(newMember);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const createMember = async () => {
    if (!validateMember() || !churchId) return;

    try {
      // Criar usuário no Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: newMember.email.trim(),
        password: newMember.password,
        options: {
          data: {
            full_name: newMember.fullName.trim(),
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Criar perfil vinculado à igreja
        await supabase.from('profiles').insert({
          id: data.user.id,
          email: newMember.email.trim(),
          full_name: newMember.fullName.trim(),
          church_id: churchId,
        });

        // Criar role de cliente para o novo membro
        await supabase.from('user_roles').insert({
          user_id: data.user.id,
          role: 'client',
        });

        toast({
          title: 'Sucesso',
          description: 'Membro adicionado com sucesso',
        });

        setCreateDialogOpen(false);
        setNewMember({ email: '', password: '', fullName: '' });
        setErrors({});
        fetchChurchAndMembers();
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível adicionar o membro',
        variant: 'destructive',
      });
    }
  };

  const deleteMember = async (memberId: string) => {
    try {
      // Deletar role
      await supabase.from('user_roles').delete().eq('user_id', memberId);
      
      // Deletar perfil
      await supabase.from('profiles').delete().eq('id', memberId);

      toast({
        title: 'Sucesso',
        description: 'Membro removido com sucesso',
      });

      fetchChurchAndMembers();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o membro',
        variant: 'destructive',
      });
    }
  };

  const handleManagePermissions = (member: Member) => {
    setSelectedMember(member);
    setPermissionsDialogOpen(true);
  };

  if (!churchId) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Você precisa cadastrar uma igreja primeiro para gerenciar membros.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Membros da Igreja</h1>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar Membro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Membro</DialogTitle>
                <DialogDescription>
                  Preencha os dados do novo membro da igreja
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    value={newMember.fullName}
                    onChange={(e) => setNewMember({ ...newMember, fullName: e.target.value })}
                    placeholder="Nome completo"
                    maxLength={200}
                  />
                  {errors.fullName && (
                    <p className="text-sm text-destructive mt-1">{errors.fullName}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    placeholder="email@exemplo.com"
                    maxLength={255}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive mt-1">{errors.email}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="password">Senha Inicial</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newMember.password}
                    onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    maxLength={100}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive mt-1">{errors.password}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    O membro poderá alterar a senha após o primeiro login
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={createMember}>Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Membros Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Data de Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum membro cadastrado ainda
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.full_name || '-'}
                        </TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          {new Date(member.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleManagePermissions(member)}
                              title="Gerenciar Permissões"
                            >
                              <Shield className="h-4 w-4 mr-1" />
                              Permissões
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja remover {member.full_name || member.email}?
                                    Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMember(member.id)}>
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedMember && churchId && (
        <PermissionsDialog
          open={permissionsDialogOpen}
          onOpenChange={setPermissionsDialogOpen}
          memberId={selectedMember.id}
          memberName={selectedMember.full_name || selectedMember.email}
          churchId={churchId}
        />
      )}
    </div>
  );
}
