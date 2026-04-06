import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function LivroDigitalLeitura() {
  const { revistaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: cliente } = useQuery({
    queryKey: ["meu-cliente-continua", user?.id],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja")
        .eq("email_superintendente", user.email)
        .maybeSingle();
      if (!data) {
        const { data: aluno } = await supabase
          .from("ebd_alunos")
          .select("church_id")
          .eq("user_id", user!.id)
          .eq("is_active", true)
          .maybeSingle();
        if (aluno) return { id: aluno.church_id, nome_igreja: "" };
      }
      return data;
    },
    enabled: !!user,
  });

  // Check if a complete PDF exists in storage
  const { data: pdfUrl } = useQuery({
    queryKey: ["revista-pdf-completo", revistaId],
    queryFn: async () => {
      const path = `${revistaId}/completo.pdf`;
      // Try to get public URL - if file exists it will work
      const { data: listData } = await supabase.storage.from("revistas").list(revistaId!, {
        search: "completo.pdf",
      });
      if (listData && listData.length > 0) {
        const { data } = supabase.storage.from("revistas").getPublicUrl(path);
        return data.publicUrl;
      }
      return null;
    },
    enabled: !!revistaId,
  });

  const { data: licoes } = useQuery({
    queryKey: ["all-licoes-continua", revistaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("revista_licoes")
        .select("*, revista:revistas_digitais(titulo)")
        .eq("revista_id", revistaId!)
        .order("numero");
      return data || [];
    },
    enabled: !!revistaId && !pdfUrl,
  });

  const watermarkText = cliente?.nome_igreja || user?.email || "";
  const revistaTitulo = (licoes?.[0] as any)?.revista?.titulo || "Revista";

  // If PDF exists, show it in an iframe with watermark overlay
  if (pdfUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col select-none" onContextMenu={(e) => e.preventDefault()}>
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 backdrop-blur shrink-0">
          <span className="text-white font-medium text-sm truncate">Leitura Contínua</span>
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10 shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 relative">
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0`}
            className="w-full h-full border-0"
            title="Revista PDF"
          />
          {watermarkText && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
              <span className="text-white/[0.07] text-5xl font-bold whitespace-nowrap rotate-[-30deg] select-none">
                {watermarkText}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback: show lesson images in continuous scroll
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col select-none" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 backdrop-blur shrink-0">
        <span className="text-white font-medium text-sm truncate">{revistaTitulo} — Leitura Contínua</span>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10 shrink-0">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {licoes?.map((licao: any) => {
          const paginas = (licao.paginas as string[]) || [];
          if (paginas.length === 0) return null;
          return (
            <div key={licao.id} className="mb-8">
              <div className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur px-4 py-2 border-b border-white/10">
                <span className="text-orange-400 font-semibold text-sm">Lição {licao.numero}</span>
                <span className="text-white/60 text-sm ml-2">{licao.titulo || ""}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                {paginas.map((url: string, i: number) => (
                  <div key={i} className="relative w-full max-w-3xl mx-auto">
                    <img
                      src={url}
                      alt={`Lição ${licao.numero} - Página ${i + 1}`}
                      className="w-full object-contain pointer-events-none"
                      draggable={false}
                    />
                    {watermarkText && (
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
                        <span className="text-white/[0.07] text-4xl font-bold whitespace-nowrap rotate-[-30deg] select-none">
                          {watermarkText}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}