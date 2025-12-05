import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Loader2, Filter } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ParsedProduto {
  titulo: string;
  faixa_etaria_alvo: string;
  autor: string | null;
  imagem_url: string | null;
  sinopse: string | null;
  num_licoes: number;
  licoes: { numero_licao: number; titulo: string }[];
  preco_cheio: number;
  estoque: number;
  categoria: string;
}

interface ImportXMLDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CATEGORIAS = [
  "Revista EBD",
  "Livros",
  "Devocionais",
  "Infantil",
  "Kits",
  "Infográficos",
  "Outros"
];

export function ImportXMLDialog({ open, onOpenChange, onSuccess }: ImportXMLDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedProdutos, setParsedProdutos] = useState<ParsedProduto[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importAllProducts, setImportAllProducts] = useState(true);
  const [filterCategoria, setFilterCategoria] = useState<string>("all");

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

  const detectCategoria = (title: string, description: string): string => {
    const searchText = `${title} ${description}`.toLowerCase();
    
    if (searchText.includes("revista ebd") || searchText.includes("estudo bíblico") || searchText.includes("estudo biblico")) {
      return "Revista EBD";
    }
    if (searchText.includes("devocional")) {
      return "Devocionais";
    }
    if (searchText.includes("infantil") || searchText.includes("criança") || searchText.includes("kids")) {
      return "Infantil";
    }
    if (searchText.includes("kit ")) {
      return "Kits";
    }
    if (searchText.includes("infográfico") || searchText.includes("infografico")) {
      return "Infográficos";
    }
    if (searchText.includes("livro") || searchText.includes("book")) {
      return "Livros";
    }
    return "Outros";
  };

  const detectFaixaEtaria = (title: string, description: string, productType: string): string => {
    const searchText = `${title} ${description} ${productType}`.toLowerCase();
    
    if (searchText.includes("adulto") || searchText.includes("jovens e adultos")) {
      return "Jovens e Adultos";
    }
    // Check for specific adolescent age ranges first
    if (searchText.includes("15 a 17") || searchText.includes("15-17") || searchText.includes("adolescentes+")) {
      return "Adolescentes+: 15 a 17 Anos";
    }
    if (searchText.includes("12 a 14") || searchText.includes("12-14")) {
      return "Adolescentes: 12 a 14 Anos";
    }
    // Generic adolescent check
    if (searchText.includes("adolescente") || searchText.includes("teen")) {
      return "Adolescentes: 12 a 14 Anos";
    }
    if (searchText.includes("juvenis") || searchText.includes("juvenil")) {
      return "Juvenis";
    }
    if (searchText.includes("pré-adolescente") || searchText.includes("pre-adolescente")) {
      return "Pré-Adolescentes";
    }
    if (searchText.includes("juniores") || searchText.includes("junior") || searchText.includes("9 a 11") || searchText.includes("9-11")) {
      return "Juniores: 9 a 11 Anos";
    }
    if (searchText.includes("primários") || searchText.includes("primarios") || searchText.includes("7 a 8") || searchText.includes("7-8")) {
      return "Primários: 7 a 8 Anos";
    }
    if (searchText.includes("jardim de infância") || searchText.includes("jardim de infancia") || searchText.includes("4 a 6") || searchText.includes("4-6")) {
      return "Jardim de Infância: 4 a 6 Anos";
    }
    if (searchText.includes("maternal") || searchText.includes("berçário") || searchText.includes("bercario") || searchText.includes("2 a 3") || searchText.includes("2-3")) {
      return "Maternal: 2 a 3 Anos";
    }
    if (searchText.includes("infantil") || searchText.includes("criança")) {
      return "Infantil";
    }
    return "Geral";
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
      const produtos: ParsedProduto[] = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        // Pegar campos com namespace g: (Google Shopping)
        const title = entry.getElementsByTagName("g:title")[0]?.textContent || "";
        const description = entry.getElementsByTagName("g:description")[0]?.textContent || "";
        const productType = entry.getElementsByTagName("g:product_type")[0]?.textContent || "";
        const imageLink = entry.getElementsByTagName("g:image_link")[0]?.textContent || null;

        // Se não importar todos, verificar se é uma revista EBD
        if (!importAllProducts) {
          const searchText = `${title} ${description}`.toLowerCase();
          const isRevistaEBD = searchText.includes("revista") || searchText.includes("ebd");
          if (!isRevistaEBD) continue;
        }

        // Extrair autor da descrição
        let autor: string | null = null;
        const autorMatch = description.match(/(?:Autor|Author|Por|Sobre o Autor|Sobre a autora):\s*([^.\n\r]+)/i);
        if (autorMatch) {
          autor = autorMatch[1].trim().substring(0, 100);
        }

        // Extrair preço
        let preco = 0;
        const priceElement = entry.getElementsByTagName("g:price")[0];
        const salePriceElement = entry.getElementsByTagName("g:sale_price")[0];
        const priceToUse = salePriceElement || priceElement;
        if (priceToUse) {
          const priceText = priceToUse.textContent || '';
          const priceMatch = priceText.match(/[\d.,]+/);
          if (priceMatch) {
            preco = parseFloat(priceMatch[0].replace(',', '.'));
          }
        }

        // Extrair estoque
        let estoque = 0;
        const stockElement = entry.getElementsByTagName("g:sell_on_google_quantity")[0];
        if (stockElement) {
          estoque = parseInt(stockElement.textContent || '0', 10);
        }

        // Detectar categoria e faixa etária
        const categoria = detectCategoria(title, description);
        const faixaEtaria = detectFaixaEtaria(title, description, productType);

        // Extrair títulos das lições (para revistas EBD)
        const licoes: { numero_licao: number; titulo: string }[] = [];
        const titulosMatch = description.match(/Títulos das Lições:([\s\S]*?)(?:Sobre o Autor:|Especificação|ISBN:|Sobre a autora:|$)/i);
        
        if (titulosMatch) {
          const titulosTexto = titulosMatch[1];
          const linhas = titulosTexto
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 3 && !l.match(/^\d+\.?\s*$/) && !l.match(/^&#xD;$/));
          
          linhas.forEach((linha, index) => {
            if (linha && index < 13) {
              licoes.push({
                numero_licao: index + 1,
                titulo: linha.substring(0, 200)
              });
            }
          });
        }

        // Limpar sinopse
        let sinopse = description
          .replace(/&#xD;/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
          .substring(0, 2000);

        produtos.push({
          titulo: title.substring(0, 255),
          faixa_etaria_alvo: faixaEtaria,
          autor,
          imagem_url: imageLink,
          sinopse,
          num_licoes: licoes.length || (categoria === "Revista EBD" ? 13 : 0),
          licoes,
          preco_cheio: preco,
          estoque,
          categoria
        });
      }

      if (produtos.length === 0) {
        toast.warning('Nenhum produto encontrado no arquivo XML');
      } else {
        setParsedProdutos(produtos);
        setSelectedIndices(new Set(produtos.map((_, idx) => idx)));
        toast.success(`${produtos.length} produto(s) encontrado(s)`);
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
    const filteredIndices = getFilteredIndices();
    const allSelected = filteredIndices.every(idx => selectedIndices.has(idx));
    
    const newSelected = new Set(selectedIndices);
    if (allSelected) {
      filteredIndices.forEach(idx => newSelected.delete(idx));
    } else {
      filteredIndices.forEach(idx => newSelected.add(idx));
    }
    setSelectedIndices(newSelected);
  };

  const getFilteredIndices = (): number[] => {
    return parsedProdutos
      .map((produto, index) => ({ produto, index }))
      .filter(({ produto }) => filterCategoria === "all" || produto.categoria === filterCategoria)
      .map(({ index }) => index);
  };

  const filteredProdutos = parsedProdutos.filter(
    (produto) => filterCategoria === "all" || produto.categoria === filterCategoria
  );

  const handleImport = async () => {
    const selectedProdutos = parsedProdutos.filter((_, idx) => selectedIndices.has(idx));
    
    if (selectedProdutos.length === 0) {
      toast.error('Selecione pelo menos um produto para importar');
      return;
    }

    setIsImporting(true);
    let totalImportados = 0;
    let totalLicoesImportadas = 0;
    let erros = 0;
    
    try {
      for (const produto of selectedProdutos) {
        const { licoes, ...produtoData } = produto;
        
        // Verificar se já existe por título
        const { data: existente } = await supabase
          .from('ebd_revistas')
          .select('id')
          .eq('titulo', produto.titulo)
          .maybeSingle();

        if (existente) {
          console.log(`Produto "${produto.titulo}" já existe, pulando...`);
          continue;
        }
        
        const { data: produtoInserido, error: produtoError } = await supabase
          .from('ebd_revistas')
          .insert(produtoData)
          .select()
          .single();

        if (produtoError) {
          console.error('Erro ao inserir produto:', produtoError);
          erros++;
          continue;
        }

        totalImportados++;

        // Inserir lições se houver
        if (licoes && licoes.length > 0 && produtoInserido) {
          const licoesParaInserir = licoes.map(licao => ({
            revista_id: produtoInserido.id,
            titulo: licao.titulo,
            numero_licao: licao.numero_licao,
            data_aula: new Date().toISOString().split('T')[0],
            church_id: null
          }));

          const { data: licoesInseridas, error: licoesError } = await supabase
            .from('ebd_licoes')
            .insert(licoesParaInserir)
            .select();

          if (licoesError) {
            console.error('Erro ao inserir lições:', licoesError);
          } else {
            totalLicoesImportadas += licoesInseridas?.length || 0;
          }
        }
      }

      if (totalImportados > 0) {
        toast.success(`${totalImportados} produto(s) e ${totalLicoesImportadas} lição(ões) importados! ${erros > 0 ? `(${erros} erros)` : ''}`);
        onSuccess();
        handleClose();
      } else {
        toast.warning('Nenhum produto novo foi importado (já existem ou houve erros)');
      }
    } catch (error) {
      console.error('Erro ao importar produtos:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao importar produtos');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedProdutos([]);
    setSelectedIndices(new Set());
    setFilterCategoria("all");
    onOpenChange(false);
  };

  const categoriaCounts = parsedProdutos.reduce((acc, produto) => {
    acc[produto.categoria] = (acc[produto.categoria] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Produtos do XML</DialogTitle>
        </DialogHeader>

        {parsedProdutos.length === 0 ? (
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

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Switch
                  id="import-all"
                  checked={importAllProducts}
                  onCheckedChange={setImportAllProducts}
                />
                <Label htmlFor="import-all">
                  Importar todos os produtos (não apenas revistas EBD)
                </Label>
              </div>
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
          <div className="flex flex-col flex-1 min-h-0 space-y-4">
            {/* Header com filtros e ações */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={getFilteredIndices().every(idx => selectedIndices.has(idx))}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="font-medium text-sm">
                    {selectedIndices.size}/{parsedProdutos.length} selecionados
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas ({parsedProdutos.length})</SelectItem>
                      {Object.entries(categoriaCounts).map(([cat, count]) => (
                        <SelectItem key={cat} value={cat}>
                          {cat} ({count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                  `Importar ${selectedIndices.size} produto(s)`
                )}
              </Button>
            </div>

            {/* Lista de produtos */}
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
                {filteredProdutos.map((produto) => {
                  const originalIndex = parsedProdutos.indexOf(produto);
                  return (
                    <Card 
                      key={originalIndex} 
                      className={`cursor-pointer transition-colors ${selectedIndices.has(originalIndex) ? 'border-primary ring-1 ring-primary' : 'hover:border-muted-foreground/50'}`}
                      onClick={() => toggleSelection(originalIndex)}
                    >
                      <CardContent className="p-3">
                        <div className="flex gap-3">
                          <Checkbox
                            checked={selectedIndices.has(originalIndex)}
                            onCheckedChange={() => toggleSelection(originalIndex)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            {produto.imagem_url && (
                              <img
                                src={produto.imagem_url}
                                alt={produto.titulo}
                                className="w-full h-24 object-cover rounded mb-2"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <h3 className="font-semibold text-xs line-clamp-2 mb-1">
                              {produto.titulo}
                            </h3>
                            <div className="flex flex-wrap gap-1 mb-1">
                              <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                                {produto.categoria}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                                {produto.faixa_etaria_alvo}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                              <span>R$ {produto.preco_cheio.toFixed(2)}</span>
                              <span>Est: {produto.estoque}</span>
                            </div>
                            {produto.licoes.length > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {produto.licoes.length} lições
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
