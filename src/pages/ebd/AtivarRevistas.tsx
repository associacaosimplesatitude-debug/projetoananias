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

  // Buscar produtos da Shopify
  const { data: produtos, isLoading } = useQuery({
    queryKey: ['shopify-products-revistas'],
    queryFn: () => fetchShopifyProducts(250),
  });

  // Filtrar apenas revistas de aluno (excluir kit professor)
  const revistasAluno = produtos?.filter(produto => {
    const title = produto.node.title.toLowerCase();
    const isRevista = title.includes('revista') || title.includes('ebd');
    const isProfessor = title.includes('professor') || title.includes('kit');
    return isRevista && !isProfessor;
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
