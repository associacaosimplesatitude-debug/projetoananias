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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FAIXAS_ETARIAS } from "@/constants/ebdFaixasEtarias";

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
    categoria?: string | null;
    tipo_conteudo?: string | null;
    leitura_continua?: boolean;
    capitulos_obrigatorio?: boolean;
  } | null;
}

interface RevistaFormData {
  titulo: string;
  faixa_etaria_alvo: string;
  sinopse: string;
  autor: string;
  imagem_url: string;
  num_licoes: number;
  categoria: string;
  tipo_conteudo: string;
  leitura_continua: boolean;
  capitulos_obrigatorio: boolean;
}

interface Licao {
  id?: string;
  numero_licao: number;
  titulo_licao: string;
}

const CATEGORIAS = ["Aluno", "Professor", "Geral"] as const;
const TIPOS_CONTEUDO = [
  { value: "revista", label: "Revista EBD" },
  { value: "livro_digital", label: "Livro Digital" },
] as const;

export function RevistaDialog({ open, onOpenChange, revista }: RevistaDialogProps) {
  const queryClient = useQueryClient();
  const [licoes, setLicoes] = useState<Licao[]>([]);
  const [activeTab, setActiveTab] = useState("dados");

  const { register, handleSubmit, reset, watch, setValue } = useForm<RevistaFormData>({
    defaultValues: {
      titulo: "",
      faixa_etaria_alvo: "",
      sinopse: "",
      autor: "",
      imagem_url: "",
      num_licoes: 13,
      categoria: "Aluno",
      tipo_conteudo: "revista",
      leitura_continua: false,
      capitulos_obrigatorio: true,
    },
  });

  const numLicoes = watch("num_licoes");
  const tipoConteudo = watch("tipo_conteudo");
  const isLivroDigital = tipoConteudo === "livro_digital";

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
        categoria: revista.categoria || "Aluno",
        tipo_conteudo: (revista as any).tipo_conteudo || "revista",
        leitura_continua: (revista as any).leitura_continua || false,
        capitulos_obrigatorio: (revista as any).capitulos_obrigatorio ?? true,
      });
    } else {
      reset({
        titulo: "",
        faixa_etaria_alvo: "",
        sinopse: "",
        autor: "",
        imagem_url: "",
        num_licoes: 13,
        categoria: "Aluno",
        tipo_conteudo: "revista",
        leitura_continua: false,
        capitulos_obrigatorio: true,
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

  // When switching to livro_digital, auto-set related fields
  useEffect(() => {
    if (isLivroDigital) {
      setValue("leitura_continua", true);
      setValue("capitulos_obrigatorio", false);
    } else {
      setValue("leitura_continua", false);
      setValue("capitulos_obrigatorio", true);
    }
  }, [isLivroDigital, setValue]);

  const saveMutation = useMutation({
    mutationFn: async (data: RevistaFormData) => {
      const payload = {
        titulo: data.titulo,
        faixa_etaria_alvo: data.faixa_etaria_alvo,
        sinopse: data.sinopse,
        autor: data.autor,
        imagem_url: data.imagem_url,
        num_licoes: data.num_licoes,
        categoria: data.categoria,
        tipo_conteudo: data.tipo_conteudo,
        leitura_continua: data.leitura_continua,
        capitulos_obrigatorio: data.capitulos_obrigatorio,
      };

      if (revista) {
        const { error } = await supabase
          .from('ebd_revistas')
          .update(payload)
          .eq('id', revista.id);

        if (error) throw error;
        return revista.id;
      } else {
        const { data: newRevista, error } = await supabase
          .from('ebd_revistas')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        return newRevista.id;
      }
    },
    onSuccess: async (revistaId) => {
      // Salvar lições (apenas se não for livro digital ou se tiver lições preenchidas)
      const licoesData = licoes
        .filter(l => l.titulo_licao.trim() !== "")
        .map(l => ({
          revista_id: revistaId,
          numero_licao: l.numero_licao,
          titulo: l.titulo_licao,
          church_id: null,
          data_aula: '2000-01-01',
        }));

      if (licoesData.length > 0) {
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
            <TabsList className={`grid w-full ${isLivroDigital ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <TabsTrigger value="dados">Dados da Revista</TabsTrigger>
              {!isLivroDigital && (
                <TabsTrigger value="licoes">Lições ({numLicoes})</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="dados" className="space-y-4">
              {/* Row 1: Título */}
              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  {...register("titulo", { required: true })}
                  placeholder="Ex: Jovens e Adultos - 1º Trimestre 2025"
                />
              </div>

              {/* Row 2: Categoria + Tipo de Conteúdo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria *</Label>
                  <Select
                    value={watch("categoria")}
                    onValueChange={(value) => setValue("categoria", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Conteúdo *</Label>
                  <Select
                    value={watch("tipo_conteudo")}
                    onValueChange={(value) => setValue("tipo_conteudo", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_CONTEUDO.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: Faixa Etária + Autor */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="faixa_etaria_alvo">Faixa Etária Alvo *</Label>
                  <Select
                    value={watch("faixa_etaria_alvo")}
                    onValueChange={(value) => setValue("faixa_etaria_alvo", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a faixa etária" />
                    </SelectTrigger>
                    <SelectContent>
                      {FAIXAS_ETARIAS.map((faixa) => (
                        <SelectItem key={faixa} value={faixa}>
                          {faixa}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="autor">Autor</Label>
                  <Input
                    id="autor"
                    {...register("autor")}
                    placeholder="Nome do autor"
                  />
                </div>
              </div>

              {/* Row 4: Num Lições (conditional) */}
              {!isLivroDigital && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="num_licoes">Número de Lições</Label>
                    <Input
                      id="num_licoes"
                      type="number"
                      {...register("num_licoes", { valueAsNumber: true, min: 1, max: 52 })}
                    />
                  </div>
                </div>
              )}

              {isLivroDigital && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="num_licoes">Capítulos (opcional)</Label>
                    <Input
                      id="num_licoes"
                      type="number"
                      {...register("num_licoes", { valueAsNumber: true, min: 0, max: 100 })}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {/* Row 5: Imagem URL */}
              <div className="space-y-2">
                <Label htmlFor="imagem_url">URL da Imagem</Label>
                <Input
                  id="imagem_url"
                  {...register("imagem_url")}
                  placeholder="https://exemplo.com/capa-revista.jpg"
                />
              </div>

              {/* Row 6: Sinopse */}
              <div className="space-y-2">
                <Label htmlFor="sinopse">Sinopse</Label>
                <Textarea
                  id="sinopse"
                  {...register("sinopse")}
                  placeholder="Descrição da revista e seu conteúdo"
                  rows={4}
                />
              </div>

              {/* Info box for livro digital */}
              {isLivroDigital && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  <strong>Livro Digital:</strong> O conteúdo será exibido em modo de leitura contínua (PDF). 
                  Lições/capítulos não são obrigatórios.
                </div>
              )}
            </TabsContent>

            {!isLivroDigital && (
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
            )}
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
