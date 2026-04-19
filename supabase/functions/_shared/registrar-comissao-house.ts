/**
 * Helper compartilhado: registra comissão de 3% da House Comunicação
 * na tabela `comissoes_alfamarketing_eventos`.
 *
 * Idempotência: ON CONFLICT (mercadopago_payment_id) DO NOTHING via upsert
 * com ignoreDuplicates. Múltiplas funções podem chamar este helper para o
 * mesmo pagamento — apenas a primeira persiste.
 *
 * Esta função NUNCA propaga erro: sempre loga e retorna void.
 */
export async function registrarComissaoHouse(
  supabase: any,
  pedido: {
    id: string;
    valor_total: number | string | null;
    mercadopago_payment_id: string | null;
    proposta_id?: string | null;
  },
  dataPagamento?: Date | string | null,
): Promise<void> {
  try {
    const paymentId = pedido?.mercadopago_payment_id;
    if (!paymentId) {
      console.error('[Comissao House] erro pedido_sem_payment_id', { pedido_id: pedido?.id });
      return;
    }

    const valorBruto = Number(pedido.valor_total || 0);
    const valorComissao = Math.round(valorBruto * 0.03 * 100) / 100;

    const dataPagamentoStr = dataPagamento
      ? (typeof dataPagamento === 'string' ? dataPagamento : dataPagamento.toISOString())
      : new Date().toISOString();
    const dataPagamentoDate = new Date(dataPagamentoStr);
    const mesReferencia = `${dataPagamentoDate.getUTCFullYear()}-${String(
      dataPagamentoDate.getUTCMonth() + 1,
    ).padStart(2, '0')}-01`;

    const { data: insertedRows, error } = await supabase
      .from('comissoes_alfamarketing_eventos')
      .upsert(
        {
          mercadopago_payment_id: paymentId.toString(),
          pedido_mp_id: pedido.id,
          proposta_id: pedido.proposta_id || null,
          valor_bruto: valorBruto,
          percentual: 3,
          valor_comissao: valorComissao,
          canal: 'mercadopago_propostas',
          origem: 'mercadopago',
          status: 'a_receber',
          data_pagamento: dataPagamentoStr,
          mes_referencia: mesReferencia,
        },
        { onConflict: 'mercadopago_payment_id', ignoreDuplicates: true },
      )
      .select('id');

    if (error) {
      console.error(`[Comissao House] erro payment_id=${paymentId} erro=${error.message}`);
      return;
    }

    if (!insertedRows || insertedRows.length === 0) {
      console.log(`[Comissao House] ja_registrada payment_id=${paymentId}`);
    } else {
      console.log(`[Comissao House] registrada payment_id=${paymentId} valor=${valorComissao}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[Comissao House] erro payment_id=${pedido?.mercadopago_payment_id ?? 'unknown'} erro=${msg}`,
    );
    // Nunca propaga.
  }
}
