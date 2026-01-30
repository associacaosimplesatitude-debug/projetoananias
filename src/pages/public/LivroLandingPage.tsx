import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ShoppingCart } from "lucide-react";

import {
  HeroSection,
  AboutBookSection,
  DiferenciaisSection,
  AboutAuthorSection,
  SpecsSection,
  VideoSection,
  FinalCTASection,
} from "@/components/landing-page";

// Import local assets for specific books
import capaLateral from "@/assets/livros/cativeiro-babilonico-lateral.webp";
import autorRonald from "@/assets/autores/ronald-gustavo.jpg";

interface Especificacoes {
  paginas?: number;
  formato?: string;
  acabamento?: string;
  categoria?: string;
  isbn?: string;
  sku?: string;
}

interface Livro {
  id: string;
  titulo: string;
  subtitulo: string | null;
  descricao: string | null;
  valor_capa: number;
  capa_url: string | null;
  especificacoes: Especificacoes | null;
  diferenciais: string[] | null;
}

interface Autor {
  id: string;
  nome_completo: string;
  foto_url: string | null;
  bio: string | null;
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

// Map slugs to local assets for books with custom imagery
const localAssets: Record<string, { capa?: string; autorFoto?: string }> = {
  "cativeiro-babilonico": {
    capa: capaLateral,
    autorFoto: autorRonald,
  },
};

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
      // Step 1: Fetch the affiliate link
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

      if (linkError) throw linkError;
      if (!linkData) throw new Error("Link não encontrado");

      // Step 2: Fetch the book by livro_id
      const { data: livroData, error: livroError } = await supabase
        .from("royalties_livros")
        .select(`
          id,
          titulo,
          subtitulo,
          descricao,
          valor_capa,
          capa_url,
          especificacoes,
          diferenciais
        `)
        .eq("id", linkData.livro_id)
        .single();

      if (livroError) throw livroError;

      // Step 3: Fetch the author by autor_id
      const { data: autorData, error: autorError } = await supabase
        .from("royalties_autores")
        .select(`
          id,
          nome_completo,
          foto_url,
          bio
        `)
        .eq("id", linkData.autor_id)
        .single();

      if (autorError) throw autorError;

      setPageData({
        link: linkData,
        livro: livroData as unknown as Livro,
        autor: autorData as unknown as Autor,
      });
    } catch (err: unknown) {
      console.error("[LP] Erro ao carregar página:", err);
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

    const url = new URL(pageData.link.link_externo);
    url.searchParams.set("utm_source", "autor");
    url.searchParams.set("utm_medium", "affiliate");
    url.searchParams.set("utm_campaign", pageData.link.codigo_afiliado);

    window.open(url.toString(), "_blank");
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
  const assets = slug ? localAssets[slug] : undefined;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-amber-700" />
            <span className="font-bold text-xl text-amber-900">Central Gospel</span>
          </div>
          <Button
            onClick={handleBuyClick}
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Comprar Agora
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <HeroSection
        titulo={livro.titulo}
        subtitulo={livro.subtitulo}
        capaUrl={livro.capa_url}
        capaLocalUrl={assets?.capa}
        preco={livro.valor_capa}
        onBuyClick={handleBuyClick}
      />

      {/* About Book Section */}
      <AboutBookSection descricao={link.descricao_lp || livro.descricao} />

      {/* Diferenciais Section */}
      <DiferenciaisSection diferenciais={livro.diferenciais} />

      {/* About Author Section */}
      <AboutAuthorSection
        nomeCompleto={autor.nome_completo}
        bio={autor.bio}
        fotoUrl={autor.foto_url}
        fotoLocalUrl={assets?.autorFoto}
      />

      {/* Specs Section */}
      <SpecsSection especificacoes={livro.especificacoes} preco={livro.valor_capa} />

      {/* Video Section */}
      <VideoSection videoUrl={link.video_url} />

      {/* Final CTA Section */}
      <FinalCTASection preco={livro.valor_capa} onBuyClick={handleBuyClick} />

      {/* Footer */}
      <footer className="bg-amber-950 text-amber-200 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">
            © {new Date().getFullYear()} Central Gospel. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
