import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Pencil, Trash2, UserPlus, ArrowRightLeft, Upload, User, Loader2 } from 'lucide-react';
import { ImageCropDialog } from '@/components/financial/ImageCropDialog';

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  foto_url: string | null;
  comissao_percentual: number;
  status: string;
  meta_mensal_valor: number;
  created_at: string;
}

interface Church {
  id: string;
  church_name: string;
  vendedor_id: string | null;
}

export default function Vendedores() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null);
  const [selectedChurch, setSelectedChurch] = useState<string>('');
  const [targetVendedor, setTargetVendedor] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    foto_url: '',
    comissao_percentual: 5,
    status: 'Ativo',
    meta_mensal_valor: 0,
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("A imagem deve ter no máximo 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setShowCropDialog(true);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    setUploadingImage(true);
    try {
      const fileName = `vendedores/${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(fileName, croppedImageBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("profile-avatars")
        .getPublicUrl(fileName);

      setFormData({ ...formData, foto_url: publicUrl });
      toast.success("Foto carregada com sucesso!");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploadingImage(false);
    }
  };

  const { data: vendedores, isLoading } = useQuery({
    queryKey: ['vendedores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as Vendedor[];
    },
  });

  const { data: churches } = useQuery({
    queryKey: ['churches-with-vendedor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('churches')
        .select('id, church_name, vendedor_id')
        .order('church_name');
      if (error) throw error;
      return data as Church[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('vendedores')
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
      toast.success('Vendedor criado com sucesso!');
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar vendedor');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('vendedores')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
      toast.success('Vendedor atualizado com sucesso!');
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar vendedor');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vendedores')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
      toast.success('Vendedor removido com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao remover vendedor');
    },
  });

  const transferMutation = useMutation({
    mutationFn: async ({ churchId, vendedorId }: { churchId: string; vendedorId: string | null }) => {
      const { error } = await supabase
        .from('churches')
        .update({ vendedor_id: vendedorId })
        .eq('id', churchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['churches-with-vendedor'] });
      toast.success('Cliente transferido com sucesso!');
      setTransferDialogOpen(false);
      setSelectedChurch('');
      setTargetVendedor('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao transferir cliente');
    },
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      email: '',
      foto_url: '',
      comissao_percentual: 5,
      status: 'Ativo',
      meta_mensal_valor: 0,
    });
    setEditingVendedor(null);
  };

  const handleEdit = (vendedor: Vendedor) => {
    setEditingVendedor(vendedor);
    setFormData({
      nome: vendedor.nome,
      email: vendedor.email,
      foto_url: vendedor.foto_url || '',
      comissao_percentual: vendedor.comissao_percentual,
      status: vendedor.status,
      meta_mensal_valor: vendedor.meta_mensal_valor,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast.error("Preencha o nome completo");
      return;
    }
    
    if (!formData.email.trim()) {
      toast.error("Preencha o email");
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (editingVendedor) {
        await updateMutation.mutateAsync({ id: editingVendedor.id, data: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransfer = () => {
    if (!selectedChurch) {
      toast.error('Selecione um cliente');
      return;
    }
    transferMutation.mutate({ 
      churchId: selectedChurch, 
      vendedorId: targetVendedor || null 
    });
  };

  const getVendedorName = (vendedorId: string | null) => {
    if (!vendedorId) return 'Sem vendedor';
    const vendedor = vendedores?.find(v => v.id === vendedorId);
    return vendedor?.nome || 'Desconhecido';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Vendedores</h1>
          <p className="text-muted-foreground">Gerencie sua equipe de vendas</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transferir Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transferir Cliente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={selectedChurch} onValueChange={setSelectedChurch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {churches?.map((church) => (
                        <SelectItem key={church.id} value={church.id}>
                          {church.church_name} ({getVendedorName(church.vendedor_id)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Novo Vendedor</Label>
                  <Select value={targetVendedor} onValueChange={setTargetVendedor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o vendedor (ou deixe vazio)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem vendedor</SelectItem>
                      {vendedores?.map((vendedor) => (
                        <SelectItem key={vendedor.id} value={vendedor.id}>
                          {vendedor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleTransfer} className="w-full">
                  Transferir
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Novo Vendedor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingVendedor ? 'Editar Vendedor' : 'Novo Vendedor'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Foto de Perfil</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={formData.foto_url} />
                      <AvatarFallback>
                        <User className="h-10 w-10" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                        id="vendedor-avatar-upload"
                        disabled={uploadingImage}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById("vendedor-avatar-upload")?.click()}
                        disabled={uploadingImage}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingImage ? "Carregando..." : "Escolher Foto"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendedor-nome">
                    Nome Completo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="vendedor-nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendedor-email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="vendedor-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendedor-comissao">Comissão (%)</Label>
                    <Input
                      id="vendedor-comissao"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.comissao_percentual}
                      onChange={(e) => setFormData({ ...formData, comissao_percentual: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendedor-meta">Meta Mensal (R$)</Label>
                    <Input
                      id="vendedor-meta"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.meta_mensal_valor}
                      onChange={(e) => setFormData({ ...formData, meta_mensal_valor: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting || uploadingImage}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingVendedor ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendedores ({vendedores?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Meta Mensal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendedores?.map((vendedor) => {
                const clientCount = churches?.filter(c => c.vendedor_id === vendedor.id).length || 0;
                return (
                  <TableRow key={vendedor.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={vendedor.foto_url || undefined} />
                          <AvatarFallback>{vendedor.nome.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{vendedor.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>{vendedor.email}</TableCell>
                    <TableCell>{vendedor.comissao_percentual}%</TableCell>
                    <TableCell>{formatCurrency(vendedor.meta_mensal_valor)}</TableCell>
                    <TableCell>
                      <Badge variant={vendedor.status === 'Ativo' ? 'default' : 'secondary'}>
                        {vendedor.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{clientCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(vendedor)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            if (confirm('Tem certeza que deseja remover este vendedor?')) {
                              deleteMutation.mutate(vendedor.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!vendedores || vendedores.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum vendedor cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ImageCropDialog
        open={showCropDialog}
        onOpenChange={setShowCropDialog}
        imageSrc={selectedImage || ""}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
