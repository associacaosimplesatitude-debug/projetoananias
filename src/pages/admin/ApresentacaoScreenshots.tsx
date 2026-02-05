import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Image, Loader2 } from "lucide-react";

interface Screenshot {
  id: string;
  section: string;
  feature_key: string;
  screenshot_url: string;
}

interface FeatureCard {
  key: string;
  title: string;
  description: string;
}

const FEATURES: Record<string, FeatureCard[]> = {
  superintendente: [
    { key: "dashboard", title: "Dashboard", description: "Visão geral com estatísticas" },
    { key: "turmas", title: "Turmas", description: "Gerenciamento de turmas" },
    { key: "professores", title: "Professores", description: "Cadastro de professores" },
    { key: "alunos", title: "Alunos", description: "Cadastro de alunos" },
    { key: "frequencia", title: "Frequência", description: "Controle de presença" },
    { key: "escalas", title: "Escalas", description: "Escalas de aulas" },
    { key: "catalogo", title: "Catálogo", description: "Catálogo de revistas" },
    { key: "relatorios", title: "Relatórios", description: "Relatórios gerenciais" },
  ],
  vendedor: [
    { key: "dashboard", title: "Dashboard", description: "Visão geral de vendas" },
    { key: "clientes", title: "Clientes", description: "Gestão de clientes" },
    { key: "propostas", title: "Propostas", description: "Criação de propostas" },
    { key: "pedidos", title: "Pedidos", description: "Acompanhamento de pedidos" },
    { key: "catalogo", title: "Catálogo", description: "Catálogo de produtos" },
    { key: "metas", title: "Metas", description: "Metas e comissões" },
  ],
  admin: [
    { key: "dashboard", title: "Dashboard", description: "Painel administrativo" },
    { key: "clientes", title: "Clientes", description: "Gestão de clientes" },
    { key: "vendedores", title: "Vendedores", description: "Gestão de vendedores" },
    { key: "financeiro", title: "Financeiro", description: "Controle financeiro" },
    { key: "relatorios", title: "Relatórios", description: "Relatórios gerais" },
  ],
};

function UploadCard({ 
  feature, 
  section, 
  currentUrl,
  onUpload,
  onRemove,
  isUploading 
}: { 
  feature: FeatureCard; 
  section: string;
  currentUrl?: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
  isUploading: boolean;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Por favor, selecione uma imagem");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("A imagem deve ter no máximo 5MB");
        return;
      }
      onUpload(file);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{feature.title}</CardTitle>
        <CardDescription className="text-xs">{feature.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center">
          {currentUrl ? (
            <img 
              src={currentUrl} 
              alt={feature.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Image className="h-8 w-8" />
              <span className="text-xs">Sem imagem</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={isUploading}
            onClick={() => document.getElementById(`upload-${section}-${feature.key}`)?.click()}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </>
            )}
          </Button>
          {currentUrl && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onRemove}
              disabled={isUploading}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <input
            id={`upload-${section}-${feature.key}`}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ApresentacaoScreenshots() {
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: screenshots = [], isLoading } = useQuery({
    queryKey: ['apresentacao-screenshots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apresentacao_screenshots')
        .select('*');
      if (error) throw error;
      return data as Screenshot[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, section, featureKey }: { file: File; section: string; featureKey: string }) => {
      const fileExt = file.name.split('.').pop();
      const filePath = `${section}/${featureKey}-${Date.now()}.${fileExt}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('apresentacao-screenshots')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('apresentacao-screenshots')
        .getPublicUrl(filePath);

      // Upsert to database
      const { error: dbError } = await supabase
        .from('apresentacao_screenshots')
        .upsert(
          { 
            section, 
            feature_key: featureKey, 
            screenshot_url: urlData.publicUrl 
          },
          { onConflict: 'section,feature_key' }
        );

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apresentacao-screenshots'] });
      toast.success("Imagem salva com sucesso!");
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error("Erro ao salvar imagem");
    },
    onSettled: () => {
      setUploadingKey(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ section, featureKey }: { section: string; featureKey: string }) => {
      const { error } = await supabase
        .from('apresentacao_screenshots')
        .delete()
        .eq('section', section)
        .eq('feature_key', featureKey);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apresentacao-screenshots'] });
      toast.success("Imagem removida");
    },
    onError: () => {
      toast.error("Erro ao remover imagem");
    },
  });

  const getScreenshotUrl = (section: string, featureKey: string) => {
    return screenshots.find(s => s.section === section && s.feature_key === featureKey)?.screenshot_url;
  };

  const handleUpload = (section: string, featureKey: string, file: File) => {
    setUploadingKey(`${section}-${featureKey}`);
    uploadMutation.mutate({ file, section, featureKey });
  };

  const handleRemove = (section: string, featureKey: string) => {
    removeMutation.mutate({ section, featureKey });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Screenshots da Apresentação</h1>
        <p className="text-muted-foreground">
          Gerencie as imagens exibidas na página de apresentação do sistema.
        </p>
      </div>

      <Tabs defaultValue="superintendente">
        <TabsList>
          <TabsTrigger value="superintendente">Superintendente</TabsTrigger>
          <TabsTrigger value="vendedor">Vendedor</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>

        {Object.entries(FEATURES).map(([section, features]) => (
          <TabsContent key={section} value={section}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {features.map((feature) => (
                <UploadCard
                  key={feature.key}
                  feature={feature}
                  section={section}
                  currentUrl={getScreenshotUrl(section, feature.key)}
                  onUpload={(file) => handleUpload(section, feature.key, file)}
                  onRemove={() => handleRemove(section, feature.key)}
                  isUploading={uploadingKey === `${section}-${feature.key}`}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
