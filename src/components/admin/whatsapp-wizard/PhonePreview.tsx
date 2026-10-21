import { ImageIcon, Link2, Reply } from "lucide-react";

export interface WizardButton {
  tipo: "QUICK_REPLY" | "URL";
  texto: string;
  url?: string;
  url_dinamica?: boolean;
}

interface PhonePreviewProps {
  cabecalhoTipo: string;
  cabecalhoTexto: string;
  imagemUrl: string | null;
  corpoPreview: string;
  rodape: string;
  botoes: WizardButton[];
}

/**
 * Preview ao vivo estilo tela de celular com balão do WhatsApp.
 * Reaproveita o visual do preview de WhatsAppTemplateCreator, com moldura de telefone.
 */
export default function PhonePreview({
  cabecalhoTipo,
  cabecalhoTexto,
  imagemUrl,
  corpoPreview,
  rodape,
  botoes,
}: PhonePreviewProps) {
  return (
    <div className="mx-auto w-full max-w-[300px]">
      {/* Moldura do celular */}
      <div className="rounded-[2rem] border-4 border-foreground/15 bg-[#e5ddd5] shadow-lg overflow-hidden">
        {/* Barra superior do "telefone" */}
        <div className="bg-[#075e54] px-4 py-2.5 flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-white/30 flex items-center justify-center text-white text-xs font-bold">
            CG
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold leading-tight truncate">Central Gospel</p>
            <p className="text-white/70 text-[10px] leading-tight">online</p>
          </div>
        </div>

        {/* Área da conversa */}
        <div className="p-3 min-h-[320px]">
          <div className="space-y-1.5">
            {/* Balão da mensagem */}
            <div className="bg-[#dcf8c6] rounded-lg shadow-sm relative overflow-hidden">
              {cabecalhoTipo === "IMAGE" && imagemUrl && (
                <img src={imagemUrl} alt="Imagem da mensagem" className="w-full h-auto" />
              )}
              {cabecalhoTipo === "IMAGE" && !imagemUrl && (
                <div className="w-full h-36 bg-gray-200 flex items-center justify-center">
                  <ImageIcon className="h-9 w-9 text-gray-400" />
                </div>
              )}

              <div className="p-3">
                {cabecalhoTipo === "TEXT" && cabecalhoTexto && (
                  <p className="text-sm font-bold text-gray-800 mb-1">{cabecalhoTexto}</p>
                )}
                <p className="text-sm whitespace-pre-wrap break-words text-gray-800">
                  {corpoPreview || "Sua mensagem aparecerá aqui..."}
                </p>
                {rodape && (
                  <p className="text-xs text-gray-500 mt-2 border-t border-gray-300 pt-1">{rodape}</p>
                )}
                <span className="text-[10px] text-gray-500 float-right mt-1">12:00 ✓✓</span>
              </div>
            </div>

            {/* Botões */}
            {botoes.length > 0 && (
              <div className="space-y-1">
                {botoes.map((btn, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-lg p-2 text-center text-sm text-[#00a5f4] font-medium shadow-sm border border-gray-200 flex items-center justify-center gap-1.5"
                  >
                    {btn.tipo === "URL" ? (
                      <Link2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Reply className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="truncate">{btn.texto || `Botão ${idx + 1}`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-2">
        Assim sua mensagem vai aparecer no WhatsApp
      </p>
    </div>
  );
}
