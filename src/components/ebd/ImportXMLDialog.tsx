import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

interface ParsedRevista {
  titulo: string;
  faixa_etaria_alvo: string;
  autor: string | null;
  imagem_url: string | null;
  sinopse: string | null;
  num_licoes: number;
}

interface ImportXMLDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportXMLDialog({ open, onOpenChange, onSuccess }: ImportXMLDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedRevistas, setParsedRevistas] = useState<ParsedRevista[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xml')) {
        toast.error('Por favor, selecione um arquivo XML');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleProcessXML = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");

      const items = xmlDoc.getElementsByTagName("item");
      const revistas: ParsedRevista[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const title = item.getElementsByTagName("title")[0]?.textContent || "";
        const description = item.getElementsByTagName("description")[0]?.textContent || "";
        const link = item.getElementsByTagName("link")[0]?.textContent || "";
        const productType = item.getElementsByTagNameNS("*", "product_type")[0]?.textContent || "";
        const imageLink = item.getElementsByTagNameNS("*", "image_link")[0]?.textContent || null;

        // Verificar se é uma revista EBD procurando por "REVISTA" ou "EBD" (case-insensitive)
        const searchText = `${title} ${description} ${link}`.toLowerCase();
        const isRevistaEBD = searchText.includes("revista") || searchText.includes("ebd");

        if (isRevistaEBD) {
          // Extrair autor da descrição (tentativa básica)
          let autor: string | null = null;
          const autorMatch = description.match(/(?:Autor|Author|Por):\s*([^.\n]+)/i);
          if (autorMatch) {
            autor = autorMatch[1].trim();
          }

          revistas.push({
            titulo: title,
            faixa_etaria_alvo: productType,
            autor,
            imagem_url: imageLink,
            sinopse: description,
            num_licoes: 13
          });
        }
      }

      if (revistas.length === 0) {
        toast.warning('Nenhuma revista EBD encontrada no arquivo XML');
      } else {
        setParsedRevistas(revistas);
        setSelectedIndices(new Set(revistas.map((_, idx) => idx)));
        toast.success(`${revistas.length} revista(s) encontrada(s)`);
      }
    } catch (error) {
      console.error('Erro ao processar XML:', error);
      toast.error('Erro ao processar o arquivo XML');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === parsedRevistas.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(parsedRevistas.map((_, idx) => idx)));
    }
  };

  const handleImport = async () => {
    const selectedRevistas = parsedRevistas.filter((_, idx) => selectedIndices.has(idx));
    
    if (selectedRevistas.length === 0) {
      toast.error('Selecione pelo menos uma revista para importar');
      return;
    }

    setIsImporting(true);
    try {
      const { error } = await supabase
        .from('ebd_revistas')
        .insert(selectedRevistas);

      if (error) throw error;

      toast.success(`${selectedRevistas.length} revista(s) importada(s) com sucesso!`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Erro ao importar revistas:', error);
      toast.error('Erro ao importar revistas');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedRevistas([]);
    setSelectedIndices(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Revistas do XML</DialogTitle>
        </DialogHeader>

        {parsedRevistas.length === 0 ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <Input
                type="file"
                accept=".xml"
                onChange={handleFileChange}
                className="max-w-sm mx-auto"
              />
              {file && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Arquivo selecionado: {file.name}
                </p>
              )}
            </div>

            <Button
              onClick={handleProcessXML}
              disabled={!file || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando XML...
                </>
              ) : (
                'Processar Arquivo'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIndices.size === parsedRevistas.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="font-medium">
                  Selecionar Todas ({selectedIndices.size}/{parsedRevistas.length})
                </span>
              </div>
              <Button
                onClick={handleImport}
                disabled={selectedIndices.size === 0 || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  `Confirmar Importação (${selectedIndices.size})`
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parsedRevistas.map((revista, index) => (
                <Card key={index} className={selectedIndices.has(index) ? 'border-primary' : ''}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <Checkbox
                        checked={selectedIndices.has(index)}
                        onCheckedChange={() => toggleSelection(index)}
                      />
                      <div className="flex-1">
                        {revista.imagem_url && (
                          <img
                            src={revista.imagem_url}
                            alt={revista.titulo}
                            className="w-full h-32 object-cover rounded mb-2"
                          />
                        )}
                        <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                          {revista.titulo}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {revista.faixa_etaria_alvo}
                        </p>
                        {revista.autor && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Autor: {revista.autor}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
