import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DirectoriaFormData, ChurchData, DirectorData } from '@/types/church-opening';

const cargos = [
  'Presidente',
  'Vice-Presidente',
  'Tesoureiro(a)',
  'Secretário(a)',
  '1º Conselheiro Fiscal',
  '2º Conselheiro Fiscal',
  '3º Conselheiro Fiscal',
];

const DiretoriaForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [churchData, setChurchData] = useState<ChurchData>({
    nomeIgreja: '',
    emailPastor: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
  });

  const [directors, setDirectors] = useState<DirectorData[]>(
    cargos.map((cargo) => ({
      cargo,
      nomeCompleto: '',
      rg: '',
      orgaoEmissor: '',
      cpf: '',
      endereco: '',
      cep: '',
      estadoCivil: '',
      profissao: '',
    }))
  );

  const handleChurchDataChange = (field: keyof ChurchData, value: string) => {
    setChurchData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDirectorChange = (index: number, field: keyof DirectorData, value: string) => {
    setDirectors((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!churchData.nomeIgreja || !churchData.emailPastor) {
      toast({
        title: 'Dados incompletos',
        description: 'Por favor, preencha todos os campos obrigatórios da igreja.',
        variant: 'destructive',
      });
      return;
    }

    const incompleteDirector = directors.findIndex(
      (d) => !d.nomeCompleto || !d.cpf || !d.rg
    );

    if (incompleteDirector !== -1) {
      toast({
        title: 'Dados incompletos',
        description: `Por favor, preencha os dados do ${directors[incompleteDirector].cargo}.`,
        variant: 'destructive',
      });
      return;
    }

    // Salvar dados (aqui você salvaria em um backend real)
    const formData: DirectoriaFormData = { churchData, directors };
    console.log('Dados salvos:', formData);

    toast({
      title: 'Formulário enviado!',
      description: 'Os dados da diretoria foram salvos com sucesso.',
    });

    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container max-w-5xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Painel
        </Button>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Parte A: Dados da Igreja */}
          <Card>
            <CardHeader>
              <CardTitle>Parte A: Dados da Igreja</CardTitle>
              <CardDescription>
                Preencha as informações básicas da instituição religiosa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="nomeIgreja">Nome da Igreja (completo, sem abreviação) *</Label>
                  <Input
                    id="nomeIgreja"
                    value={churchData.nomeIgreja}
                    onChange={(e) => handleChurchDataChange('nomeIgreja', e.target.value)}
                    placeholder="Ex: Igreja Batista Central de São Paulo"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailPastor">E-mail do Pastor *</Label>
                  <Input
                    id="emailPastor"
                    type="email"
                    value={churchData.emailPastor}
                    onChange={(e) => handleChurchDataChange('emailPastor', e.target.value)}
                    placeholder="pastor@igreja.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cep">CEP *</Label>
                  <Input
                    id="cep"
                    value={churchData.cep}
                    onChange={(e) => handleChurchDataChange('cep', e.target.value)}
                    placeholder="00000-000"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="endereco">Endereço (Rua/Avenida) *</Label>
                  <Input
                    id="endereco"
                    value={churchData.endereco}
                    onChange={(e) => handleChurchDataChange('endereco', e.target.value)}
                    placeholder="Rua/Av., número"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro *</Label>
                  <Input
                    id="bairro"
                    value={churchData.bairro}
                    onChange={(e) => handleChurchDataChange('bairro', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input
                    id="cidade"
                    value={churchData.cidade}
                    onChange={(e) => handleChurchDataChange('cidade', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado">Estado *</Label>
                  <Input
                    id="estado"
                    value={churchData.estado}
                    onChange={(e) => handleChurchDataChange('estado', e.target.value)}
                    placeholder="SP"
                    maxLength={2}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parte B: Dados dos Diretores */}
          <Card>
            <CardHeader>
              <CardTitle>Parte B: Dados dos Diretores</CardTitle>
              <CardDescription>
                Preencha os dados completos de cada membro da diretoria (7 pessoas)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {directors.map((director, index) => (
                <div key={director.cargo}>
                  {index > 0 && <Separator className="my-6" />}
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-primary">
                      {director.cargo}
                    </h3>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`nome-${index}`}>Nome Completo *</Label>
                        <Input
                          id={`nome-${index}`}
                          value={director.nomeCompleto}
                          onChange={(e) => handleDirectorChange(index, 'nomeCompleto', e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`rg-${index}`}>RG *</Label>
                        <Input
                          id={`rg-${index}`}
                          value={director.rg}
                          onChange={(e) => handleDirectorChange(index, 'rg', e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`orgao-${index}`}>Órgão Emissor *</Label>
                        <Input
                          id={`orgao-${index}`}
                          value={director.orgaoEmissor}
                          onChange={(e) => handleDirectorChange(index, 'orgaoEmissor', e.target.value)}
                          placeholder="SSP"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`cpf-${index}`}>CPF *</Label>
                        <Input
                          id={`cpf-${index}`}
                          value={director.cpf}
                          onChange={(e) => handleDirectorChange(index, 'cpf', e.target.value)}
                          placeholder="000.000.000-00"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`cep-dir-${index}`}>CEP *</Label>
                        <Input
                          id={`cep-dir-${index}`}
                          value={director.cep}
                          onChange={(e) => handleDirectorChange(index, 'cep', e.target.value)}
                          placeholder="00000-000"
                          required
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`endereco-dir-${index}`}>Endereço Completo *</Label>
                        <Input
                          id={`endereco-dir-${index}`}
                          value={director.endereco}
                          onChange={(e) => handleDirectorChange(index, 'endereco', e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`estado-civil-${index}`}>Estado Civil *</Label>
                        <Input
                          id={`estado-civil-${index}`}
                          value={director.estadoCivil}
                          onChange={(e) => handleDirectorChange(index, 'estadoCivil', e.target.value)}
                          placeholder="Solteiro, Casado, etc."
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`profissao-${index}`}>Profissão *</Label>
                        <Input
                          id={`profissao-${index}`}
                          value={director.profissao}
                          onChange={(e) => handleDirectorChange(index, 'profissao', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/')}>
              Cancelar
            </Button>
            <Button type="submit" className="gap-2">
              <Save className="h-4 w-4" />
              Salvar Dados da Diretoria
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DiretoriaForm;
