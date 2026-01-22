import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Download } from "lucide-react";
import { useRef } from "react";

interface QRCodeCadastroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  churchName?: string;
}

export function QRCodeCadastroDialog({ 
  open, 
  onOpenChange, 
  churchId,
  churchName 
}: QRCodeCadastroDialogProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const registrationUrl = `${window.location.origin}/cadastro-aluno/${churchId}`;

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 500;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Desenhar QR Code centralizado
      ctx.drawImage(img, 50, 50, 300, 300);
      
      // Adicionar texto
      ctx.fillStyle = "black";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Cadastro EBD", 200, 400);
      ctx.font = "14px Arial";
      ctx.fillText(churchName || "Escaneie para se cadastrar", 200, 430);

      // Download
      const link = document.createElement("a");
      link.download = "qrcode-cadastro-ebd.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code de Cadastro</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          <div ref={qrRef} className="bg-white p-4 rounded-lg border">
            <QRCodeSVG 
              value={registrationUrl} 
              size={250}
              level="H"
              includeMargin
            />
          </div>
          
          <p className="text-sm text-muted-foreground text-center">
            Escaneie este QR Code para acessar o formulário de cadastro
          </p>
          
          <Button 
            onClick={handleDownload} 
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Baixar Imagem
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
