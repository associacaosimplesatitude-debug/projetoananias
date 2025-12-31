import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getMonth, getDate, parseISO, isToday } from "date-fns";

interface BirthdayInfo {
  shouldShowModal: boolean;
  clienteId: string;
  nomeCliente: string;
  tipoAniversario: "pastor" | "superintendente";
}

export function useBirthdayCheck() {
  const { user } = useAuth();
  const [birthdayInfo, setBirthdayInfo] = useState<BirthdayInfo | null>(null);

  const { data: clienteData, refetch } = useQuery({
    queryKey: ["ebd-cliente-birthday", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("ebd_clientes")
        .select(
          `
          id,
          nome_igreja,
          data_aniversario_pastor,
          data_aniversario_superintendente,
          cupom_aniversario_usado,
          cupom_aniversario_ano,
          modal_aniversario_visualizado_em
        `
        )
        .eq("superintendente_user_id", user.id)
        .eq("status_ativacao_ebd", true)
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!clienteData) {
      setBirthdayInfo(null);
      return;
    }

    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const diaAtual = hoje.getDate();
    const anoAtual = hoje.getFullYear();

    // Verificar se já resgatou o cupom este ano
    const jaResgatouEsteAno =
      clienteData.cupom_aniversario_usado &&
      clienteData.cupom_aniversario_ano === anoAtual;

    if (jaResgatouEsteAno) {
      setBirthdayInfo(null);
      return;
    }

    // Verificar se já viu o modal hoje
    if (clienteData.modal_aniversario_visualizado_em) {
      const ultimaVisualizacao = new Date(
        clienteData.modal_aniversario_visualizado_em
      );
      if (isToday(ultimaVisualizacao)) {
        setBirthdayInfo(null);
        return;
      }
    }

    // Verificar aniversário do pastor
    if (clienteData.data_aniversario_pastor) {
      const dataPastor = parseISO(clienteData.data_aniversario_pastor);
      if (getMonth(dataPastor) === mesAtual && getDate(dataPastor) === diaAtual) {
        setBirthdayInfo({
          shouldShowModal: true,
          clienteId: clienteData.id,
          nomeCliente: clienteData.nome_igreja,
          tipoAniversario: "pastor",
        });
        return;
      }
    }

    // Verificar aniversário do superintendente
    if (clienteData.data_aniversario_superintendente) {
      const dataSuperint = parseISO(
        clienteData.data_aniversario_superintendente
      );
      if (
        getMonth(dataSuperint) === mesAtual &&
        getDate(dataSuperint) === diaAtual
      ) {
        setBirthdayInfo({
          shouldShowModal: true,
          clienteId: clienteData.id,
          nomeCliente: clienteData.nome_igreja,
          tipoAniversario: "superintendente",
        });
        return;
      }
    }

    setBirthdayInfo(null);
  }, [clienteData]);

  return {
    birthdayInfo,
    refetch,
  };
}
