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
  licoes: { numero_licao: number; titulo: string }[];
  preco_cheio: number;
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

      // Google Shopping feed usa <entry> ao invés de <item>
      const entries = xmlDoc.getElementsByTagName("entry");
      const revistas: ParsedRevista[] = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        // Pegar campos com namespace g: (Google Shopping)
        const title = entry.getElementsByTagName("g:title")[0]?.textContent || "";
        const description = entry.getElementsByTagName("g:description")[0]?.textContent || "";
        const link = entry.getElementsByTagName("g:link")[0]?.textContent || "";
        const productType = entry.getElementsByTagName("g:product_type")[0]?.textContent || "";
        const imageLink = entry.getElementsByTagName("g:image_link")[0]?.textContent || null;

        // Verificar se é uma revista EBD procurando por "REVISTA" ou "EBD" (case-insensitive)
        const searchText = `${title} ${description} ${link}`.toLowerCase();
        const isRevistaEBD = searchText.includes("revista") || searchText.includes("ebd");

        if (isRevistaEBD) {
          // Extrair autor da descrição (tentativa básica)
          let autor: string | null = null;
          const autorMatch = description.match(/(?:Autor|Author|Por|Sobre o Autor):\s*([^.\n]+)/i);
          if (autorMatch) {
            autor = autorMatch[1].trim();
          }

          // Extrair preço
          let preco = 0;
          const priceElement = entry.getElementsByTagName("g:price")[0] || entry.getElementsByTagName("price")[0];
          if (priceElement) {
            const priceText = priceElement.textContent || '';
            const priceMatch = priceText.match(/[\d.,]+/);
            if (priceMatch) {
              preco = parseFloat(priceMatch[0].replace(',', '.'));
            }
          }

          // Extrair títulos das lições
          const licoes: { numero_licao: number; titulo: string }[] = [];
          const titulosMatch = description.match(/Títulos das Lições:([\s\S]*?)(?:Sobre o Autor:|Especificação|ISBN:|$)/i);
          
          if (titulosMatch) {
            const titulosTexto = titulosMatch[1];
            // Separar por linhas e filtrar linhas vazias
            const linhas = titulosTexto
              .split('\n')
              .map(l => l.trim())
              .filter(l => l.length > 0 && !l.match(/^\d+\.?\s*$/)); // Remove linhas que são só números
            
            linhas.forEach((linha, index) => {
              if (linha) {
                licoes.push({
                  numero_licao: index + 1,
                  titulo: linha
                });
              }
            });
          }

          revistas.push({
            titulo: title,
            faixa_etaria_alvo: productType || "Não especificado",
            autor,
            imagem_url: imageLink,
            sinopse: description,
            num_licoes: licoes.length || 13,
            licoes,
            preco_cheio: preco
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
    let totalLicoesImportadas = 0;
    
    try {
      // Inserir revistas
      for (const revista of selectedRevistas) {
        const { licoes, ...revistaData } = revista;
        
        const { data: revistaInserida, error: revistaError } = await supabase
          .from('ebd_revistas')
          .insert(revistaData)
          .select()
          .single();

        if (revistaError) {
          console.error('Erro ao inserir revista:', revistaError);
          throw new Error(`Erro ao importar revista "${revista.titulo}": ${revistaError.message}`);
        }

        // Inserir lições se houver
        if (licoes && licoes.length > 0 && revistaInserida) {
          const licoesParaInserir = licoes.map(licao => ({
            revista_id: revistaInserida.id,
            titulo: licao.titulo,
            numero_licao: licao.numero_licao,
            data_aula: new Date().toISOString().split('T')[0], // Data placeholder
            church_id: null // Lições globais
          }));

          const { data: licoesInseridas, error: licoesError } = await supabase
            .from('ebd_licoes')
            .insert(licoesParaInserir)
            .select();

          if (licoesError) {
            console.error('Erro ao inserir lições:', licoesError);
            toast.error(`Erro ao importar lições da revista "${revista.titulo}": ${licoesError.message}`);
          } else {
            totalLicoesImportadas += licoesInseridas?.length || 0;
          }
        }
      }

      toast.success(`${selectedRevistas.length} revista(s) e ${totalLicoesImportadas} lição(ões) importadas com sucesso!`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Erro ao importar revistas:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao importar revistas');
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
                        {revista.licoes && revista.licoes.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {revista.licoes.length} lições encontradas
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
