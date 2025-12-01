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

    // Calcular frete baseado em região e peso
    // Como a API antiga dos Correios foi descontinuada, usamos uma tabela de preços
    const cepPrefix = cleanCep.substring(0, 2);
    
    // Definir região baseada no CEP
    let region: 'sudeste' | 'sul' | 'centro-oeste' | 'nordeste' | 'norte';
    
    if (['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'].includes(cepPrefix)) {
      region = 'sudeste'; // SP, RJ, ES, MG
    } else if (['20', '21', '22', '23', '24', '25', '26', '27', '28'].includes(cepPrefix)) {
      region = 'sudeste';
    } else if (['29'].includes(cepPrefix)) {
      region = 'sudeste';
    } else if (['30', '31', '32', '33', '34', '35', '36', '37', '38', '39'].includes(cepPrefix)) {
      region = 'sudeste';
    } else if (['40', '41', '42', '43', '44', '45', '46', '47', '48'].includes(cepPrefix)) {
      region = 'nordeste'; // BA
    } else if (['49'].includes(cepPrefix)) {
      region = 'nordeste'; // SE
    } else if (['50', '51', '52', '53', '54'].includes(cepPrefix)) {
      region = 'nordeste'; // PE
    } else if (['55', '56'].includes(cepPrefix)) {
      region = 'nordeste'; // AL
    } else if (['57', '58'].includes(cepPrefix)) {
      region = 'nordeste'; // PB
    } else if (['59'].includes(cepPrefix)) {
      region = 'nordeste'; // RN
    } else if (['60', '61', '62', '63'].includes(cepPrefix)) {
      region = 'nordeste'; // CE
    } else if (['64'].includes(cepPrefix)) {
      region = 'nordeste'; // PI
    } else if (['65'].includes(cepPrefix)) {
      region = 'nordeste'; // MA
    } else if (['66', '67', '68'].includes(cepPrefix)) {
      region = 'norte'; // PA, AP, AM
    } else if (['69'].includes(cepPrefix)) {
      region = 'norte'; // AC, RO, RR
    } else if (['70', '71', '72', '73'].includes(cepPrefix)) {
      region = 'centro-oeste'; // DF, GO
    } else if (['74', '75', '76', '77'].includes(cepPrefix)) {
      region = 'centro-oeste'; // GO, TO
    } else if (['78'].includes(cepPrefix)) {
      region = 'centro-oeste'; // MT
    } else if (['79'].includes(cepPrefix)) {
      region = 'centro-oeste'; // MS
    } else if (['80', '81', '82', '83', '84', '85', '86', '87'].includes(cepPrefix)) {
      region = 'sul'; // PR
    } else if (['88', '89'].includes(cepPrefix)) {
      region = 'sul'; // SC
    } else if (['90', '91', '92', '93', '94', '95', '96', '97', '98', '99'].includes(cepPrefix)) {
      region = 'sul'; // RS
    } else {
      region = 'sudeste'; // default
    }

    // Tabela de preços por região e peso
    const shippingRates = {
      sudeste: { 
        pac: { base: 15, perKg: 5, days: 5 },
        sedex: { base: 25, perKg: 8, days: 2 }
      },
      sul: { 
        pac: { base: 20, perKg: 7, days: 7 },
        sedex: { base: 35, perKg: 12, days: 3 }
      },
      'centro-oeste': { 
        pac: { base: 25, perKg: 8, days: 8 },
        sedex: { base: 40, perKg: 14, days: 4 }
      },
      nordeste: { 
        pac: { base: 30, perKg: 10, days: 10 },
        sedex: { base: 50, perKg: 18, days: 5 }
      },
      norte: { 
        pac: { base: 35, perKg: 12, days: 12 },
        sedex: { base: 60, perKg: 22, days: 6 }
      },
    };

    const rates = shippingRates[region];
    const pacCost = rates.pac.base + (totalWeight * rates.pac.perKg);
    const sedexCost = rates.sedex.base + (totalWeight * rates.sedex.perKg);

    console.log('Região:', region, 'PAC:', pacCost, 'SEDEX:', sedexCost);

    return new Response(
      JSON.stringify({
        pac: {
          cost: Number(pacCost.toFixed(2)),
          days: rates.pac.days,
        },
        sedex: {
          cost: Number(sedexCost.toFixed(2)),
          days: rates.sedex.days,
        },
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
