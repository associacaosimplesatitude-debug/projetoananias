import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

export default function LivroDigitalLeitura() {
  const { revistaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [numPages, setNumPages] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const { data: revista } = useQuery({
    queryKey: ["revista-digital-info", revistaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("revistas_digitais")
        .select("pdf_url, titulo")
        .eq("id", revistaId!)
        .maybeSingle();
      return data;
    },
    enabled: !!revistaId,
  });

  const { data: storagePdfUrl } = useQuery({
    queryKey: ["revista-pdf-completo", revistaId],
    queryFn: async () => {
      const { data: listData } = await supabase.storage.from("revistas").list(revistaId!, {
        search: "completo.pdf",
      });
      if (listData && listData.length > 0) {
        const path = `${revistaId}/completo.pdf`;
        const { data } = supabase.storage.from("revistas").getPublicUrl(path);
        return data.publicUrl;
      }
      return null;
    },
    enabled: !!revistaId,
  });

  // Buscar imagens de páginas como fallback
  const { data: paginasImagens, isLoading: isLoadingImagens } = useQuery({
    queryKey: ["revista-paginas-imagens", revistaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("revista_licoes")
        .select("paginas")
        .eq("revista_id", revistaId!)
        .eq("numero", 1)
        .maybeSingle();
      const paginas = (data?.paginas as string[]) || [];
      return paginas.length > 0 ? paginas : null;
    },
    enabled: !!revistaId,
  });

  const pdfUrl = revista?.pdf_url || storagePdfUrl || null;
  const watermarkText = cliente?.nome_igreja || user?.email || "";
  const titulo = revista?.titulo || "Livro Digital";

  // Mobile: NUNCA usar PDF (react-pdf falha com PDFs grandes no Safari/iOS)
  const isMobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const hasImages = !!paginasImagens && paginasImagens.length > 0;

  const usePdf = isMobile ? false : !!pdfUrl;
  const useImages = isMobile ? hasImages : (!usePdf && hasImages);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
  }, []);

  // No mobile, aguardar query de imagens antes de decidir
  if (isMobile && isLoadingImagens) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center select-none">
        <p className="text-white/60 text-sm">Carregando páginas...</p>
      </div>
    );
  }

  if (!usePdf && !useImages) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center select-none">
        <p className="text-white/60 text-sm mb-4">Conteúdo ainda não disponível.</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-white hover:bg-white/10">
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col select-none" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 backdrop-blur shrink-0">
        <span className="text-white font-medium text-sm truncate">{titulo}</span>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10 shrink-0">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto" ref={containerRef}>
        {usePdf ? (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center py-20">
                <span className="text-white/60 text-sm">Carregando PDF...</span>
              </div>
            }
            error={
              <div className="flex items-center justify-center py-20">
                <span className="text-white/60 text-sm">Erro ao carregar o PDF.</span>
              </div>
            }
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div key={i} className="relative flex justify-center">
                <Page
                  pageNumber={i + 1}
                  width={containerWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
                {watermarkText && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                    <span className="text-white/[0.07] text-4xl font-bold whitespace-nowrap rotate-[-30deg] select-none">
                      {watermarkText}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </Document>
        ) : (
          /* Modo imagens - scroll contínuo */
          paginasImagens!.map((url, i) => (
            <div key={i} className="relative flex justify-center">
              <img
                src={url}
                alt={`Página ${i + 1}`}
                className="w-full max-w-full"
                loading="lazy"
                draggable={false}
              />
              {watermarkText && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                  <span className="text-white/[0.07] text-4xl font-bold whitespace-nowrap rotate-[-30deg] select-none">
                    {watermarkText}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
