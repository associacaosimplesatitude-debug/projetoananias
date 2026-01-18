import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchShopifyProducts, ShopifyProduct } from "@/lib/shopify";
import { RevistaVitrine } from "@/components/ebd/ativar-revistas/RevistaVitrine";
import { RevistaAtivar } from "@/components/ebd/ativar-revistas/RevistaAtivar";
import { RevistaEscalaConfig } from "@/components/ebd/ativar-revistas/RevistaEscalaConfig";

export interface RevistaConfig {
  produto: ShopifyProduct;
  turmaId?: string;
  turmaNome?: string;
  diaSemana?: string;
  dataInicio?: Date;
  configurada: boolean;
}

export default function AtivarRevistas() {
  const [activeTab, setActiveTab] = useState("vitrine");
  const [revistasSelecionadas, setRevistasSelecionadas] = useState<ShopifyProduct[]>([]);
  const [revistasConfiguradas, setRevistasConfiguradas] = useState<RevistaConfig[]>([]);

  // Buscar produtos da Shopify (500 para garantir que todas revistas sejam carregadas)
  const { data: produtos, isLoading } = useQuery({
    queryKey: ['shopify-products-revistas-all'],
    queryFn: () => fetchShopifyProducts(500),
  });

  // Filtrar apenas revistas de aluno (excluir kit professor, livros de apoio, infográficos)
  const revistasAluno = produtos?.filter(produto => {
    const title = produto.node.title.toLowerCase();
    
    // Deve ser uma revista EBD
    const isRevista = title.includes('revista') || 
                      (title.includes('estudo') && title.includes('bíblico')) ||
                      (title.includes('estudo') && title.includes('biblico')) ||
                      title.includes('ebd');
    
    // Excluir materiais de professor e outros
    const isProfessor = title.includes('professor');
    const isKit = title.includes('kit');
    const isLivroApoio = title.includes('livro de apoio') || title.includes('livro apoio');
    const isInfografico = title.includes('infográfico') || title.includes('infografico');
    const isRecurso = title.includes('recurso didático') || title.includes('recurso didatico');
    
    // Deve conter "aluno" ou não ser nenhuma das exclusões
    const isAluno = title.includes('aluno');
    
    return isRevista && !isProfessor && !isKit && !isLivroApoio && !isInfografico && !isRecurso && isAluno;
  }) || [];

  const handleSelecionarRevista = (produto: ShopifyProduct) => {
    const jaExiste = revistasSelecionadas.some(r => r.node.id === produto.node.id);
    if (jaExiste) {
      setRevistasSelecionadas(prev => prev.filter(r => r.node.id !== produto.node.id));
    } else {
      setRevistasSelecionadas(prev => [...prev, produto]);
    }
  };

  const handleAtivarRevistas = () => {
    const configs: RevistaConfig[] = revistasSelecionadas.map(produto => ({
      produto,
      configurada: false,
    }));
    setRevistasConfiguradas(configs);
    setActiveTab("ativar");
  };

  const handleConfigurarRevista = (produtoId: string, config: Partial<RevistaConfig>) => {
    setRevistasConfiguradas(prev => 
      prev.map(r => 
        r.produto.node.id === produtoId 
          ? { ...r, ...config, configurada: true }
          : r
      )
    );
  };

  const handleRemoverRevista = (produtoId: string) => {
    setRevistasConfiguradas(prev => prev.filter(r => r.produto.node.id !== produtoId));
    setRevistasSelecionadas(prev => prev.filter(r => r.node.id !== produtoId));
  };

  const handleIrParaEscala = () => {
    setActiveTab("escala");
  };

  const todasConfiguradas = revistasConfiguradas.length > 0 && 
    revistasConfiguradas.every(r => r.configurada);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ativar Revistas</h1>
        <p className="text-muted-foreground">
          Selecione as revistas para configurar turmas e escalas
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vitrine">Vitrine</TabsTrigger>
          <TabsTrigger value="ativar" disabled={revistasConfiguradas.length === 0}>
            Ativar ({revistasConfiguradas.length})
          </TabsTrigger>
          <TabsTrigger value="escala" disabled={!todasConfiguradas}>
            Montar Escala
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vitrine" className="space-y-4">
          <RevistaVitrine
            revistas={revistasAluno}
            revistasSelecionadas={revistasSelecionadas}
            onSelecionar={handleSelecionarRevista}
            onAtivar={handleAtivarRevistas}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="ativar" className="space-y-4">
          <RevistaAtivar
            revistas={revistasConfiguradas}
            onConfigurar={handleConfigurarRevista}
            onRemover={handleRemoverRevista}
            onIrParaEscala={handleIrParaEscala}
            todasConfiguradas={todasConfiguradas}
          />
        </TabsContent>

        <TabsContent value="escala" className="space-y-4">
          <RevistaEscalaConfig
            revistas={revistasConfiguradas.filter(r => r.configurada)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
