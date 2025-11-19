import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Loader2, Search } from 'lucide-react';

interface DirectorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  onSuccess: () => void;
  initialCargo?: string;
}

interface DirectorFormData {
  cargo: string;
  nomeCompleto: string;
  rg: string;
  orgaoEmissor: string;
  cpf: string;
  endereco: string;
  cep: string;
  estadoCivil: string;
  profissao: string;
}

const cargos = [
  'Presidente',
  'Vice-Presidente',
  '1º Tesoureiro',
  '1º Secretário',
  '1º Conselheiro',
  '2º Conselheiro',
  '3º Conselheiro',
];

const estadosCivis = [
  'Solteiro(a)',
  'Casado(a)',
  'Divorciado(a)',
  'Viúvo(a)',
];

export const DirectorFormDialog = ({
  open,
  onOpenChange,
  churchId,
  onSuccess,
  initialCargo,
}: DirectorFormDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const [formData, setFormData] = useState<DirectorFormData>({
    cargo: initialCargo || '',
    nomeCompleto: '',
    rg: '',
    orgaoEmissor: '',
    cpf: '',
    endereco: '',
    cep: '',
    estadoCivil: '',
    profissao: '',
  });

  useEffect(() => {
    if (initialCargo && open) {
      setFormData(prev => ({ ...prev, cargo: initialCargo }));
    }
  }, [initialCargo, open]);

  const handleChange = (field: keyof DirectorFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 5) {
      return numbers;
    }
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) {
      return numbers;
    }
    if (numbers.length <= 6) {
      return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    }
    if (numbers.length <= 9) {
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    }
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const searchCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      toast.error('CEP deve ter 8 dígitos');
      return;
    }

    setSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }

      const enderecoCompleto = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
      setFormData(prev => ({ ...prev, endereco: enderecoCompleto }));
      toast.success('Endereço encontrado!');
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast.error('Erro ao buscar CEP');
    } finally {
      setSearchingCep(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cargo || !formData.nomeCompleto || !formData.rg || !formData.orgaoEmissor || 
        !formData.cpf || !formData.endereco || !formData.cep || !formData.estadoCivil || !formData.profissao) {
      toast.error('Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('board_members')
        .insert({
          church_id: churchId,
          cargo: formData.cargo,
          nome_completo: formData.nomeCompleto,
          rg: formData.rg,
          orgao_emissor: formData.orgaoEmissor,
          cpf: formData.cpf.replace(/\D/g, ''),
          endereco: formData.endereco,
          cep: formData.cep.replace(/\D/g, ''),
          estado_civil: formData.estadoCivil,
          profissao: formData.profissao,
        });

      if (error) throw error;

      toast.success('Diretor adicionado com sucesso!');
      setFormData({
        cargo: '',
        nomeCompleto: '',
        rg: '',
        orgaoEmissor: '',
        cpf: '',
        endereco: '',
        cep: '',
        estadoCivil: '',
        profissao: '',
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar diretor:', error);
      toast.error('Erro ao salvar diretor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Diretor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo *</Label>
            <Select value={formData.cargo} onValueChange={(value) => handleChange('cargo', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cargo" />
              </SelectTrigger>
              <SelectContent>
                {cargos.map((cargo) => (
                  <SelectItem key={cargo} value={cargo}>
                    {cargo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nomeCompleto">Nome Completo *</Label>
            <Input
              id="nomeCompleto"
              value={formData.nomeCompleto}
              onChange={(e) => handleChange('nomeCompleto', e.target.value)}
              placeholder="Digite o nome completo"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rg">RG *</Label>
              <Input
                id="rg"
                value={formData.rg}
                onChange={(e) => handleChange('rg', e.target.value)}
                placeholder="Digite o RG"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgaoEmissor">Órgão Emissor *</Label>
              <Input
                id="orgaoEmissor"
                value={formData.orgaoEmissor}
                onChange={(e) => handleChange('orgaoEmissor', e.target.value)}
                placeholder="Ex: SSP/SP"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">CPF *</Label>
            <Input
              id="cpf"
              value={formData.cpf}
              onChange={(e) => handleChange('cpf', formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cep">CEP *</Label>
            <div className="flex gap-2">
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) => handleChange('cep', formatCep(e.target.value))}
                placeholder="00000-000"
                maxLength={9}
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => searchCep(formData.cep)}
                disabled={searchingCep}
              >
                {searchingCep ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço Completo *</Label>
            <Input
              id="endereco"
              value={formData.endereco}
              onChange={(e) => handleChange('endereco', e.target.value)}
              placeholder="Rua, número, bairro, cidade - UF"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="estadoCivil">Estado Civil *</Label>
            <Select value={formData.estadoCivil} onValueChange={(value) => handleChange('estadoCivil', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estado civil" />
              </SelectTrigger>
              <SelectContent>
                {estadosCivis.map((estado) => (
                  <SelectItem key={estado} value={estado}>
                    {estado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profissao">Profissão *</Label>
            <Input
              id="profissao"
              value={formData.profissao}
              onChange={(e) => handleChange('profissao', e.target.value)}
              placeholder="Digite a profissão"
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Adicionar Diretor'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
