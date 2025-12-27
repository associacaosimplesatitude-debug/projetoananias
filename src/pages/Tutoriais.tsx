import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Video, PlayCircle } from "lucide-react";

type TutorialPerfil =
  | "VENDEDORES"
  | "GERENTES"
  | "FINANCEIRO"
  | "PROFESSORES"
  | "ALUNOS"
  | "SUPERINTENDENTES"
  | "ADMINISTRADOR_GERAL";

interface Tutorial {
  id: string;
  titulo: string;
  link_video: string;
  descricao: string | null;
  categorias: string[];
  tutoriais_perfis: { perfil: TutorialPerfil }[];
}

// Helper to extract YouTube video ID
function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// Helper to extract Vimeo video ID
function getVimeoId(url: string): string | null {
  const regExp = /vimeo\.com\/(\d+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

function VideoEmbed({ url }: { url: string }) {
  const youtubeId = getYouTubeId(url);
  const vimeoId = getVimeoId(url);

  if (youtubeId) {
    return (
      <iframe
        className="w-full aspect-video rounded-lg"
        src={`https://www.youtube.com/embed/${youtubeId}`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (vimeoId) {
    return (
      <iframe
        className="w-full aspect-video rounded-lg"
        src={`https://player.vimeo.com/video/${vimeoId}`}
        title="Vimeo video player"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }

  // Fallback: link to video
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center w-full aspect-video rounded-lg bg-muted hover:bg-muted/80 transition-colors"
    >
      <div className="text-center">
        <PlayCircle className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
        <span className="text-sm text-muted-foreground">Abrir vídeo</span>
      </div>
    </a>
  );
}

export default function Tutoriais() {
  const { user, role } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  // Determine user's profile for filtering
  const userPerfis = useMemo(() => {
    const perfis: TutorialPerfil[] = [];

    if (role === "admin") {
      perfis.push("ADMINISTRADOR_GERAL");
    }
    if (role === "gerente_ebd") {
      perfis.push("GERENTES");
    }
    if (role === "financeiro") {
      perfis.push("FINANCEIRO");
    }

    return perfis;
  }, [role]);

  // Check if user is vendedor
  const { data: isVendedor } = useQuery({
    queryKey: ["is-vendedor", user?.email],
    queryFn: async () => {
      if (!user?.email) return false;
      const { data } = await supabase
        .from("vendedores")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.email,
  });

  // Check if user is professor
  const { data: isProfessor } = useQuery({
    queryKey: ["is-professor", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("ebd_professores")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Check if user is aluno
  const { data: isAluno } = useQuery({
    queryKey: ["is-aluno", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("ebd_alunos")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Check if user is superintendente
  const { data: isSuperintendente } = useQuery({
    queryKey: ["is-superintendente", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("ebd_clientes")
        .select("id")
        .eq("superintendente_user_id", user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Build complete perfis list
  const allUserPerfis = useMemo(() => {
    const perfis = [...userPerfis];
    if (isVendedor) perfis.push("VENDEDORES");
    if (isProfessor) perfis.push("PROFESSORES");
    if (isAluno) perfis.push("ALUNOS");
    if (isSuperintendente) perfis.push("SUPERINTENDENTES");
    return perfis;
  }, [userPerfis, isVendedor, isProfessor, isAluno, isSuperintendente]);

  // Fetch tutorials
  const { data: tutoriais, isLoading } = useQuery({
    queryKey: ["tutoriais", allUserPerfis],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutoriais")
        .select("*, tutoriais_perfis(perfil)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter tutorials based on user's profiles
      const filtered = (data as Tutorial[]).filter((tutorial) =>
        tutorial.tutoriais_perfis.some((p) => allUserPerfis.includes(p.perfil))
      );

      return filtered;
    },
    enabled: allUserPerfis.length > 0,
  });

  // Filter by search term
  const filteredTutoriais = useMemo(() => {
    if (!tutoriais) return [];
    if (!searchTerm) return tutoriais;

    const term = searchTerm.toLowerCase();
    return tutoriais.filter(
      (t) =>
        t.titulo.toLowerCase().includes(term) ||
        t.descricao?.toLowerCase().includes(term)
    );
  }, [tutoriais, searchTerm]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tutoriais</h1>
        <p className="text-muted-foreground">
          Vídeos de treinamento e orientação
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou descrição..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredTutoriais.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm
                ? "Nenhum tutorial encontrado para sua busca"
                : "Nenhum tutorial disponível para seu perfil"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTutoriais.map((tutorial) => (
            <Card key={tutorial.id} className="overflow-hidden">
              <VideoEmbed url={tutorial.link_video} />
              <CardHeader className="pb-2">
                <CardTitle className="text-lg line-clamp-2">
                  {tutorial.titulo}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {tutorial.descricao && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {tutorial.descricao}
                  </p>
                )}
                {tutorial.categorias?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tutorial.categorias.map((cat) => (
                      <Badge key={cat} variant="secondary" className="text-xs">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
