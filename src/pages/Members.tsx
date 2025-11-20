import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MemberCard } from '@/components/financial/MemberCard';
import { MemberDialog } from '@/components/financial/MemberDialog';
import { Member } from '@/types/financial';
import { Plus, Search, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useChurchData } from '@/hooks/useChurchData';

const Members = () => {
  const { toast } = useToast();
  const { churchId, loading: churchLoading } = useChurchData();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | undefined>();

  // Fetch members from database
  useEffect(() => {
    const fetchMembers = async () => {
      if (!churchId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('church_members')
          .select('*')
          .eq('church_id', churchId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          const formattedMembers: Member[] = data.map(m => ({
            id: m.id,
            nomeCompleto: m.nome_completo,
            cep: m.cep || '',
            rua: m.rua || '',
            numero: m.numero || '',
            complemento: m.complemento || '',
            bairro: m.bairro || '',
            cidade: m.cidade || '',
            estado: m.estado || '',
            dataAniversario: m.data_aniversario,
            sexo: m.sexo as 'Masculino' | 'Feminino',
            whatsapp: m.whatsapp,
            cargo: m.cargo,
            createdAt: m.created_at,
          }));
          setMembers(formattedMembers);
        }
      } catch (error) {
        console.error('Error fetching members:', error);
        toast({
          title: 'Erro ao carregar membros',
          description: 'Não foi possível carregar a lista de membros.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    if (!churchLoading) {
      fetchMembers();
    }
  }, [churchId, churchLoading, toast]);

  const filteredMembers = members.filter((member) =>
    member.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async (memberData: Omit<Member, 'id' | 'createdAt'>) => {
    if (!churchId) {
      toast({
        title: 'Erro',
        description: 'Igreja não encontrada. Faça login novamente.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingMember) {
        // Update existing member
        const { error } = await supabase
          .from('church_members')
          .update({
            nome_completo: memberData.nomeCompleto,
            cep: memberData.cep || '',
            rua: memberData.rua || '',
            numero: memberData.numero,
            complemento: memberData.complemento || '',
            bairro: memberData.bairro || '',
            cidade: memberData.cidade || '',
            estado: memberData.estado || '',
            data_aniversario: memberData.dataAniversario,
            sexo: memberData.sexo,
            whatsapp: memberData.whatsapp,
            cargo: memberData.cargo,
          })
          .eq('id', editingMember.id);

        if (error) throw error;

        setMembers((prev) =>
          prev.map((m) =>
            m.id === editingMember.id ? { ...memberData, id: m.id, createdAt: m.createdAt } : m
          )
        );
        toast({
          title: 'Membro atualizado!',
          description: 'Os dados do membro foram atualizados com sucesso.',
        });
      } else {
        // Insert new member
        const { data, error } = await supabase
          .from('church_members')
          .insert({
            church_id: churchId,
            nome_completo: memberData.nomeCompleto,
            cep: memberData.cep || '',
            rua: memberData.rua || '',
            numero: memberData.numero,
            complemento: memberData.complemento || '',
            bairro: memberData.bairro || '',
            cidade: memberData.cidade || '',
            estado: memberData.estado || '',
            data_aniversario: memberData.dataAniversario,
            sexo: memberData.sexo,
            whatsapp: memberData.whatsapp,
            cargo: memberData.cargo,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const newMember: Member = {
            id: data.id,
            nomeCompleto: data.nome_completo,
            cep: data.cep || '',
            rua: data.rua || '',
            numero: data.numero || '',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            cidade: data.cidade || '',
            estado: data.estado || '',
            dataAniversario: data.data_aniversario,
            sexo: data.sexo as 'Masculino' | 'Feminino',
            whatsapp: data.whatsapp,
            cargo: data.cargo,
            createdAt: data.created_at,
          };
          setMembers((prev) => [newMember, ...prev]);
        }

        toast({
          title: 'Membro cadastrado!',
          description: 'O novo membro foi adicionado com sucesso.',
        });
      }
      setEditingMember(undefined);
    } catch (error) {
      console.error('Error saving member:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o membro. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setDialogOpen(true);
  };

  const handleDelete = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('church_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast({
        title: 'Membro removido',
        description: 'O membro foi removido do cadastro.',
      });
    } catch (error) {
      console.error('Error deleting member:', error);
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível remover o membro. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleNewMember = () => {
    setEditingMember(undefined);
    setDialogOpen(true);
  };

  if (churchLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Carregando membros...</p>
        </div>
      </div>
    );
  }

  if (!churchId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Você precisa estar associado a uma igreja para gerenciar membros.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary text-primary-foreground">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Cadastro de Membros</h1>
              <p className="text-muted-foreground">Gerencie os membros da sua igreja</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar membro por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleNewMember} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Membro
            </Button>
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum membro encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? 'Nenhum membro corresponde à sua busca.'
                : 'Comece adicionando o primeiro membro da sua igreja.'}
            </p>
            {!searchTerm && (
              <Button onClick={handleNewMember} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Primeiro Membro
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onEdit={() => handleEdit(member)}
                onDelete={() => handleDelete(member.id)}
              />
            ))}
          </div>
        )}

        <MemberDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          member={editingMember}
          onSave={handleSave}
        />
      </div>
    </div>
  );
};

export default Members;
