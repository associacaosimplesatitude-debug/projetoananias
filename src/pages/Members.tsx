import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MemberCard } from '@/components/financial/MemberCard';
import { MemberDialog } from '@/components/financial/MemberDialog';
import { Member } from '@/types/financial';
import { Plus, Search, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Members = () => {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | undefined>();

  const filteredMembers = members.filter((member) =>
    member.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = (memberData: Omit<Member, 'id' | 'createdAt'>) => {
    if (editingMember) {
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
      const newMember: Member = {
        ...memberData,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
      };
      setMembers((prev) => [...prev, newMember]);
      toast({
        title: 'Membro cadastrado!',
        description: 'O novo membro foi adicionado com sucesso.',
      });
    }
    setEditingMember(undefined);
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setDialogOpen(true);
  };

  const handleDelete = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast({
      title: 'Membro removido',
      description: 'O membro foi removido do cadastro.',
    });
  };

  const handleNewMember = () => {
    setEditingMember(undefined);
    setDialogOpen(true);
  };

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
