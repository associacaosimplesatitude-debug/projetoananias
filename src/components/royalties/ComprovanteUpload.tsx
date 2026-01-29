import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileText, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ComprovanteUploadProps {
  pagamentoId: string;
  currentUrl?: string | null;
  onUpload: (url: string) => void;
  onRemove?: () => void;
  readOnly?: boolean;
}

export function ComprovanteUpload({
  pagamentoId,
  currentUrl,
  onUpload,
  onRemove,
  readOnly = false,
}: ComprovanteUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 10MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${pagamentoId}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage (private bucket)
      const { error: uploadError } = await supabase.storage
        .from("royalties-comprovantes")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Store the path (not public URL since bucket is private)
      onUpload(fileName);
      
      toast({ title: "Comprovante enviado com sucesso!" });
    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast({
        title: "Erro no upload",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!currentUrl) return;

    setDownloading(true);

    try {
      const { data, error } = await supabase.storage
        .from("royalties-comprovantes")
        .download(currentUrl);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprovante-${pagamentoId}.${currentUrl.split(".").pop()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Erro no download:", error);
      toast({
        title: "Erro ao baixar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentUrl) return;

    try {
      const { error } = await supabase.storage
        .from("royalties-comprovantes")
        .remove([currentUrl]);

      if (error) throw error;

      onRemove?.();
      toast({ title: "Comprovante removido!" });
    } catch (error: any) {
      console.error("Erro ao remover:", error);
      toast({
        title: "Erro ao remover",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  if (readOnly) {
    return currentUrl ? (
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        Baixar Comprovante
      </Button>
    ) : (
      <span className="text-sm text-muted-foreground">Sem comprovante</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleFileChange}
        className="hidden"
        disabled={uploading}
      />

      {currentUrl ? (
        <>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Comprovante anexado</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {uploading ? "Enviando..." : "Anexar Comprovante"}
        </Button>
      )}
    </div>
  );
}
