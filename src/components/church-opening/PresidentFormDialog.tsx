import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';

interface PresidentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  onSuccess: () => void;
}

interface PresidentFormData {
  nomeCompleto: string;
  rg: string;
  cpf: string;
  endereco: string;
  cep: string;
  whatsapp: string;
  dataNascimento: string;
  email: string;
}

export const PresidentFormDialog = ({
  open,
  onOpenChange,
  churchId,
  onSuccess,
}: PresidentFormDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const [cpfValid, setCpfValid] = useState<boolean | null>(null);
  const [formData, setFormData] = useState<PresidentFormData>({
    nomeCompleto: '',
    rg: '',
    cpf: '',
    endereco: '',
    cep: '',
    whatsapp: '',
    dataNascimento: '',
    email: '',
  });

  const handleChange = (field: keyof PresidentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

  const validateCpf = (cpf: string): boolean => {
    const numbers = cpf.replace(/\D/g, '');
    
    // CPF deve ter 11 dígitos
    if (numbers.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais (CPF inválido)
    if (/^(\d)\1{10}$/.test(numbers)) return false;
    
    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(numbers.charAt(i)) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(numbers.charAt(9))) return false;
    
    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(numbers.charAt(i)) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(numbers.charAt(10))) return false;
    
    return true;
  };

  const handleCpfChange = (value: string) => {
    const formatted = formatCpf(value);
    setFormData(prev => ({ ...prev, cpf: formatted }));
    
    // Valida apenas se tiver 11 dígitos
    const numbers = formatted.replace(/\D/g, '');
    if (numbers.length === 11) {
      const isValid = validateCpf(formatted);
      setCpfValid(isValid);
      if (!isValid) {
        toast.error('CPF inválido');
      }
    } else {
      setCpfValid(null);
    }
  };

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 5) {
      return numbers;
    }
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  const formatWhatsApp = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) {
      return numbers;
    }
    if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    }
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleCepChange = (value: string) => {
    const formatted = formatCep(value);
    setFormData(prev => ({ ...prev, cep: formatted }));
  };

  const handleWhatsAppChange = (value: string) => {
    const formatted = formatWhatsApp(value);
    setFormData(prev => ({ ...prev, whatsapp: formatted }));
  };

  const searchCep = async () => {
    const cepNumbers = formData.cep.replace(/\D/g, '');
    
    if (cepNumbers.length !== 8) {
      toast.error('CEP deve conter 8 dígitos');
      return;
    }

    setSearchingCep(true);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepNumbers}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }

      // Monta o endereço completo
      const enderecoCompleto = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
      
      setFormData(prev => ({
        ...prev,
        endereco: enderecoCompleto,
      }));

      toast.success('Endereço encontrado!');
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast.error('Erro ao buscar CEP. Tente novamente.');
    } finally {
      setSearchingCep(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.nomeCompleto.trim() || !formData.rg.trim() || !formData.cpf.trim() || 
        !formData.endereco.trim() || !formData.cep.trim() || !formData.email.trim()) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    // CPF validation
    if (!validateCpf(formData.cpf)) {
      toast.error('Por favor, insira um CPF válido');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Por favor, insira um email válido');
      return;
    }

    setLoading(true);

    try {
      const { error: insertError } = await supabase.from('board_members').insert({
        church_id: churchId,
        cargo: 'Presidente',
        nome_completo: formData.nomeCompleto,
        rg: formData.rg,
        cpf: formData.cpf,
        endereco: `${formData.endereco}, CEP: ${formData.cep}`,
        cep: formData.cep,
        estado_civil: '', // Campo não obrigatório
        profissao: '', // Campo não obrigatório
        orgao_emissor: '', // Campo não obrigatório
      });

      if (insertError) {
        console.error('Error inserting board member:', insertError);
        throw insertError;
      }

      // Update stage progress to pending approval
      const { error: progressError } = await supabase.from('church_stage_progress').upsert({
        church_id: churchId,
        stage_id: 1,
        sub_task_id: '1-1',
        status: 'pending_approval',
      }, {
        onConflict: 'church_id,stage_id,sub_task_id',
      });

      if (progressError) {
        console.error('Error updating progress:', progressError);
        // Continue even if progress update fails
      }

      toast.success('Dados do presidente salvos com sucesso!');
      
      // Call success callback
      onSuccess();
      
      // Close modal after a short delay
      setTimeout(() => {
        handleClose();
      }, 500);
    } catch (error) {
      console.error('Error saving president data:', error);
      toast.error('Erro ao salvar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form data
    setFormData({
      nomeCompleto: '',
      rg: '',
      cpf: '',
      endereco: '',
      cep: '',
      whatsapp: '',
      dataNascimento: '',
      email: '',
    });
    // Reset validation states
    setCpfValid(null);
    // Close dialog
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dados do Presidente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="nomeCompleto">
                Nome Completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nomeCompleto"
                value={formData.nomeCompleto}
                onChange={(e) => handleChange('nomeCompleto', e.target.value)}
                placeholder="Digite o nome completo"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rg">
                  RG <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rg"
                  value={formData.rg}
                  onChange={(e) => handleChange('rg', e.target.value)}
                  placeholder="Digite o RG"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf">
                  CPF <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => handleCpfChange(e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    required
                    className={
                      cpfValid === false 
                        ? 'border-destructive focus-visible:ring-destructive' 
                        : cpfValid === true 
                        ? 'border-success focus-visible:ring-success' 
                        : ''
                    }
                  />
                  {cpfValid === true && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success">✓</span>
                  )}
                </div>
                {cpfValid === false && (
                  <p className="text-xs text-destructive">CPF inválido</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cep">
                  CEP <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={searchCep}
                    disabled={searchingCep || formData.cep.replace(/\D/g, '').length !== 8}
                    title="Buscar CEP"
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
              <Label htmlFor="endereco">
                Endereço Completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) => handleChange('endereco', e.target.value)}
                placeholder="Rua, número, complemento, bairro, cidade, estado"
                required
              />
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => handleWhatsAppChange(e.target.value)}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataNascimento">Data de Nascimento</Label>
                <Input
                  id="dataNascimento"
                  type="date"
                  value={formData.dataNascimento}
                  onChange={(e) => handleChange('dataNascimento', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
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
                'Salvar Dados'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
