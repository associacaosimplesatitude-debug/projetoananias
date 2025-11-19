import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FinancialEntry, EntryType } from '@/types/financial';
import { TrendingUp, Save, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useChurchData } from '@/hooks/useChurchData';

const FinancialEntries = () => {
  const { toast } = useToast();
  const { churchId } = useChurchData();
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    hora: '',
    tipo: '' as EntryType,
    valor: '',
    membroId: '',
    descricao: '',
  });

  const entryTypes: EntryType[] = ['Dízimo', 'Oferta', 'Venda de Produtos', 'Outros'];

  // Buscar entradas do banco
  useEffect(() => {
    const fetchEntries = async () => {
      if (!churchId) return;

      const { data, error } = await supabase
        .from('financial_entries')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar entradas:', error);
        return;
      }

      if (data) {
        const formattedEntries = data.map(entry => ({
          id: entry.id,
          data: entry.data,
          hora: entry.hora || undefined,
          tipo: entry.tipo as EntryType,
          valor: Number(entry.valor),
          membroId: entry.membro_id || undefined,
          membroNome: entry.membro_nome || undefined,
          descricao: entry.descricao,
          createdAt: entry.created_at,
        }));
        setEntries(formattedEntries);
      }
    };

    fetchEntries();
  }, [churchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!churchId) {
      toast({
        title: 'Erro',
        description: 'Igreja não identificada.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.tipo === 'Dízimo' && !formData.membroId) {
      toast({
        title: 'Membro obrigatório',
        description: 'Para lançamentos de Dízimo, é necessário selecionar um membro.',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase
      .from('financial_entries')
      .insert({
        church_id: churchId,
        data: formData.data,
        hora: formData.hora || null,
        tipo: formData.tipo,
        valor: parseFloat(formData.valor),
        membro_id: formData.membroId || null,
        descricao: formData.descricao,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    if (data) {
      const newEntry: FinancialEntry = {
        id: data.id,
        data: data.data,
        hora: data.hora || undefined,
        tipo: data.tipo as EntryType,
        valor: Number(data.valor),
        membroId: data.membro_id || undefined,
        membroNome: data.membro_nome || undefined,
        descricao: data.descricao,
        createdAt: data.created_at,
      };
      setEntries((prev) => [newEntry, ...prev]);
    }
    
    setFormData({
      data: new Date().toISOString().split('T')[0],
      hora: '',
      tipo: '' as EntryType,
      valor: '',
      membroId: '',
      descricao: '',
    });

    toast({
      title: 'Entrada registrada!',
      description: `Lançamento de R$ ${parseFloat(formData.valor).toFixed(2)} registrado com sucesso.`,
    });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-success text-success-foreground">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Lançamento de Entradas</h1>
              <p className="text-muted-foreground">Registre receitas e doações</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle>Nova Entrada</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data">Data *</Label>
                    <Input
                      id="data"
                      type="date"
                      value={formData.data}
                      onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hora">Hora (Opcional)</Label>
                    <Input
                      id="hora"
                      type="time"
                      value={formData.hora}
                      onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value as EntryType })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {entryTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valor">Valor (R$) *</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    placeholder="0,00"
                    required
                  />
                </div>

                {formData.tipo === 'Dízimo' && (
                  <div className="space-y-2">
                    <Label htmlFor="membro">Membro *</Label>
                    <Input
                      id="membro"
                      placeholder="Buscar membro..."
                      value={formData.membroId}
                      onChange={(e) => setFormData({ ...formData, membroId: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      O campo membro é obrigatório para dízimos
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição *</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Breve descrição do lançamento"
                    rows={3}
                    required
                  />
                </div>

                <Button type="submit" className="w-full gap-2">
                  <Save className="h-4 w-4" />
                  Registrar Entrada
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Entries List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Últimos Lançamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma entrada registrada ainda</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-lg border bg-success/5 border-success/20"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <Badge variant="secondary" className="mb-1">
                            {entry.tipo}
                          </Badge>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(entry.data)}
                            {entry.hora && ` às ${entry.hora}`}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-success">
                          {formatCurrency(entry.valor)}
                        </p>
                      </div>
                      <p className="text-sm">{entry.descricao}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FinancialEntries;
