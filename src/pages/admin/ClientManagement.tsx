import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, FileText, User, Clock, CheckCircle2, XCircle, Key, Loader2 } from 'lucide-react';
import { initialStages } from '@/data/stages';
import type { SubTaskStatus } from '@/types/church-opening';

interface Church {
  id: string;
  church_name: string;
  pastor_email: string;
  pastor_name?: string;
  current_stage: number;
  city: string;
  state: string;
}

interface EBDCliente {
  id: string;
  nome_igreja: string;
  email_superintendente: string | null;
  nome_superintendente: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  status_ativacao_ebd: boolean;
  senha_temporaria: string | null;
  superintendente_user_id: string | null;
}

interface BoardMember {
  id: string;
  cargo: string;
  nome_completo: string;
  rg: string;
  orgao_emissor: string;
  cpf: string;
  endereco: string;
  cep: string;
  estado_civil: string;
  profissao: string;
}

interface Document {
  id: string;
  file_name: string;
  document_type: string;
  stage_id: number;
  sub_task_id: string;
  created_at: string;
  file_path: string;
}

interface Progress {
  stage_id: number;
  sub_task_id: string;
  status: SubTaskStatus;
}

export default function ClientManagement() {
  const { churchId } = useParams<{ churchId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [church, setChurch] = useState<Church | null>(null);
  const [ebdCliente, setEbdCliente] = useState<EBDCliente | null>(null);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedSubTask, setSelectedSubTask] = useState<{ stageId: number; subTaskId: string } | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isEbdClient, setIsEbdClient] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    if (churchId) {
      fetchData();
    }
  }, [churchId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // First try to fetch from churches table
      const { data: churchData, error: churchError } = await supabase
        .from('churches')
        .select('*')
        .eq('id', churchId)
        .single();

      if (churchData && !churchError) {
        setChurch(churchData);
        setIsEbdClient(false);
        
        // Buscar membros da diretoria
        const { data: membersData } = await supabase
          .from('board_members')
          .select('*')
          .eq('church_id', churchId);
        setBoardMembers(membersData || []);

        // Buscar documentos
        const { data: docsData } = await supabase
          .from('church_documents')
          .select('*')
          .eq('church_id', churchId)
          .order('created_at', { ascending: false });
        setDocuments(docsData || []);

        // Buscar progresso
        const { data: progressData } = await supabase
          .from('church_stage_progress')
          .select('*')
          .eq('church_id', churchId);
        setProgress((progressData || []) as Progress[]);
      } else {
        // If not found in churches, try ebd_clientes
        const { data: ebdData, error: ebdError } = await supabase
          .from('ebd_clientes')
          .select('*')
          .eq('id', churchId)
          .single();

        if (ebdData && !ebdError) {
          setEbdCliente(ebdData);
          setIsEbdClient(true);
        } else {
          // Client not found in either table
          setChurch(null);
          setEbdCliente(null);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados do cliente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !selectedSubTask || !churchId) return;

    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${churchId}/${selectedSubTask.stageId}/${selectedSubTask.subTaskId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('church-documents')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('church_documents')
        .insert({
          church_id: churchId,
          file_name: uploadFile.name,
          file_path: fileName,
          file_size: uploadFile.size,
          mime_type: uploadFile.type,
          document_type: 'admin_upload',
          stage_id: selectedSubTask.stageId,
          sub_task_id: selectedSubTask.subTaskId,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id || '',
        });

      if (dbError) throw dbError;

      toast({
        title: 'Sucesso',
        description: 'Documento enviado com sucesso!',
      });

      setUploadModalOpen(false);
      setUploadFile(null);
      fetchData();
    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao enviar documento.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStatus = async (stageId: number, subTaskId: string, newStatus: SubTaskStatus) => {
    if (!churchId) return;

    try {
      const existing = progress.find(p => p.stage_id === stageId && p.sub_task_id === subTaskId);

      if (existing) {
        const { error } = await supabase
          .from('church_stage_progress')
          .update({ status: newStatus })
          .eq('church_id', churchId)
          .eq('stage_id', stageId)
          .eq('sub_task_id', subTaskId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('church_stage_progress')
          .insert({
            church_id: churchId,
            stage_id: stageId,
            sub_task_id: subTaskId,
            status: newStatus,
          });

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: 'Status atualizado!',
      });

      fetchData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar status.',
        variant: 'destructive',
      });
    }
  };

  const getSubTaskStatus = (stageId: number, subTaskId: string): SubTaskStatus => {
    const item = progress.find(p => p.stage_id === stageId && p.sub_task_id === subTaskId);
    return item?.status || 'pending';
  };

  const getStatusIcon = (status: SubTaskStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleResetPassword = async () => {
    if (!ebdCliente?.superintendente_user_id || !newPassword) {
      toast({ title: 'Erro', description: 'Usuário ou senha não informados', variant: 'destructive' });
      return;
    }
    setResettingPassword(true);
    try {
      const { error } = await supabase.functions.invoke('update-user-password', {
        body: { userId: ebdCliente.superintendente_user_id, newPassword }
      });
      if (error) throw error;
      
      await supabase.from('ebd_clientes').update({ senha_temporaria: newPassword }).eq('id', ebdCliente.id);
      
      toast({ title: 'Sucesso', description: 'Senha atualizada!' });
      setResetPasswordOpen(false);
      setNewPassword('');
      fetchData();
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({ title: 'Erro', description: 'Erro ao resetar senha', variant: 'destructive' });
    } finally {
      setResettingPassword(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  if (!church && !ebdCliente) {
    return <div className="flex items-center justify-center min-h-screen">Cliente não encontrado</div>;
  }

  // Render EBD Client view
  if (isEbdClient && ebdCliente) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="container max-w-7xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/clients')}
            className="mb-6 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Clientes
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{ebdCliente.nome_igreja}</h1>
            <p className="text-muted-foreground">
              {ebdCliente.nome_superintendente || 'Sem superintendente'} • {ebdCliente.endereco_cidade || '-'}, {ebdCliente.endereco_estado || '-'}
            </p>
            <Badge className={ebdCliente.status_ativacao_ebd ? 'bg-success mt-2' : 'bg-warning mt-2'}>
              {ebdCliente.status_ativacao_ebd ? 'EBD Ativado' : 'EBD Não Ativado'}
            </Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações do Cliente EBD
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome da Igreja</p>
                  <p className="font-medium">{ebdCliente.nome_igreja}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">E-mail do Superintendente</p>
                  <p className="font-medium">{ebdCliente.email_superintendente || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Superintendente</p>
                  <p className="font-medium">{ebdCliente.nome_superintendente || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Localização</p>
                  <p className="font-medium">{ebdCliente.endereco_cidade || '-'}, {ebdCliente.endereco_estado || '-'}</p>
                </div>
              </div>
              {ebdCliente.superintendente_user_id && (
                <div className="mt-6 pt-4 border-t">
                  <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Key className="h-4 w-4" />
                        Resetar Senha
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Resetar Senha do Superintendente</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Nova Senha</Label>
                          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Digite a nova senha" />
                        </div>
                        <Button onClick={handleResetPassword} disabled={resettingPassword || !newPassword}>
                          {resettingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Confirmar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render Church view
  if (!church) {
    return <div className="flex items-center justify-center min-h-screen">Cliente não encontrado</div>;
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin/clients')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Clientes
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{church.church_name}</h1>
          <p className="text-muted-foreground">{church.pastor_name} • {church.city}, {church.state}</p>
          <Badge className="mt-2">Etapa {church.current_stage} de 6</Badge>
        </div>

        <Tabs defaultValue="progress" className="space-y-6">
          <TabsList>
            <TabsTrigger value="progress">Progresso das Etapas</TabsTrigger>
            <TabsTrigger value="diretoria">Diretoria</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="progress" className="space-y-6">
            {initialStages.map((stage) => (
              <Card key={stage.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Etapa {stage.id}: {stage.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tarefa</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stage.subTasks.map((subTask) => {
                        const status = getSubTaskStatus(stage.id, subTask.id);
                        return (
                          <TableRow key={subTask.id}>
                            <TableCell>{subTask.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(status)}
                                <span className="capitalize">{status === 'in_progress' ? 'em andamento' : status === 'completed' ? 'concluído' : 'pendente'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateStatus(stage.id, subTask.id, 'in_progress')}
                                  disabled={status === 'in_progress'}
                                >
                                  Em Andamento
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateStatus(stage.id, subTask.id, 'completed')}
                                  disabled={status === 'completed'}
                                >
                                  Concluir
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedSubTask({ stageId: stage.id, subTaskId: subTask.id });
                                    setUploadModalOpen(true);
                                  }}
                                >
                                  <Upload className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="diretoria">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Membros da Diretoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {boardMembers.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum membro cadastrado ainda.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>RG</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {boardMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.cargo}</TableCell>
                          <TableCell>{member.nome_completo}</TableCell>
                          <TableCell>{member.cpf}</TableCell>
                          <TableCell>{member.rg} - {member.orgao_emissor}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documentos Enviados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum documento enviado ainda.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Etapa</TableHead>
                        <TableHead>Tarefa</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>{doc.file_name}</TableCell>
                          <TableCell>Etapa {doc.stage_id}</TableCell>
                          <TableCell>{doc.sub_task_id}</TableCell>
                          <TableCell>{new Date(doc.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar Documento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="file">Arquivo</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </div>
              <Button onClick={handleUpload} disabled={!uploadFile}>
                Enviar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
