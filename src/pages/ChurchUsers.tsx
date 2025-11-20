import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { UserPlus, Edit, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const createUserSchema = z.object({
  memberId: z.string().min(1, { message: 'Selecione um membro' }),
  password: z.string().min(6, { message: 'Senha deve ter no mínimo 6 caracteres' }).max(100),
  role: z.enum(['tesoureiro', 'secretario'], { message: 'Role inválida' }),
});

interface ChurchMember {
  id: string;
  nome_completo: string;
  whatsapp: string;
  email: string | null;
}

interface SystemUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'tesoureiro' | 'secretario';
  created_at: string;
}

export default function ChurchUsers() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [churchMembers, setChurchMembers] = useState<ChurchMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const [newUser, setNewUser] = useState({
    memberId: '',
    password: '',
    role: 'tesoureiro' as 'tesoureiro' | 'secretario',
  });
  const [newRole, setNewRole] = useState<'tesoureiro' | 'secretario'>('tesoureiro');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchChurchAndData();
  }, [user]);

  const fetchChurchAndData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: church } = await supabase
        .from('churches')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (church) {
        setChurchId(church.id);
        await Promise.all([
          fetchUsers(church.id),
          fetchChurchMembers(church.id)
        ]);
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (churchId: string) => {
    try {
      // Buscar todos os perfis da igreja
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Erro ao buscar profiles:', profilesError);
        throw profilesError;
      }

      if (!profiles || profiles.length === 0) {
        setUsers([]);
        return;
      }

      // Buscar as roles de todos os usuários de uma vez
      const profileIds = profiles.map(p => p.id);
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', profileIds)
        .in('role', ['tesoureiro', 'secretario']);

      if (rolesError) {
        console.error('Erro ao buscar roles:', rolesError);
        throw rolesError;
      }

      // Mapear roles por user_id
      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      // Combinar profiles com roles
      const usersWithRoles = profiles
        .filter(profile => rolesMap.has(profile.id))
        .map(profile => ({
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          role: rolesMap.get(profile.id) as 'tesoureiro' | 'secretario',
          created_at: profile.created_at,
        }));

      console.log('Usuários carregados:', usersWithRoles);
      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os usuários',
        variant: 'destructive',
      });
    }
  };

  const fetchChurchMembers = async (churchId: string) => {
    try {
      // Buscar todos os membros
      const { data: members } = await supabase
        .from('church_members')
        .select('id, nome_completo, whatsapp, email')
        .eq('church_id', churchId)
        .order('nome_completo');

      if (!members) {
        setChurchMembers([]);
        return;
      }

      // Buscar emails de usuários já cadastrados
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('email')
        .eq('church_id', churchId);

      const existingEmails = new Set(existingProfiles?.map(p => p.email) || []);

      // Filtrar membros que ainda não são usuários e que têm email
      const availableMembers = members.filter(member => {
        // Verificar se o membro tem email
        if (!member.email) return false;
        // Verificar se o email já está em uso
        return !existingEmails.has(member.email);
      });

      setChurchMembers(availableMembers);
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
    }
  };

  const validateCreateUser = () => {
    try {
      createUserSchema.parse(newUser);
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

  const createUser = async () => {
    if (!validateCreateUser() || !churchId) return;

    try {
      const selectedMember = churchMembers.find(m => m.id === newUser.memberId);
      if (!selectedMember) throw new Error('Membro não encontrado');

      // Validar se o membro tem email
      if (!selectedMember.email) {
        throw new Error('Este membro não possui email cadastrado. Atualize o cadastro do membro primeiro.');
      }

      const loginEmail = selectedMember.email;

      // Verificar se já existe um usuário com esse email
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', loginEmail)
        .single();

      if (existingProfile) {
        throw new Error('Este membro já está cadastrado como usuário do sistema');
      }

      // Criar usuário no Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: loginEmail,
        password: newUser.password,
        options: {
          data: {
            full_name: selectedMember.nome_completo,
          },
        },
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          throw new Error('Este membro já está cadastrado como usuário do sistema');
        }
        throw error;
      }

      if (data.user) {
        // Inserir perfil
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          email: loginEmail,
          full_name: selectedMember.nome_completo,
          church_id: churchId,
        });

        if (profileError) {
          console.error('Erro ao criar perfil:', profileError);
          throw new Error('Erro ao criar perfil: ' + profileError.message);
        }

        // Inserir role
        const { error: roleError } = await supabase.from('user_roles').insert({
          user_id: data.user.id,
          role: newUser.role,
        });

        if (roleError) {
          console.error('Erro ao criar role:', roleError);
          throw new Error('Erro ao criar permissão: ' + roleError.message);
        }

        toast({
          title: 'Sucesso',
          description: 'Usuário criado com sucesso',
        });

        setCreateDialogOpen(false);
        setNewUser({ memberId: '', password: '', role: 'tesoureiro' });
        setErrors({});
        setSearchTerm('');
        await fetchChurchAndData();
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível criar o usuário',
        variant: 'destructive',
      });
    }
  };

  const updateUserRole = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', selectedUser.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Permissão atualizada com sucesso',
      });

      setEditDialogOpen(false);
      setSelectedUser(null);
      fetchChurchAndData();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a permissão',
        variant: 'destructive',
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Não autenticado');
      }

      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Usuário removido com sucesso',
      });

      fetchChurchAndData();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível remover o usuário',
        variant: 'destructive',
      });
    }
  };

  const filteredMembers = churchMembers.filter(member =>
    member.nome_completo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!churchId) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Você precisa cadastrar uma igreja primeiro.
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
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
            <p className="text-muted-foreground mt-1">
              Adicione membros da igreja como usuários do sistema
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Selecione um membro e defina suas permissões
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="search">Buscar Membro</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Digite o nome..."
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="member">Membro</Label>
                  <Select
                    value={newUser.memberId}
                    onValueChange={(value) =>
                      setNewUser({ ...newUser, memberId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um membro" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredMembers.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          {searchTerm 
                            ? 'Nenhum membro encontrado' 
                            : 'Nenhum membro disponível. Cadastre membros com email ou verifique se já foram adicionados como usuários.'}
                        </div>
                      ) : (
                        filteredMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.nome_completo}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {errors.memberId && (
                    <p className="text-sm text-destructive mt-1">{errors.memberId}</p>
                  )}
                </div>
                {newUser.memberId && (
                  <div>
                    <Label htmlFor="loginEmail">Email para Login</Label>
                    <Input
                      id="loginEmail"
                      type="email"
                      value={churchMembers.find(m => m.id === newUser.memberId)?.email || ''}
                      readOnly
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Este email será usado para login no sistema
                    </p>
                  </div>
                )}
                <div>
                  <Label htmlFor="password">Senha Inicial</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    maxLength={100}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive mt-1">{errors.password}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="role">Nível de Permissão</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value: any) =>
                      setNewUser({ ...newUser, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tesoureiro">Tesoureiro</SelectItem>
                      <SelectItem value="secretario">Secretário(a)</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.role && (
                    <p className="text-sm text-destructive mt-1">{errors.role}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    <strong>Tesoureiro:</strong> Acesso a Entradas, Despesas, Membros e Dashboards<br />
                    <strong>Secretário(a):</strong> Acesso apenas a Membros e Dashboard
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setCreateDialogOpen(false);
                  setSearchTerm('');
                }}>
                  Cancelar
                </Button>
                <Button onClick={createUser}>Criar Usuário</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usuários do Sistema</CardTitle>
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
                    <TableHead>Permissão</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum usuário cadastrado ainda
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name || '-'}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {user.role === 'tesoureiro' ? 'Tesoureiro' : 'Secretário(a)'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog open={editDialogOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                              setEditDialogOpen(open);
                              if (!open) setSelectedUser(null);
                            }}>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setNewRole(user.role);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Editar Permissão</DialogTitle>
                                  <DialogDescription>
                                    Alterar o nível de permissão de {user.full_name || user.email}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label>Nível de Permissão</Label>
                                    <Select value={newRole} onValueChange={(value: any) => setNewRole(value)}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="tesoureiro">Tesoureiro</SelectItem>
                                        <SelectItem value="secretario">Secretário(a)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                                    Cancelar
                                  </Button>
                                  <Button onClick={updateUserRole}>Salvar</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

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
                                    Tem certeza que deseja remover {user.full_name || user.email}?
                                    Este usuário perderá o acesso ao sistema.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteUser(user.id)}>
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
    </div>
  );
}
