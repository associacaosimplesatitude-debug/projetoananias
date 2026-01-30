import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, ShoppingCart, BookOpen, User } from "lucide-react";

interface Livro {
  id: string;
  titulo: string;
  descricao: string | null;
  valor_capa: number;
  capa_url: string | null;
}

interface Autor {
  id: string;
  nome_completo: string;
}

interface AffiliateLink {
  id: string;
  slug: string;
  codigo_afiliado: string;
  link_externo: string;
  video_url: string | null;
  descricao_lp: string | null;
  comissao_percentual: number;
  livro_id: string;
  autor_id: string;
}

interface PageData {
  link: AffiliateLink;
  livro: Livro;
  autor: Autor;
}

export default function LivroLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadPageData();
      trackClick();
    }
  }, [slug]);

  const loadPageData = async () => {
    try {
      // Step 1: Fetch the affiliate link (without embed)
      const { data: linkData, error: linkError } = await supabase
        .from("royalties_affiliate_links")
        .select(`
          id,
          slug,
          codigo_afiliado,
          link_externo,
          video_url,
          descricao_lp,
          comissao_percentual,
          livro_id,
          autor_id
        `)
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (linkError) {
        console.error("[LP] Erro ao buscar link de afiliado:", linkError.code, linkError.message);
        throw linkError;
      }

      if (!linkData) {
        console.error("[LP] Link não encontrado para slug:", slug);
        throw new Error("Link não encontrado");
      }

      // Step 2: Fetch the book by livro_id
      const { data: livroData, error: livroError } = await supabase
        .from("royalties_livros")
        .select(`
          id,
          titulo,
          descricao,
          valor_capa,
          capa_url
        `)
        .eq("id", linkData.livro_id)
        .single();

      if (livroError) {
        console.error("[LP] Erro ao buscar livro:", livroError.code, livroError.message);
        throw livroError;
      }

      // Step 3: Fetch the author by autor_id
      const { data: autorData, error: autorError } = await supabase
        .from("royalties_autores")
        .select(`
          id,
          nome_completo
        `)
        .eq("id", linkData.autor_id)
        .single();

      if (autorError) {
        console.error("[LP] Erro ao buscar autor:", autorError.code, autorError.message);
        throw autorError;
      }

      setPageData({
        link: linkData,
        livro: livroData,
        autor: autorData,
      });
    } catch (err: any) {
      console.error("[LP] Erro geral ao carregar página:", err);
      setError("Livro não encontrado");
    } finally {
      setLoading(false);
    }
  };

  const trackClick = async () => {
    try {
      await supabase.functions.invoke("track-affiliate-click", {
        body: {
          slug,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
        },
      });
    } catch (err) {
      console.error("[LP] Erro ao rastrear clique:", err);
    }
  };

  const handleBuyClick = () => {
    if (!pageData) return;

    // Build URL with UTM parameters for tracking
    const url = new URL(pageData.link.link_externo);
    url.searchParams.set("utm_source", "autor");
    url.searchParams.set("utm_medium", "affiliate");
    url.searchParams.set("utm_campaign", pageData.link.codigo_afiliado);

    window.open(url.toString(), "_blank");
  };

  const extractYouTubeId = (url: string | null): string | null => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-48 mb-8" />
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-[3/4] w-full max-w-md" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-12 w-48" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Livro não encontrado</h1>
          <p className="text-muted-foreground">O link que você acessou não está disponível.</p>
        </div>
      </div>
    );
  }

  const { link, livro, autor } = pageData;
  const videoId = extractYouTubeId(link.video_url);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <span className="font-bold text-xl text-primary">Central Gospel</span>
          </div>
          <Button onClick={handleBuyClick} className="bg-green-600 hover:bg-green-700">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Comprar Agora
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Book Cover */}
          <div className="flex justify-center">
            <div className="relative">
              {livro.capa_url ? (
                <img
                  src={livro.capa_url}
                  alt={livro.titulo}
                  className="max-w-sm w-full rounded-lg shadow-2xl"
                />
              ) : (
                <div className="w-80 h-[480px] bg-gradient-to-br from-primary/20 to-primary/40 rounded-lg flex items-center justify-center">
                  <BookOpen className="h-24 w-24 text-primary/50" />
                </div>
              )}
              <div className="absolute -bottom-4 -right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
                <span className="text-sm">Por apenas</span>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(livro.valor_capa)}
                </p>
              </div>
            </div>
          </div>

          {/* Book Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">{livro.titulo}</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Autor</p>
                <p className="font-semibold">{autor.nome_completo}</p>
              </div>
            </div>

            <Button
              size="lg"
              onClick={handleBuyClick}
              className="bg-green-600 hover:bg-green-700 text-lg px-8 py-6"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Comprar Agora
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Video Section */}
      {videoId && (
        <section className="bg-white py-12">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-center mb-8">Conheça o Livro</h2>
            <div className="max-w-4xl mx-auto">
              <div className="aspect-video rounded-xl overflow-hidden shadow-xl">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title="Vídeo do Livro"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* About Book Section */}
      {(livro.descricao || link.descricao_lp) && (
        <section className="container mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold mb-6">Sobre o Livro</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-muted-foreground whitespace-pre-line">
              {link.descricao_lp || livro.descricao}
            </p>
          </div>
        </section>
      )}

      {/* About Author Section */}
      <section className="bg-white py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8">Sobre o Autor</h2>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-shrink-0">
              <div className="h-40 w-40 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-20 w-20 text-primary/50" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-4">{autor.nome_completo}</h3>
              <p className="text-muted-foreground italic">
                Autor publicado pela Central Gospel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-green-600 to-green-700 py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Adquira seu exemplar agora!
          </h2>
          <p className="text-green-100 mb-8 text-lg">
            Garanta já o seu e mergulhe nesta leitura inspiradora.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={handleBuyClick}
            className="text-lg px-8 py-6"
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Comprar por{" "}
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(livro.valor_capa)}
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">
            © {new Date().getFullYear()} Central Gospel. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
