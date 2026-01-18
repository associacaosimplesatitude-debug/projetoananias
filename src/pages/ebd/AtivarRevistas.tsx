import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchShopifyProducts, ShopifyProduct } from "@/lib/shopify";
import { RevistaVitrine } from "@/components/ebd/ativar-revistas/RevistaVitrine";
import { RevistaAtivar } from "@/components/ebd/ativar-revistas/RevistaAtivar";
import { RevistaEscalaConfig } from "@/components/ebd/ativar-revistas/RevistaEscalaConfig";
import { useAuth } from "@/hooks/useAuth";

export interface RevistaConfig {
  produto: ShopifyProduct;
  turmaId?: string;
  turmaNome?: string;
  diaSemana?: string;
  dataInicio?: Date;
  configurada: boolean;
}

type PersistedRevistaConfig = {
  productId: string;
  turmaId?: string;
  turmaNome?: string;
  diaSemana?: string;
  dataInicio?: string; // ISO
  configurada: boolean;
};

export default function AtivarRevistas() {
  const [activeTab, setActiveTab] = useState("vitrine");
  const [revistasSelecionadas, setRevistasSelecionadas] = useState<ShopifyProduct[]>([]);
  const [revistasConfiguradas, setRevistasConfiguradas] = useState<RevistaConfig[]>([]);
  const { user } = useAuth();

  const storageKey = useMemo(() => {
    // fallback para não perder seleção mesmo se user ainda não carregou
    const uid = user?.id ?? "anon";
    return `ebd:ativar-revistas:${uid}`;
  }, [user?.id]);

  const persistState = (configs: RevistaConfig[]) => {
    try {
      const payload: PersistedRevistaConfig[] = configs.map((c) => ({
        productId: c.produto.node.id,
        turmaId: c.turmaId,
        turmaNome: c.turmaNome,
        diaSemana: c.diaSemana,
        dataInicio: c.dataInicio ? c.dataInicio.toISOString() : undefined,
        configurada: c.configurada,
      }));
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // silêncio: localStorage pode falhar em modo privado
    }
  };

  // Buscar produtos da Shopify (500 para garantir que todas revistas sejam carregadas)
  const { data: produtos, isLoading } = useQuery({
    queryKey: ["shopify-products-revistas-all"],
    queryFn: () => fetchShopifyProducts(500),
  });

  // Filtrar apenas revistas de aluno (excluir kit professor, livros de apoio, infográficos)
  const revistasAluno =
    produtos?.filter((produto) => {
      const title = produto.node.title.toLowerCase();

      // Deve ser uma revista EBD
      const isRevista =
        title.includes("revista") ||
        (title.includes("estudo") && title.includes("bíblico")) ||
        (title.includes("estudo") && title.includes("biblico")) ||
        title.includes("ebd");

      // Excluir materiais de professor e outros
      const isProfessor = title.includes("professor");
      const isKit = title.includes("kit");
      const isLivroApoio = title.includes("livro de apoio") || title.includes("livro apoio");
      const isInfografico = title.includes("infográfico") || title.includes("infografico");
      const isRecurso = title.includes("recurso didático") || title.includes("recurso didatico");

      // Deve conter "aluno" ou não ser nenhuma das exclusões
      const isAluno = title.includes("aluno");

      return isRevista && !isProfessor && !isKit && !isLivroApoio && !isInfografico && !isRecurso && isAluno;
    }) || [];

  // Restaurar seleção/configurações salvas (mesmo se o usuário sair da página e voltar)
  useEffect(() => {
    if (!revistasAluno.length) return;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;

      const persisted = JSON.parse(raw) as PersistedRevistaConfig[];
      if (!Array.isArray(persisted) || persisted.length === 0) return;

      const byId = new Map(revistasAluno.map((p) => [p.node.id, p]));

      const restoredConfigs: RevistaConfig[] = persisted
        .map((p) => {
          const produto = byId.get(p.productId);
          if (!produto) return null;
          return {
            produto,
            turmaId: p.turmaId,
            turmaNome: p.turmaNome,
            diaSemana: p.diaSemana,
            dataInicio: p.dataInicio ? new Date(p.dataInicio) : undefined,
            configurada: !!p.configurada,
          } satisfies RevistaConfig;
        })
        .filter(Boolean) as RevistaConfig[];

      if (restoredConfigs.length) {
        setRevistasConfiguradas(restoredConfigs);
        setRevistasSelecionadas(restoredConfigs.map((c) => c.produto));
      }
    } catch {
      // se payload estiver corrompido, ignora
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revistasAluno.length, storageKey]);

  const handleSelecionarRevista = (produto: ShopifyProduct) => {
    const jaExiste = revistasSelecionadas.some((r) => r.node.id === produto.node.id);

    if (jaExiste) {
      const nextSelecionadas = revistasSelecionadas.filter((r) => r.node.id !== produto.node.id);
      const nextConfigs = revistasConfiguradas.filter((r) => r.produto.node.id !== produto.node.id);
      setRevistasSelecionadas(nextSelecionadas);
      setRevistasConfiguradas(nextConfigs);
      persistState(nextConfigs);
      return;
    }

    // A partir do momento que seleciona na vitrine, já aparece na aba "Ativar" como pendente
    const nextSelecionadas = [...revistasSelecionadas, produto];
    const nextConfigs: RevistaConfig[] = [
      ...revistasConfiguradas,
      {
        produto,
        configurada: false,
      },
    ];

    setRevistasSelecionadas(nextSelecionadas);
    setRevistasConfiguradas(nextConfigs);
    persistState(nextConfigs);
  };

  const handleAtivarRevistas = () => {
    // Agora o botão só navega para a aba "Ativar" (os itens já ficam salvos ao selecionar)
    setActiveTab("ativar");
  };

  const handleConfigurarRevista = (produtoId: string, config: Partial<RevistaConfig>) => {
    setRevistasConfiguradas((prev) => {
      const next = prev.map((r) => (r.produto.node.id === produtoId ? { ...r, ...config, configurada: true } : r));
      persistState(next);
      return next;
    });
  };

  const handleRemoverRevista = (produtoId: string) => {
    setRevistasConfiguradas((prev) => {
      const next = prev.filter((r) => r.produto.node.id !== produtoId);
      persistState(next);
      return next;
    });
    setRevistasSelecionadas((prev) => prev.filter((r) => r.node.id !== produtoId));
  };

  const handleIrParaEscala = () => {
    setActiveTab("escala");
  };

  const todasConfiguradas = revistasConfiguradas.length > 0 && revistasConfiguradas.every((r) => r.configurada);

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
          <TabsTrigger value="ativar">
            Ativar {revistasConfiguradas.length > 0 && `(${revistasConfiguradas.length})`}
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
