import { Member } from '@/types/financial';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Phone, MapPin, Calendar, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MemberCardProps {
  member: Member;
  onEdit: () => void;
  onDelete: () => void;
}

export const MemberCard = ({ member, onEdit, onDelete }: MemberCardProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  };

  const formatAddress = () => {
    const parts = [];
    if (member.rua) parts.push(member.rua);
    if (member.numero) parts.push(member.numero);
    if (member.complemento) parts.push(member.complemento);
    if (member.bairro) parts.push(member.bairro);
    if (member.cidade) parts.push(member.cidade);
    if (member.estado) parts.push(member.estado);
    return parts.length > 0 ? parts.join(', ') : 'Endereço não informado';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{member.nomeCompleto}</h3>
              <Badge variant="secondary" className="mt-1">
                {member.cargo}
              </Badge>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{member.whatsapp}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{formatAddress()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>Aniversário: {formatDate(member.dataAniversario)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
