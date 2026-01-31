import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Plus,
  Search,
  Pencil,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { format, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ContratoDialog } from "@/components/royalties/ContratoDialog";

interface Contrato {
  id: string;
  pdf_url: string | null;
  data_inicio: string;
  data_termino: string;
  termos_contrato: string | null;
  is_active: boolean;
  created_at: string;
  autor: { id: string; nome_completo: string } | null;
  livro: { id: string; titulo: string } | null;
}

export default function Contratos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null);

  const { data: contratos, isLoading } = useQuery({
    queryKey: ["royalties-contratos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_contratos")
        .select(`
          id,
          pdf_url,
          data_inicio,
          data_termino,
          termos_contrato,
          is_active,
          created_at,
          autor:royalties_autores!autor_id (id, nome_completo),
          livro:royalties_livros!livro_id (id, titulo)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        autor: Array.isArray(item.autor) ? item.autor[0] : item.autor,
        livro: Array.isArray(item.livro) ? item.livro[0] : item.livro,
      })) as Contrato[];
    },
  });

  const filteredContratos = contratos?.filter(
    (contrato) =>
      contrato.autor?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contrato.livro?.titulo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusContrato = (dataInicio: string, dataTermino: string) => {
    const hoje = new Date();
    const inicio = new Date(dataInicio);
    const termino = new Date(dataTermino);

    if (isBefore(hoje, inicio)) {
      return { label: "Futuro", variant: "secondary" as const };
    }
    if (isAfter(hoje, termino)) {
      return { label: "Expirado", variant: "destructive" as const };
    }
    return { label: "Vigente", variant: "default" as const };
  };

  const handleEdit = (contrato: Contrato) => {
    setSelectedContrato(contrato);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedContrato(null);
    setDialogOpen(true);
  };

  const openPdf = (url: string) => {
    window.open(url, "_blank");
  };

  const contratosVigentes = contratos?.filter((c) => {
    const status = getStatusContrato(c.data_inicio, c.data_termino);
    return status.label === "Vigente";
  }).length || 0;

  const contratosExpirados = contratos?.filter((c) => {
    const status = getStatusContrato(c.data_inicio, c.data_termino);
    return status.label === "Expirado";
  }).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contratos</h1>
          <p className="text-muted-foreground">
            Gerencie os contratos dos autores e suas vigências.
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      <ContratoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contrato={selectedContrato}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Contratos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contratos?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos Vigentes</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{contratosVigentes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos Expirados</CardTitle>
            <Calendar className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{contratosExpirados}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por autor ou livro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Contratos</CardTitle>
          <CardDescription>
            {filteredContratos?.length || 0} contratos encontrados
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Autor</TableHead>
                <TableHead>Livro</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Término</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredContratos?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum contrato encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContratos?.map((contrato) => {
                  const status = getStatusContrato(contrato.data_inicio, contrato.data_termino);
                  return (
                    <TableRow key={contrato.id}>
                      <TableCell className="font-medium">
                        {contrato.autor?.nome_completo || "—"}
                      </TableCell>
                      <TableCell>{contrato.livro?.titulo || "—"}</TableCell>
                      <TableCell>
                        {format(new Date(contrato.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(contrato.data_termino), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {contrato.pdf_url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPdf(contrato.pdf_url!)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(contrato)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
