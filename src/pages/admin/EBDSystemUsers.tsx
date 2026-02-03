import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Pencil, Trash2, Loader2, Users, Shield, DollarSign, Store } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type UserProfile = "gerente_ebd" | "financeiro" | "vendedor";

interface SystemUser {
  id: string;
  email: string;
  fullName: string;
  role: UserProfile;
  createdAt: string;
  vendedorId?: string;
}

interface FormData {
  nome: string;
  email: string;
  senha: string;
  tipoPerfil: UserProfile;
}

const roleLabels: Record<UserProfile, string> = {
  gerente_ebd: "Gerente EBD",
  financeiro: "Financeiro",
  vendedor: "Vendedor",
};

const roleColors: Record<UserProfile, string> = {
  gerente_ebd: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  financeiro: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  vendedor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

const roleIcons: Record<UserProfile, React.ReactNode> = {
  gerente_ebd: <Shield className="h-3 w-3" />,
  financeiro: <DollarSign className="h-3 w-3" />,
  vendedor: <Store className="h-3 w-3" />,
};

export default function EBDSystemUsers() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    nome: "",
    email: "",
    senha: "",
    tipoPerfil: "vendedor",
  });

  // Fetch system users (gerentes, financeiros from user_roles + vendedores)
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["ebd-system-users"],
    queryFn: async () => {
      const systemUsers: SystemUser[] = [];

      // Fetch gerentes and financeiros from user_roles + profiles
      const { data: roleUsers, error: roleError } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          role,
          created_at,
          profiles:user_id (
            email,
            full_name
          )
        `)
        .in("role", ["gerente_ebd", "financeiro"]);

      if (roleError) {
        console.error("Error fetching role users:", roleError);
      } else {
        roleUsers?.forEach((ru: any) => {
          if (ru.profiles) {
            systemUsers.push({
              id: ru.user_id,
              email: ru.profiles.email || "",
              fullName: ru.profiles.full_name || ru.profiles.email || "",
              role: ru.role as UserProfile,
              createdAt: ru.created_at,
            });
          }
        });
      }

      // Fetch vendedores
      const { data: vendedores, error: vendedoresError } = await supabase
        .from("vendedores")
        .select("id, email, nome, created_at, status")
        .eq("status", "Ativo")
        .order("created_at", { ascending: false });

      if (vendedoresError) {
        console.error("Error fetching vendedores:", vendedoresError);
      } else {
        vendedores?.forEach((v) => {
          systemUsers.push({
            id: v.id,
            email: v.email,
            fullName: v.nome,
            role: "vendedor",
            createdAt: v.created_at,
            vendedorId: v.id,
          });
        });
      }

      // Sort by creation date
      return systemUsers.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (data.tipoPerfil === "vendedor") {
        const { data: result, error } = await supabase.functions.invoke("create-vendedor", {
          body: {
            email: data.email,
            password: data.senha,
            nome: data.nome,
            tipo_perfil: "vendedor",
          },
        });

        if (error) throw new Error(error.message);
        if (result?.error) throw new Error(result.error);
        return result;
      } else {
        const { data: result, error } = await supabase.functions.invoke("create-admin-user", {
          body: {
            email: data.email,
            password: data.senha,
            fullName: data.nome,
            role: data.tipoPerfil,
          },
        });

        if (error) throw new Error(error.message);
        if (result?.error) throw new Error(result.error);
        return result;
      }
    },
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ebd-system-users"] });
      setCreateDialogOpen(false);
      setFormData({ nome: "", email: "", senha: "", tipoPerfil: "vendedor" });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar usuário: ${error.message}`);
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (user: SystemUser) => {
      if (user.role === "vendedor" && user.vendedorId) {
        // Deactivate vendedor instead of deleting
        const { error } = await supabase
          .from("vendedores")
          .update({ status: "Inativo" })
          .eq("id", user.vendedorId);

        if (error) throw error;
      } else {
        // Delete user role for gerente/financeiro
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", user.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Usuário removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ebd-system-users"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover usuário: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.email || !formData.senha) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (formData.senha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    createMutation.mutate(formData);
  };

  const countByRole = (role: UserProfile) => users.filter((u) => u.role === role).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários do Sistema</h1>
          <p className="text-muted-foreground">
            Gerencie os usuários com acesso ao sistema EBD
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Preencha os dados para criar um novo usuário do sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input
                    id="nome"
                    placeholder="Nome do usuário"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha *</Label>
                  <Input
                    id="senha"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipoPerfil">Tipo de Perfil *</Label>
                  <Select
                    value={formData.tipoPerfil}
                    onValueChange={(v) => setFormData({ ...formData, tipoPerfil: v as UserProfile })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gerente_ebd">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-purple-600" />
                          <span>Gerente EBD - Acesso total ao Admin EBD</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="financeiro">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span>Financeiro - Aprovações e comissões</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="vendedor">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-blue-600" />
                          <span>Vendedor - Portal de vendas</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Criar Usuário
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gerentes EBD</CardTitle>
            <Shield className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countByRole("gerente_ebd")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Financeiros</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countByRole("financeiro")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendedores</CardTitle>
            <Store className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countByRole("vendedor")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>
            Todos os usuários com acesso ao sistema EBD
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário cadastrado ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={`${user.role}-${user.id}`}>
                    <TableCell className="font-medium">{user.fullName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`${roleColors[user.role]} flex items-center gap-1 w-fit`}
                      >
                        {roleIcons[user.role]}
                        {roleLabels[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {user.role === "vendedor"
                                ? "O vendedor será desativado e perderá acesso ao sistema."
                                : "O usuário perderá acesso às funcionalidades do sistema."}
                              Esta ação pode ser revertida por um administrador.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(user)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deleteMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Remover"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
