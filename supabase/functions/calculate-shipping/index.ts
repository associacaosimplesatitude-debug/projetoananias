import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cep, items } = await req.json();

    if (!cep) {
      throw new Error('CEP é obrigatório');
    }

    // Remove caracteres não numéricos do CEP
    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      throw new Error('CEP inválido');
    }

    // Calcular peso total dos itens (assumindo 0.3kg por revista)
    const totalWeight = items.reduce((sum: number, item: any) => {
      return sum + (item.quantity * 0.3); // 300g por revista
    }, 0);

    // Preparar dados para API dos Correios
    const correiosUser = Deno.env.get('CORREIOS_USER');
    const correiosPassword = Deno.env.get('CORREIOS_PASSWORD');

    if (!correiosUser || !correiosPassword) {
      throw new Error('Credenciais dos Correios não configuradas');
    }

    console.log('Calculando frete para CEP:', cleanCep, 'Peso total:', totalWeight, 'kg');

    // API dos Correios - usando o serviço SEDEX (código 04014)
    // Formato: nCdEmpresa, sDsSenha, nCdServico, sCepOrigem, sCepDestino, nVlPeso, nCdFormato, nVlComprimento, nVlAltura, nVlLargura, nVlDiametro
    const params = new URLSearchParams({
      nCdEmpresa: correiosUser,
      sDsSenha: correiosPassword,
      nCdServico: '04014', // SEDEX
      sCepOrigem: '01310100', // CEP de origem (São Paulo - ajustar conforme necessário)
      sCepDestino: cleanCep,
      nVlPeso: totalWeight.toString(),
      nCdFormato: '1', // Caixa/Pacote
      nVlComprimento: '30',
      nVlAltura: '10',
      nVlLargura: '20',
      nVlDiametro: '0',
      sCdMaoPropria: 'N',
      nVlValorDeclarado: '0',
      sCdAvisoRecebimento: 'N',
    });

    const response = await fetch(
      `http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?${params.toString()}`
    );

    const xmlText = await response.text();
    console.log('Resposta dos Correios:', xmlText);

    // Parse da resposta XML
    const valorMatch = xmlText.match(/<Valor>([\d,]+)<\/Valor>/);
    const prazoMatch = xmlText.match(/<PrazoEntrega>(\d+)<\/PrazoEntrega>/);
    const erroMatch = xmlText.match(/<Erro>(\d+)<\/Erro>/);

    if (erroMatch && erroMatch[1] !== '0') {
      // Se houver erro, tentar com PAC (código 04510)
      console.log('Erro no SEDEX, tentando PAC');
      const pacParams = new URLSearchParams({
        ...Object.fromEntries(params),
        nCdServico: '04510', // PAC
      });

      const pacResponse = await fetch(
        `http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?${pacParams.toString()}`
      );

      const pacXmlText = await pacResponse.text();
      console.log('Resposta PAC dos Correios:', pacXmlText);

      const pacValorMatch = pacXmlText.match(/<Valor>([\d,]+)<\/Valor>/);
      const pacPrazoMatch = pacXmlText.match(/<PrazoEntrega>(\d+)<\/PrazoEntrega>/);

      if (pacValorMatch && pacPrazoMatch) {
        const shippingCost = parseFloat(pacValorMatch[1].replace(',', '.'));
        const deliveryDays = parseInt(pacPrazoMatch[1]);

        return new Response(
          JSON.stringify({
            shipping_cost: shippingCost,
            delivery_days: deliveryDays,
            service: 'PAC',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        throw new Error('Não foi possível calcular o frete');
      }
    }

    if (!valorMatch || !prazoMatch) {
      throw new Error('Formato de resposta inválido dos Correios');
    }

    const shippingCost = parseFloat(valorMatch[1].replace(',', '.'));
    const deliveryDays = parseInt(prazoMatch[1]);

    return new Response(
      JSON.stringify({
        shipping_cost: shippingCost,
        delivery_days: deliveryDays,
        service: 'SEDEX',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao calcular frete:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
