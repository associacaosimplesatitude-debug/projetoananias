import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type ChurchPermission = Database['public']['Enums']['church_permission'];

interface Permission {
  id: string;
  label: string;
  description: string;
}

const AVAILABLE_PERMISSIONS: Array<Permission & { id: ChurchPermission }> = [
  {
    id: 'view_financial' as const,
    label: 'Visualizar Financeiro',
    description: 'Pode visualizar relatórios e dados financeiros',
  },
  {
    id: 'edit_financial' as const,
    label: 'Editar Financeiro',
    description: 'Pode adicionar e editar entradas e saídas financeiras',
  },
  {
    id: 'approve_expenses' as const,
    label: 'Aprovar Despesas',
    description: 'Pode aprovar e rejeitar despesas pendentes',
  },
  {
    id: 'manage_members' as const,
    label: 'Gerenciar Membros',
    description: 'Pode adicionar, editar e remover membros',
  },
  {
    id: 'view_reports' as const,
    label: 'Visualizar Relatórios',
    description: 'Pode acessar relatórios gerenciais',
  },
  {
    id: 'edit_church_info' as const,
    label: 'Editar Informações da Igreja',
    description: 'Pode atualizar dados cadastrais da igreja',
  },
];

interface PermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  churchId: string;
}

export function PermissionsDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  churchId,
}: PermissionsDialogProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<Set<ChurchPermission>>(new Set());
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadMemberPermissions();
    }
  }, [open, memberId]);

  const loadMemberPermissions = async () => {
    setInitialLoading(true);
    try {
      const { data } = await supabase
        .from('church_member_permissions')
        .select('permission')
        .eq('user_id', memberId)
        .eq('church_id', churchId);

      if (data) {
        setSelectedPermissions(new Set(data.map((p) => p.permission)));
      }
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleTogglePermission = (permissionId: ChurchPermission) => {
    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Remover todas as permissões existentes do membro
      await supabase
        .from('church_member_permissions')
        .delete()
        .eq('user_id', memberId)
        .eq('church_id', churchId);

      // Adicionar as novas permissões selecionadas
      if (selectedPermissions.size > 0) {
        const permissionsToInsert = Array.from(selectedPermissions).map((permission) => ({
          user_id: memberId,
          church_id: churchId,
          permission,
        }));

        const { error } = await supabase
          .from('church_member_permissions')
          .insert(permissionsToInsert);

        if (error) throw error;
      }

      toast({
        title: 'Permissões atualizadas',
        description: `As permissões de ${memberName} foram atualizadas com sucesso`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar as permissões',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Gerenciar Permissões</DialogTitle>
          <DialogDescription>
            Defina as permissões de acesso para {memberName}
          </DialogDescription>
        </DialogHeader>

        {initialLoading ? (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {AVAILABLE_PERMISSIONS.map((permission) => (
              <div key={permission.id} className="flex items-start space-x-3">
                <Checkbox
                  id={permission.id}
                  checked={selectedPermissions.has(permission.id)}
                  onCheckedChange={() => handleTogglePermission(permission.id)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor={permission.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {permission.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {permission.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || initialLoading}>
            {loading ? 'Salvando...' : 'Salvar Permissões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
