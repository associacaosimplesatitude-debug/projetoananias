import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Pencil, User, Mail, Phone, MapPin, CreditCard, BookOpen, DollarSign, Clock, CheckCircle, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCPFCNPJ } from "@/lib/royaltiesValidators";
import { AutorDialog } from "@/components/royalties/AutorDialog";

interface DadosBancarios {
  banco?: string;
  agencia?: string;
  conta?: string;
  tipo_conta?: string;
  pix?: string;
}

interface Autor {
  id: string;
  nome_completo: string;
  email: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  endereco: string | null;
  dados_bancarios: DadosBancarios | null;
  is_active: boolean;
  user_id: string | null;
}

export default function AutorDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Buscar dados do autor
  const { data: autor, isLoading: loadingAutor } = useQuery({
    queryKey: ["royalties-autor", id],
    queryFn: async (): Promise<Autor | null> => {
      const { data, error } = await supabase
        .from("royalties_autores")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      if (!data) return null;
      
      return {
        id: data.id,
        nome_completo: data.nome_completo,
        email: data.email,
        cpf_cnpj: data.cpf_cnpj,
        telefone: data.telefone,
        endereco: typeof data.endereco === 'string' ? data.endereco : null,
        dados_bancarios: data.dados_bancarios as DadosBancarios | null,
        is_active: data.is_active,
        user_id: data.user_id,
      };
    },
    enabled: !!id,
  });

  // Buscar livros do autor
  const { data: livros = [], isLoading: loadingLivros } = useQuery({
    queryKey: ["royalties-autor-livros", id],
    queryFn: async () => {
      // Buscar livros diretamente pelo autor_id
      const { data: livrosData, error: livrosError } = await supabase
        .from("royalties_livros")
        .select("id, titulo, descricao, capa_url, valor_capa")
        .eq("autor_id", id!)
        .eq("is_active", true);
      
      if (livrosError) throw livrosError;
      if (!livrosData || livrosData.length === 0) return [];

      // Para cada livro, buscar comissão e vendas
      const livrosComVendas = await Promise.all(
        livrosData.map(async (livro) => {
          // Buscar comissão do livro
          const { data: comissaoData } = await supabase
            .from("royalties_comissoes")
            .select("percentual")
            .eq("livro_id", livro.id)
            .maybeSingle();
          
          // Buscar vendas do livro
          const { data: vendas } = await supabase
            .from("royalties_vendas")
            .select("quantidade, valor_comissao_total")
            .eq("livro_id", livro.id);

          const totalVendas = vendas?.reduce((acc, v) => acc + (v.quantidade || 0), 0) || 0;
          const totalComissao = vendas?.reduce((acc, v) => acc + Number(v.valor_comissao_total || 0), 0) || 0;

          return {
            ...livro,
            percentual_autor: comissaoData?.percentual || 0,
            total_vendas: totalVendas,
            total_comissao: totalComissao,
          };
        })
      );

      return livrosComVendas;
    },
    enabled: !!id,
  });

  // Buscar pagamentos do autor
  const { data: pagamentos = [], isLoading: loadingPagamentos } = useQuery({
    queryKey: ["royalties-autor-pagamentos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_pagamentos")
        .select("*")
        .eq("autor_id", id)
        .order("data_prevista", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Calcular resumo financeiro
  const resumoFinanceiro = {
    totalLivros: livros.length,
    totalComissoes: livros.reduce((acc, l) => acc + (l.total_comissao || 0), 0),
    totalPago: pagamentos.filter(p => p.status === "pago").reduce((acc, p) => acc + Number(p.valor_total || 0), 0),
    totalPendente: pagamentos.filter(p => p.status === "pendente").reduce((acc, p) => acc + Number(p.valor_total || 0), 0),
  };

  const handleDownloadComprovante = async (pagamento: any) => {
    if (!pagamento.comprovante_url) return;
    
    const { data } = supabase.storage
      .from("royalties-comprovantes")
      .getPublicUrl(pagamento.comprovante_url);
    
    window.open(data.publicUrl, "_blank");
  };

  if (loadingAutor) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!autor) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/royalties/autores")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Autor não encontrado.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/royalties/autores")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{autor.nome_completo}</h1>
              <Badge variant={autor.is_active ? "default" : "secondary"}>
                {autor.is_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {autor.email}
              </span>
              {autor.cpf_cnpj && (
                <span className="flex items-center gap-1">
                  <CreditCard className="h-4 w-4" />
                  {formatCPFCNPJ(autor.cpf_cnpj)}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Resumo Financeiro */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Comissões</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(resumoFinanceiro.totalComissoes)}
            </div>
            <p className="text-xs text-muted-foreground">acumulado de todas as vendas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Já Pago</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(resumoFinanceiro.totalPago)}
            </div>
            <p className="text-xs text-muted-foreground">em pagamentos efetivados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(resumoFinanceiro.totalPendente)}
            </div>
            <p className="text-xs text-muted-foreground">a pagar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Livros</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumoFinanceiro.totalLivros}</div>
            <p className="text-xs text-muted-foreground">títulos cadastrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Informações de Contato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informações do Autor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              {autor.telefone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {autor.telefone}
                </div>
              )}
              {autor.endereco && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {autor.endereco}
                </div>
              )}
            </div>
            {autor.dados_bancarios && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Dados Bancários
                </h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  {autor.dados_bancarios.banco && <p>Banco: {autor.dados_bancarios.banco}</p>}
                  {autor.dados_bancarios.agencia && <p>Agência: {autor.dados_bancarios.agencia}</p>}
                  {autor.dados_bancarios.conta && (
                    <p>Conta: {autor.dados_bancarios.conta} ({autor.dados_bancarios.tipo_conta || 'corrente'})</p>
                  )}
                  {autor.dados_bancarios.pix && <p>PIX: {autor.dados_bancarios.pix}</p>}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Livros do Autor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Livros do Autor
          </CardTitle>
          <CardDescription>
            {loadingLivros ? "Carregando..." : `${livros.length} livros cadastrados`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLivros ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : livros.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum livro cadastrado para este autor.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Capa</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="text-right">Valor Capa</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {livros.map((livro: any) => (
                  <TableRow key={livro.id}>
                    <TableCell>
                      {livro.capa_url ? (
                        <img
                          src={supabase.storage.from("royalties-capas").getPublicUrl(livro.capa_url).data.publicUrl}
                          alt={livro.titulo}
                          className="w-10 h-14 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-muted rounded flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{livro.titulo}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {livro.valor_capa ? formatCurrency(livro.valor_capa) : "-"}
                    </TableCell>
                    <TableCell className="text-right">{livro.percentual_autor}%</TableCell>
                    <TableCell className="text-right">{livro.total_vendas} un.</TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {formatCurrency(livro.total_comissao)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Pagamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Histórico de Pagamentos
          </CardTitle>
          <CardDescription>
            {loadingPagamentos ? "Carregando..." : `${pagamentos.length} pagamentos registrados`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPagamentos ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : pagamentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum pagamento registrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Prevista</TableHead>
                  <TableHead>Data Efetivação</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Comprovante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentos.map((pagamento: any) => (
                  <TableRow key={pagamento.id}>
                    <TableCell>
                      {format(new Date(pagamento.data_prevista), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {pagamento.data_efetivacao
                        ? format(new Date(pagamento.data_efetivacao), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(pagamento.valor_total)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          pagamento.status === "pago"
                            ? "default"
                            : pagamento.status === "cancelado"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {pagamento.status === "pago"
                          ? "Pago"
                          : pagamento.status === "cancelado"
                          ? "Cancelado"
                          : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {pagamento.comprovante_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadComprovante(pagamento)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <AutorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        autor={autor ? {
          id: autor.id,
          nome_completo: autor.nome_completo,
          email: autor.email,
          cpf_cnpj: autor.cpf_cnpj,
          telefone: autor.telefone,
          endereco: autor.endereco,
          dados_bancarios: autor.dados_bancarios,
          is_active: autor.is_active,
          user_id: autor.user_id,
        } : null}
      />
    </div>
  );
}
