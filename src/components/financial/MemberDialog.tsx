import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Member, MemberCargo, Gender } from '@/types/financial';

const defaultCargos: MemberCargo[] = [
  'Membro',
  'Obreiro',
  'Obreira',
  'Diácono',
  'Presbítero',
  'Diaconisa',
  'Pastor',
];

interface MemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: Member;
  onSave: (member: Omit<Member, 'id' | 'createdAt'>) => void;
}

export const MemberDialog = ({ open, onOpenChange, member, onSave }: MemberDialogProps) => {
  const [formData, setFormData] = useState({
    nomeCompleto: '',
    endereco: '',
    dataAniversario: '',
    sexo: '' as Gender,
    whatsapp: '',
    cargo: '' as string,
  });

  useEffect(() => {
    if (member) {
      setFormData({
        nomeCompleto: member.nomeCompleto,
        endereco: member.endereco,
        dataAniversario: member.dataAniversario,
        sexo: member.sexo,
        whatsapp: member.whatsapp,
        cargo: member.cargo,
      });
    } else {
      setFormData({
        nomeCompleto: '',
        endereco: '',
        dataAniversario: '',
        sexo: '' as Gender,
        whatsapp: '',
        cargo: '',
      });
    }
  }, [member, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{member ? 'Editar Membro' : 'Novo Membro'}</DialogTitle>
            <DialogDescription>
              Preencha os dados do membro da igreja
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={formData.nomeCompleto}
                onChange={(e) => setFormData({ ...formData, nomeCompleto: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="endereco">Endereço *</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="aniversario">Data de Aniversário *</Label>
                <Input
                  id="aniversario"
                  type="date"
                  value={formData.dataAniversario}
                  onChange={(e) => setFormData({ ...formData, dataAniversario: e.target.value })}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sexo">Sexo *</Label>
                <Select
                  value={formData.sexo}
                  onValueChange={(value) => setFormData({ ...formData, sexo: value as Gender })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="whatsapp">WhatsApp *</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="(11) 99999-9999"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cargo">Cargo *</Label>
                <Select
                  value={formData.cargo}
                  onValueChange={(value) => setFormData({ ...formData, cargo: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {defaultCargos.map((cargo) => (
                      <SelectItem key={cargo} value={cargo}>
                        {cargo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
