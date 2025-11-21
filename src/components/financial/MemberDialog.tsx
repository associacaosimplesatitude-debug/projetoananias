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
import { useClientType } from '@/hooks/useClientType';

const defaultCargos: MemberCargo[] = [
  'Membro',
  'Obreiro',
  'Obreira',
  'Diácono',
  'Presbítero',
  'Diaconisa',
  'Pastor',
  'Pastora',
  'Evangelista',
  'Missionário',
  'Missionária',
  'Apóstolo',
  'Bispo',
  'Bispa',
];

interface MemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: Member;
  onSave: (member: Omit<Member, 'id' | 'createdAt'>) => void;
}

export const MemberDialog = ({ open, onOpenChange, member, onSave }: MemberDialogProps) => {
  const { clientType } = useClientType();
  const [formData, setFormData] = useState({
    nomeCompleto: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    dataAniversario: '',
    sexo: '' as Gender,
    whatsapp: '',
    cargo: '' as string,
  });
  const [loadingCep, setLoadingCep] = useState(false);

  useEffect(() => {
    if (member) {
      setFormData({
        nomeCompleto: member.nomeCompleto,
        cep: member.cep || '',
        rua: member.rua || '',
        numero: member.numero || '',
        complemento: member.complemento || '',
        bairro: member.bairro || '',
        cidade: member.cidade || '',
        estado: member.estado || '',
        dataAniversario: member.dataAniversario,
        sexo: member.sexo,
        whatsapp: member.whatsapp,
        cargo: member.cargo,
      });
    } else {
      setFormData({
        nomeCompleto: '',
        cep: '',
        rua: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        dataAniversario: '',
        sexo: '' as Gender,
        whatsapp: '',
        cargo: '',
      });
    }
  }, [member, open]);

  const handleCepBlur = async () => {
    const cep = formData.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          rua: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          estado: data.uf || '',
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setLoadingCep(false);
    }
  };

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
            <DialogTitle>{member ? 'Editar' : 'Novo'} {clientType === 'associacao' ? 'Associado' : 'Membro'}</DialogTitle>
            <DialogDescription>
              Preencha os dados do {clientType === 'associacao' ? 'associado' : 'membro'}
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
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                onBlur={handleCepBlur}
                placeholder="00000-000"
                disabled={loadingCep}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2 col-span-2">
                <Label htmlFor="rua">Rua</Label>
                <Input
                  id="rua"
                  value={formData.rua}
                  onChange={(e) => setFormData({ ...formData, rua: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="numero">Número *</Label>
                <Input
                  id="numero"
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="complemento">Complemento</Label>
              <Input
                id="complemento"
                value={formData.complemento}
                onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={formData.bairro}
                  onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="estado">Estado</Label>
                <Input
                  id="estado"
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  maxLength={2}
                  placeholder="UF"
                />
              </div>
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

              {clientType !== 'associacao' && (
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
              )}
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
