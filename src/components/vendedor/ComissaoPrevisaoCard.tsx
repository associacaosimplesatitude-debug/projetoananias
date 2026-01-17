import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, ChevronRight, DollarSign, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, isBefore, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface ComissaoPrevisaoCardProps {
  vendedorId: string;
  comissaoPercentual: number;
}

interface Parcela {
  id: string;
  proposta_id: string;
  vendedor_id: string;
  cliente_id: string;
  numero_parcela: number;
  total_parcelas: number;
  valor: number;
  valor_comissao: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  origem: string;
}

interface PrevisaoMes {
  mes: string;
  mesFormatado: string;
  valorTotal: number;
  comissao: number;
  quantidadeParcelas: number;
}

export function ComissaoPrevisaoCard({ vendedorId, comissaoPercentual }: ComissaoPrevisaoCardProps) {
  const navigate = useNavigate();

  const { data: parcelas = [], isLoading } = useQuery({
    queryKey: ["vendedor-parcelas-previsao", vendedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_propostas_parcelas")
        .select("*")
        .eq("vendedor_id", vendedorId)
        .order("data_vencimento", { ascending: true });
      
      if (error) throw error;
      return data as Parcela[];
    },
    enabled: !!vendedorId,
  });

  // Calculate stats for current month
  const hoje = new Date();
  const inicioMesAtual = startOfMonth(hoje);
  const fimMesAtual = endOfMonth(hoje);

  const parcelasDoMes = parcelas.filter(p => {
    const vencimento = parseISO(p.data_vencimento);
    return vencimento >= inicioMesAtual && vencimento <= fimMesAtual;
  });

  const comissaoRecebidaMes = parcelasDoMes
    .filter(p => p.status === 'paga')
    .reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0);

  const comissaoPendenteMes = parcelasDoMes
    .filter(p => p.status !== 'paga')
    .reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0);

  // Group future parcels by month
  const previsoesPorMes: PrevisaoMes[] = [];
  for (let i = 1; i <= 3; i++) {
    const mesAlvo = addMonths(hoje, i);
    const inicioMes = startOfMonth(mesAlvo);
    const fimMes = endOfMonth(mesAlvo);
    
    const parcelasDoMesAlvo = parcelas.filter(p => {
      const vencimento = parseISO(p.data_vencimento);
      return vencimento >= inicioMes && vencimento <= fimMes && p.status !== 'paga';
    });

    if (parcelasDoMesAlvo.length > 0) {
      const valorTotal = parcelasDoMesAlvo.reduce((sum, p) => sum + Number(p.valor || 0), 0);
      const comissao = parcelasDoMesAlvo.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0);
      
      previsoesPorMes.push({
        mes: format(mesAlvo, "yyyy-MM"),
        mesFormatado: format(mesAlvo, "MMMM/yyyy", { locale: ptBR }),
        valorTotal,
        comissao,
        quantidadeParcelas: parcelasDoMesAlvo.length,
      });
    }
  }

  // Count by status for current month
  const parcelasAtrasadas = parcelasDoMes.filter(p => {
    if (p.status === 'paga') return false;
    const vencimento = parseISO(p.data_vencimento);
    return isBefore(vencimento, hoje);
  }).length;

  const parcelasAguardando = parcelasDoMes.filter(p => {
    if (p.status === 'paga') return false;
    const vencimento = parseISO(p.data_vencimento);
    return isAfter(vencimento, hoje) || format(vencimento, 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd');
  }).length;

  const parcelasPagas = parcelasDoMes.filter(p => p.status === 'paga').length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Card Comissão do Mês */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
            Comissão Recebida no Mês
          </CardTitle>
          <DollarSign className="h-5 w-5 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-700 dark:text-green-300">
            R$ {comissaoRecebidaMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Recebidas
              </span>
              <span className="font-medium">{parcelasPagas} parcelas</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <Clock className="h-4 w-4" /> Aguardando
              </span>
              <span className="font-medium">{parcelasAguardando} parcelas</span>
            </div>
            {parcelasAtrasadas > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Atrasadas
                </span>
                <span className="font-medium text-red-600">{parcelasAtrasadas} parcelas</span>
              </div>
            )}
          </div>
          {comissaoPendenteMes > 0 && (
            <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
              <p className="text-xs text-green-600 dark:text-green-400">
                Pendente no mês: R$ {comissaoPendenteMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-3 w-full text-green-700 hover:text-green-800 hover:bg-green-100"
            onClick={() => navigate("/vendedor/parcelas")}
          >
            Ver todas as parcelas
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* Card Previsão de Comissões */}
      <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-200 dark:border-purple-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
            Previsão de Comissões
          </CardTitle>
          <Calendar className="h-5 w-5 text-purple-600" />
        </CardHeader>
        <CardContent>
          {previsoesPorMes.length === 0 ? (
            <div className="text-center py-4">
              <TrendingUp className="h-8 w-8 mx-auto text-purple-300 mb-2" />
              <p className="text-sm text-purple-600 dark:text-purple-400">
                Nenhuma parcela prevista para os próximos meses
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {previsoesPorMes.map((previsao) => (
                <div 
                  key={previsao.mes}
                  className="flex items-center justify-between p-2 rounded-lg bg-purple-100/50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/vendedor/parcelas?mes=${previsao.mes}`)}
                >
                  <div>
                    <p className="font-medium text-purple-700 dark:text-purple-300 capitalize">
                      {previsao.mesFormatado}
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      {previsao.quantidadeParcelas} parcela{previsao.quantidadeParcelas > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-purple-700 dark:text-purple-300">
                      R$ {previsao.comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <ChevronRight className="h-4 w-4 text-purple-400 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Total previsto: R$ {previsoesPorMes.reduce((sum, p) => sum + p.comissao, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
