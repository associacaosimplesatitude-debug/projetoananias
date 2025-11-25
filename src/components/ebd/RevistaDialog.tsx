import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";

interface RevistaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revista?: {
    id: string;
    titulo: string;
    faixa_etaria_alvo: string;
    sinopse: string | null;
    autor: string | null;
    imagem_url: string | null;
    num_licoes: number;
  } | null;
}

interface RevistaFormData {
  titulo: string;
  faixa_etaria_alvo: string;
  sinopse: string;
  autor: string;
  imagem_url: string;
  num_licoes: number;
}

interface Licao {
  id?: string;
  numero_licao: number;
  titulo_licao: string;
}

export function RevistaDialog({ open, onOpenChange, revista }: RevistaDialogProps) {
  const queryClient = useQueryClient();
  const [licoes, setLicoes] = useState<Licao[]>([]);
  const [activeTab, setActiveTab] = useState("dados");

  const { register, handleSubmit, reset, watch } = useForm<RevistaFormData>({
    defaultValues: {
      titulo: "",
      faixa_etaria_alvo: "",
      sinopse: "",
      autor: "",
      imagem_url: "",
      num_licoes: 13,
    },
  });

  const numLicoes = watch("num_licoes");

  const { data: licoesExistentes } = useQuery({
    queryKey: ['ebd-licoes', revista?.id],
    queryFn: async () => {
      if (!revista?.id) return [];
      const { data, error } = await supabase
        .from('ebd_licoes')
        .select('*')
        .eq('revista_id', revista.id)
        .order('numero_licao');

      if (error) throw error;
      return data;
    },
    enabled: !!revista?.id && open,
  });

  useEffect(() => {
    if (revista) {
      reset({
        titulo: revista.titulo,
        faixa_etaria_alvo: revista.faixa_etaria_alvo,
        sinopse: revista.sinopse || "",
        autor: revista.autor || "",
        imagem_url: revista.imagem_url || "",
        num_licoes: revista.num_licoes,
      });
    } else {
      reset({
        titulo: "",
        faixa_etaria_alvo: "",
        sinopse: "",
        autor: "",
        imagem_url: "",
        num_licoes: 13,
      });
    }
  }, [revista, reset]);

  useEffect(() => {
    if (licoesExistentes && licoesExistentes.length > 0) {
      setLicoes(licoesExistentes.map(l => ({
        id: l.id,
        numero_licao: l.numero_licao || 0,
        titulo_licao: l.titulo || "",
      })));
    } else if (!revista) {
      const newLicoes = Array.from({ length: numLicoes }, (_, i) => ({
        numero_licao: i + 1,
        titulo_licao: "",
      }));
      setLicoes(newLicoes);
    }
  }, [licoesExistentes, numLicoes, revista]);

  const saveMutation = useMutation({
    mutationFn: async (data: RevistaFormData) => {
      if (revista) {
        const { error } = await supabase
          .from('ebd_revistas')
          .update(data)
          .eq('id', revista.id);

        if (error) throw error;
        return revista.id;
      } else {
        const { data: newRevista, error } = await supabase
          .from('ebd_revistas')
          .insert([data])
          .select()
          .single();

        if (error) throw error;
        return newRevista.id;
      }
    },
    onSuccess: async (revistaId) => {
      // Salvar lições
      const licoesData = licoes
        .filter(l => l.titulo_licao.trim() !== "")
        .map(l => ({
          revista_id: revistaId,
          numero_licao: l.numero_licao,
          titulo: l.titulo_licao,
          church_id: null, // NULL para lições de revistas globais
          data_aula: '2000-01-01', // Data padrão para lições de revista
        }));

      if (licoesData.length > 0) {
        // Deletar lições antigas se for edição
        if (revista?.id) {
          await supabase
            .from('ebd_licoes')
            .delete()
            .eq('revista_id', revista.id);
        }

        const { error: licoesError } = await supabase
          .from('ebd_licoes')
          .insert(licoesData);

        if (licoesError) throw licoesError;
      }

      queryClient.invalidateQueries({ queryKey: ['ebd-revistas'] });
      queryClient.invalidateQueries({ queryKey: ['ebd-licoes'] });
      toast.success(revista ? 'Revista atualizada com sucesso!' : 'Revista cadastrada com sucesso!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro ao salvar revista');
      console.error(error);
    },
  });

  const handleLicaoChange = (index: number, value: string) => {
    const newLicoes = [...licoes];
    newLicoes[index].titulo_licao = value;
    setLicoes(newLicoes);
  };

  const onSubmit = (data: RevistaFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{revista ? 'Editar Revista' : 'Nova Revista'}</DialogTitle>
          <DialogDescription>
            Preencha os dados da revista e cadastre as lições
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dados">Dados da Revista</TabsTrigger>
              <TabsTrigger value="licoes">Lições ({numLicoes})</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="titulo">Título *</Label>
                  <Input
                    id="titulo"
                    {...register("titulo", { required: true })}
                    placeholder="Ex: Jovens e Adultos - 1º Trimestre 2025"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="faixa_etaria_alvo">Faixa Etária Alvo *</Label>
                  <Input
                    id="faixa_etaria_alvo"
                    {...register("faixa_etaria_alvo", { required: true })}
                    placeholder="Ex: Jovens e Adultos"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="autor">Autor</Label>
                  <Input
                    id="autor"
                    {...register("autor")}
                    placeholder="Nome do autor"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="num_licoes">Número de Lições</Label>
                  <Input
                    id="num_licoes"
                    type="number"
                    {...register("num_licoes", { valueAsNumber: true, min: 1, max: 52 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="imagem_url">URL da Imagem</Label>
                <Input
                  id="imagem_url"
                  {...register("imagem_url")}
                  placeholder="https://exemplo.com/capa-revista.jpg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sinopse">Sinopse</Label>
                <Textarea
                  id="sinopse"
                  {...register("sinopse")}
                  placeholder="Descrição da revista e seu conteúdo"
                  rows={4}
                />
              </div>
            </TabsContent>

            <TabsContent value="licoes" className="space-y-4">
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {licoes.map((licao, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <span className="text-sm font-medium w-8">
                      {licao.numero_licao}.
                    </span>
                    <Input
                      value={licao.titulo_licao}
                      onChange={(e) => handleLicaoChange(index, e.target.value)}
                      placeholder={`Título da lição ${licao.numero_licao}`}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
