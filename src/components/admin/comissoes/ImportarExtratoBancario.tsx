import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import * as pdfjsLib from "pdfjs-dist";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface TituloExtrato {
  sacado: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string;
  numero_titulo: string;
}

interface ParcelaPendente {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  valor: number;
  data_vencimento: string;
  comissao_status: string;
  numero_parcela: number;
  total_parcelas: number;
  valor_comissao: number;
}

interface MatchResult {
  titulo: TituloExtrato;
  parcelas: ParcelaPendente[];
  selectedParcelaId: string | null;
  checked: boolean;
}

interface ImportarExtratoBancarioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parcelas: Array<{
    id: string;
    cliente_id: string;
    valor: number;
    data_vencimento: string;
    comissao_status: string;
    numero_parcela: number;
    total_parcelas: number;
    valor_comissao: number;
    status: string;
  }>;
  clienteMap: Map<string, string>;
}

export function ImportarExtratoBancario({ open, onOpenChange, parcelas, clienteMap }: ImportarExtratoBancarioProps) {
  const queryClient = useQueryClient();
  const [banco, setBanco] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [step, setStep] = useState<"upload" | "preview">("upload");

  const reset = useCallback(() => {
    setBanco("");
    setFile(null);
    setProcessing(false);
    setConfirming(false);
    setMatches([]);
    setStep("upload");
  }, []);

  const handleClose = useCallback((open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  }, [onOpenChange, reset]);

  const pdfToImageBase64 = async (file: File): Promise<string[]> => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const images: string[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/png");
      images.push(dataUrl.split(",")[1]);
    }
    
    return images;
  };

  const findMatches = (titulos: TituloExtrato[]): MatchResult[] => {
    const pendentes = parcelas.filter(
      p => p.comissao_status === "pendente" || p.comissao_status === "agendada"
    );

    return titulos.map(titulo => {
      const matched = pendentes.filter(p => {
        const diffValor = Math.abs(Number(p.valor) - titulo.valor);
        const mesmoVencimento = p.data_vencimento === titulo.data_vencimento;
        return diffValor <= 0.01 && mesmoVencimento;
      }).map(p => ({
        ...p,
        cliente_nome: clienteMap.get(p.cliente_id) || "Desconhecido",
      }));

      return {
        titulo,
        parcelas: matched,
        selectedParcelaId: matched.length === 1 ? matched[0].id : null,
        checked: matched.length === 1,
      };
    });
  };

  const handleUpload = async () => {
    if (!file || !banco) {
      toast.error("Selecione o banco e o arquivo PDF");
      return;
    }

    setProcessing(true);
    try {
      const images = await pdfToImageBase64(file);
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // Send all pages as separate images
      const response = await supabase.functions.invoke("parse-bank-statement", {
        body: { images_base64: images, banco },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao processar PDF");
      }

      const data = response.data;
      if (!data?.titulos || !Array.isArray(data.titulos)) {
        throw new Error("Resposta inválida da IA - nenhum título encontrado");
      }

      toast.success(`${data.titulos.length} títulos extraídos do extrato`);
      
      const matchResults = findMatches(data.titulos);
      setMatches(matchResults);
      setStep("preview");
    } catch (error: any) {
      console.error("Erro ao processar extrato:", error);
      toast.error(error.message || "Erro ao processar extrato bancário");
    } finally {
      setProcessing(false);
    }
  };

  const toggleMatch = (index: number, checked: boolean) => {
    setMatches(prev => prev.map((m, i) => i === index ? { ...m, checked } : m));
  };

  const selectParcela = (index: number, parcelaId: string) => {
    setMatches(prev => prev.map((m, i) => 
      i === index ? { ...m, selectedParcelaId: parcelaId, checked: true } : m
    ));
  };

  const handleConfirm = async () => {
    const toUpdate = matches.filter(m => m.checked && m.selectedParcelaId);
    if (toUpdate.length === 0) {
      toast.error("Nenhuma parcela selecionada para baixa");
      return;
    }

    setConfirming(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const match of toUpdate) {
        const { error } = await supabase
          .from("vendedor_propostas_parcelas")
          .update({
            status: "paga",
            comissao_status: "liberada",
            data_liberacao: new Date().toISOString().split("T")[0],
            data_pagamento: match.titulo.data_pagamento || new Date().toISOString().split("T")[0],
          })
          .eq("id", match.selectedParcelaId!);

        if (error) {
          console.error("Erro ao atualizar parcela:", error);
          errorCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} parcela(s) atualizada(s) com sucesso!`);
        queryClient.invalidateQueries({ queryKey: ["admin-comissoes-parcelas"] });
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} parcela(s) com erro na atualização`);
      }

      handleClose(false);
    } catch (error: any) {
      console.error("Erro ao confirmar baixas:", error);
      toast.error("Erro ao confirmar baixas");
    } finally {
      setConfirming(false);
    }
  };

  const totalMatched = matches.filter(m => m.parcelas.length > 0).length;
  const totalUnmatched = matches.filter(m => m.parcelas.length === 0).length;
  const totalSelected = matches.filter(m => m.checked && m.selectedParcelaId).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Extrato Bancário
          </DialogTitle>
          <DialogDescription>
            Faça upload do PDF de títulos liquidados para dar baixa automática nas parcelas pendentes.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Banco</label>
              <Select value={banco} onValueChange={setBanco}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="santander">Santander</SelectItem>
                  <SelectItem value="delta">Delta</SelectItem>
                  <SelectItem value="credifort">Credifort</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Arquivo PDF</label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm">{file.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Clique para selecionar o PDF do extrato
                    </p>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpload} disabled={!file || !banco || processing}>
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Processar Extrato
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {totalMatched} com match
              </Badge>
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {totalUnmatched} sem match
              </Badge>
              <Badge variant="outline">
                {totalSelected} selecionada(s) para baixa
              </Badge>
            </div>

            <div className="border rounded-lg overflow-auto max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Sacado (Extrato)</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Dt. Pagamento</TableHead>
                    <TableHead>Cliente (Sistema)</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match, index) => (
                    <TableRow
                      key={index}
                      className={match.parcelas.length === 0 ? "bg-red-50" : match.checked ? "bg-green-50" : ""}
                    >
                      <TableCell>
                        {match.parcelas.length > 0 && (
                          <Checkbox
                            checked={match.checked}
                            onCheckedChange={(checked) => toggleMatch(index, !!checked)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-xs max-w-[200px] truncate">
                        {match.titulo.sacado}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        R$ {match.titulo.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {match.titulo.data_vencimento ? formatDate(match.titulo.data_vencimento) : "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {match.titulo.data_pagamento ? formatDate(match.titulo.data_pagamento) : "-"}
                      </TableCell>
                      <TableCell>
                        {match.parcelas.length === 0 ? (
                          <span className="text-red-500 text-xs">Sem match</span>
                        ) : match.parcelas.length === 1 ? (
                          <span className="text-green-700 text-xs">{match.parcelas[0].cliente_nome}</span>
                        ) : (
                          <Select
                            value={match.selectedParcelaId || ""}
                            onValueChange={(v) => selectParcela(index, v)}
                          >
                            <SelectTrigger className="h-7 text-xs w-[180px]">
                              <SelectValue placeholder="Múltiplos matches" />
                            </SelectTrigger>
                            <SelectContent>
                              {match.parcelas.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.cliente_nome} - {p.numero_parcela}/{p.total_parcelas}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {match.parcelas.length === 1 && (
                          <span className="text-xs text-muted-foreground">
                            {match.parcelas[0].numero_parcela}/{match.parcelas[0].total_parcelas}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {match.parcelas.length === 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Não encontrado
                          </Badge>
                        ) : match.parcelas.length > 1 ? (
                          <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-300">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Múltiplos
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Match
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setStep("upload"); setMatches([]); }}>
                Voltar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={totalSelected === 0 || confirming}
              >
                {confirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar Baixa ({totalSelected})
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}
