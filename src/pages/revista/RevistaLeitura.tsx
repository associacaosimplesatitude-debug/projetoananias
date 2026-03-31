import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, LogOut, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RevistaDigital {
  id: string;
  titulo: string;
  capa_url: string | null;
  total_licoes: number | null;
  tipo: string | null;
}

interface Licenca {
  id: string;
  revista_id: string;
  nome_comprador: string;
  expira_em: string | null;
  revistas_digitais: RevistaDigital | null;
}

interface Licao {
  id: string;
  titulo: string;
  numero: number;
  conteudo: string | null;
}

export default function RevistaLeitura() {
  const navigate = useNavigate();
  const [licencas, setLicencas] = useState<Licenca[]>([]);
  const [nomeComprador, setNomeComprador] = useState("");
  const [selectedRevista, setSelectedRevista] = useState<string | null>(null);
  const [licoes, setLicoes] = useState<Licao[]>([]);
  const [loadingLicoes, setLoadingLicoes] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("revista_token");
    if (!token) {
      navigate("/revista/acesso", { replace: true });
      return;
    }
    try {
      const decoded = JSON.parse(atob(token));
      if (decoded.exp < Date.now()) {
        sessionStorage.removeItem("revista_token");
        sessionStorage.removeItem("revista_licencas");
        navigate("/revista/acesso", { replace: true });
        return;
      }
    } catch {
      navigate("/revista/acesso", { replace: true });
      return;
    }

    const stored = sessionStorage.getItem("revista_licencas");
    if (stored) {
      const parsed = JSON.parse(stored) as Licenca[];
      setLicencas(parsed);
      if (parsed.length > 0) {
        setNomeComprador(parsed[0].nome_comprador || "");
      }
      if (parsed.length === 1 && parsed[0].revista_id) {
        setSelectedRevista(parsed[0].revista_id);
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (!selectedRevista) return;
    setLoadingLicoes(true);
    supabase
      .from("ebd_licoes" as any)
      .select("id, titulo, numero, conteudo")
      .eq("revista_id", selectedRevista)
      .order("numero", { ascending: true })
      .then(({ data }) => {
        setLicoes((data as any) || []);
        setLoadingLicoes(false);
      });
  }, [selectedRevista]);

  const handleLogout = () => {
    sessionStorage.removeItem("revista_token");
    sessionStorage.removeItem("revista_licencas");
    navigate("/revista/acesso", { replace: true });
  };

  const selectedLicenca = licencas.find(
    (l) => l.revista_id === selectedRevista
  );
  const revista = selectedLicenca?.revistas_digitais;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6" />
          <div>
            <p className="text-lg font-semibold">Revista Digital</p>
            {nomeComprador && (
              <p className="text-sm opacity-80">Olá, {nomeComprador}</p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10 text-base"
        >
          <LogOut className="h-5 w-5 mr-2" />
          Sair
        </Button>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Back button when viewing a specific revista */}
        {selectedRevista && licencas.length > 1 && (
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedRevista(null);
              setLicoes([]);
            }}
            className="mb-4 text-base"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Voltar às revistas
          </Button>
        )}

        {/* Multiple revistas - show grid */}
        {!selectedRevista && licencas.length > 1 && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-foreground">
              Suas Revistas
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {licencas.map((l) => (
                <Card
                  key={l.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                  onClick={() => setSelectedRevista(l.revista_id)}
                >
                  {l.revistas_digitais?.capa_url && (
                    <img
                      src={l.revistas_digitais.capa_url}
                      alt={l.revistas_digitais.titulo}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <CardContent className="p-5">
                    <h2 className="text-lg font-semibold">
                      {l.revistas_digitais?.titulo || "Revista"}
                    </h2>
                    <Button className="w-full mt-3 h-12 text-base">Ler</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Single revista or selected revista - show lessons */}
        {selectedRevista && (
          <div className="space-y-6">
            {revista?.capa_url && (
              <div className="flex justify-center">
                <img
                  src={revista.capa_url}
                  alt={revista.titulo}
                  className="max-w-xs rounded-lg shadow-md"
                />
              </div>
            )}
            <h1 className="text-2xl font-bold text-center text-foreground">
              {revista?.titulo || "Revista"}
            </h1>

            {loadingLicoes ? (
              <p className="text-center text-lg text-muted-foreground">
                Carregando lições...
              </p>
            ) : licoes.length === 0 ? (
              <p className="text-center text-lg text-muted-foreground">
                Nenhuma lição disponível no momento.
              </p>
            ) : (
              <div className="space-y-3">
                {licoes.map((licao) => (
                  <Card key={licao.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold">
                          Lição {licao.numero}
                        </p>
                        <p className="text-base text-muted-foreground">
                          {licao.titulo}
                        </p>
                      </div>
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* No licencas */}
        {licencas.length === 0 && (
          <div className="text-center space-y-4 py-12">
            <p className="text-lg text-muted-foreground">
              Nenhuma revista encontrada.
            </p>
            <Button onClick={handleLogout} className="h-12 text-base">
              Voltar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
