import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Church {
  id: string;
  church_name: string;
  pastor_email: string;
  pastor_name?: string;
  pastor_rg?: string;
  pastor_cpf?: string;
  pastor_whatsapp?: string;
  cnpj?: string;
  current_stage: number;
  city?: string;
  state?: string;
  address?: string;
  neighborhood?: string;
  postal_code?: string;
  monthly_fee?: number;
  payment_due_day?: number;
  created_at: string;
}

interface BoardMember {
  id: string;
  nome_completo: string;
  cargo: string;
  cpf: string;
  rg: string;
  endereco: string;
}

export default function AdminClientView() {
  const { id } = useParams<{ id: string }>();
  const [church, setChurch] = useState<Church | null>(null);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchChurchData();
    }
  }, [id]);

  const fetchChurchData = async () => {
    try {
      setLoading(true);
      
      // Fetch church data
      const { data: churchData, error: churchError } = await supabase
        .from('churches')
        .select('*')
        .eq('id', id)
        .single();

      if (churchError) throw churchError;
      setChurch(churchData);

      // Fetch board members
      const { data: membersData, error: membersError } = await supabase
        .from('board_members')
        .select('*')
        .eq('church_id', id);

      if (membersError) throw membersError;
      setBoardMembers(membersData || []);

    } catch (error) {
      console.error('Error fetching church data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados do cliente',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage: number) => {
    if (stage === 6) return 'default';
    if (stage >= 4) return 'secondary';
    return 'outline';
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  if (!church) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">Cliente não encontrado</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/clients">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{church.church_name}</h1>
            <p className="text-muted-foreground">Visualização completa do cliente</p>
          </div>
          <Badge variant={getStageColor(church.current_stage || 1)}>
            Etapa {church.current_stage || 1}/6
          </Badge>
        </div>

        {/* Church Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informações da Igreja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Nome da Igreja</p>
                    <p className="text-sm text-muted-foreground">{church.church_name}</p>
                  </div>
                </div>
                
                {church.cnpj && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">CNPJ</p>
                      <p className="text-sm text-muted-foreground">{church.cnpj}</p>
                    </div>
                  </div>
                )}

                {church.city && church.state && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Localização</p>
                      <p className="text-sm text-muted-foreground">
                        {church.address && `${church.address}, `}
                        {church.neighborhood && `${church.neighborhood}, `}
                        {church.city}, {church.state}
                        {church.postal_code && ` - ${church.postal_code}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Data de Cadastro</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(church.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                {church.monthly_fee && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Mensalidade</p>
                      <p className="text-sm text-muted-foreground">
                        R$ {church.monthly_fee.toFixed(2)}
                        {church.payment_due_day && ` - Vencimento dia ${church.payment_due_day}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pastor Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Pastor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                {church.pastor_name && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Nome</p>
                      <p className="text-sm text-muted-foreground">{church.pastor_name}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{church.pastor_email}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {church.pastor_whatsapp && (
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">WhatsApp</p>
                      <p className="text-sm text-muted-foreground">{church.pastor_whatsapp}</p>
                    </div>
                  </div>
                )}

                {church.pastor_cpf && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">CPF</p>
                      <p className="text-sm text-muted-foreground">{church.pastor_cpf}</p>
                    </div>
                  </div>
                )}

                {church.pastor_rg && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">RG</p>
                      <p className="text-sm text-muted-foreground">{church.pastor_rg}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Board Members Card */}
        {boardMembers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Membros da Diretoria ({boardMembers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {boardMembers.map((member) => (
                  <div key={member.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{member.nome_completo}</h3>
                        <Badge variant="outline" className="mt-1">{member.cargo}</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground mt-3">
                      <div>
                        <span className="font-medium">CPF:</span> {member.cpf}
                      </div>
                      <div>
                        <span className="font-medium">RG:</span> {member.rg}
                      </div>
                      <div>
                        <span className="font-medium">Endereço:</span> {member.endereco}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
