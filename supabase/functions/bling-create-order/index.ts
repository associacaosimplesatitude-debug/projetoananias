import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para renovar o token do Bling
async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  if (!config.refresh_token) {
    throw new Error('Refresh token não disponível');
  }

  console.log('Renovando token do Bling...');
  
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  
  const tokenResponse = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || tokenData.error) {
    console.error('Erro ao renovar token:', tokenData);
    throw new Error(tokenData.error_description || 'Erro ao renovar token do Bling');
  }

  // Calcular nova expiração
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

  // Atualizar tokens no banco
  const { error: updateError } = await supabase
    .from('bling_config')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', config.id);

  if (updateError) {
    console.error('Erro ao salvar tokens:', updateError);
    throw new Error('Erro ao salvar tokens renovados');
  }

  console.log('Token renovado com sucesso! Expira em:', expiresAt.toISOString());
  return tokenData.access_token;
}

// Função para verificar se o token está expirado ou próximo de expirar
function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  // Considera expirado se faltam menos de 5 minutos
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      cliente,          // Dados do cliente do formulário (nome, sobrenome, cpf_cnpj, email, telefone)
      endereco_entrega, // Endereço de entrega do checkout (rua, numero, complemento, bairro, cep, cidade, estado)
      itens,            // Itens com preço de lista (preco_cheio) e preço com desconto (valor)
      pedido_id,
      valor_frete,
      metodo_frete,     // PAC, SEDEX, FREE, manual
      forma_pagamento,  // PIX, CARTAO, BOLETO, FATURAMENTO
      faturamento_prazo, // 30, 60 ou 90 (apenas para FATURAMENTO)
      valor_produtos,   // Total dos produtos com desconto
      valor_total,      // Total final (produtos + frete)
      vendedor_nome,    // Vendor name for Bling
      desconto_percentual, // Discount percentage applied
      // Dados de frete manual
      frete_tipo,           // 'automatico' ou 'manual'
      frete_transportadora, // Nome da transportadora (apenas para frete manual)
      frete_observacao,     // Observação interna sobre o frete manual
    } = await req.json();

    if (!cliente || !itens || itens.length === 0) {
      throw new Error('Dados do cliente e itens são obrigatórios');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar configuração
    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config) {
      throw new Error('Configuração não encontrada');
    }

    if (!config.access_token) {
      throw new Error('Token de acesso não configurado');
    }

    // Verificar se o token está expirado e renovar se necessário
    let accessToken = config.access_token;
    if (isTokenExpired(config.token_expires_at)) {
      console.log('Token expirado ou próximo de expirar, renovando...');
      accessToken = await refreshBlingToken(supabase, config);
    }

    // Determinar se é CPF ou CNPJ
    const documento = cliente.cpf_cnpj?.replace(/\D/g, '') || '';
    const tipoDocumento = documento.length > 11 ? 'J' : 'F';
    
    // Nome completo do cliente
    const nomeCompleto = cliente.sobrenome 
      ? `${cliente.nome} ${cliente.sobrenome}` 
      : cliente.nome;

    // Criar ou buscar o contato do Cliente no Bling com endereço completo para NF
    const contatoData: any = {
      nome: nomeCompleto,
      tipo: tipoDocumento,
      numeroDocumento: documento,
      email: cliente.email || '',
      telefone: cliente.telefone?.replace(/\D/g, '') || '',
      situacao: 'A', // A = Ativo (obrigatório para Bling API v3)
    };

    // Adicionar endereço ao contato (obrigatório para emissão de NF)
    if (endereco_entrega) {
      contatoData.endereco = {
        endereco: endereco_entrega.rua || '',
        numero: endereco_entrega.numero || 'S/N',
        complemento: endereco_entrega.complemento || '',
        bairro: endereco_entrega.bairro || '',
        cep: endereco_entrega.cep?.replace(/\D/g, '') || '',
        municipio: endereco_entrega.cidade || '',
        uf: endereco_entrega.estado || '',
        pais: 'Brasil',
      };
    }

    console.log('Criando contato do Cliente no Bling com endereço:', JSON.stringify(contatoData, null, 2));

    const contatoResponse = await fetch('https://www.bling.com.br/Api/v3/contatos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(contatoData),
    });

    const contatoResult = await contatoResponse.json();
    let contatoId: number | null = null;

    if (contatoResponse.ok && contatoResult.data?.id) {
      contatoId = contatoResult.data.id;
      console.log('Contato criado com sucesso, ID:', contatoId);
    } else if (contatoResult.error?.fields) {
      // Se o contato já existe, tentar buscar pelo documento e atualizar
      console.log('Contato pode já existir, buscando...');
      
      if (documento) {
        const searchResponse = await fetch(
          `https://www.bling.com.br/Api/v3/contatos?numeroDocumento=${documento}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          }
        );

        const searchResult = await searchResponse.json();
        if (searchResult.data && searchResult.data.length > 0) {
          contatoId = searchResult.data[0].id;
          console.log('Contato encontrado, ID:', contatoId);
          
          // Atualizar o contato existente com os dados de endereço
          console.log('Atualizando contato existente com endereço...');
          const updateResponse = await fetch(`https://www.bling.com.br/Api/v3/contatos/${contatoId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(contatoData),
          });
          
          if (updateResponse.ok) {
            console.log('Contato atualizado com sucesso');
          } else {
            console.log('Não foi possível atualizar contato, continuando...');
          }
        }
      }
    }

    // Se não conseguiu criar ou encontrar contato, criar um genérico com endereço
    // IMPORTANTE: NÃO enviar numeroDocumento no contato genérico pois pode ser rejeitado se inválido
    if (!contatoId) {
      console.log('Não foi possível criar/encontrar contato, criando consumidor genérico SEM documento...');
      
      const genericContatoData: any = {
        nome: nomeCompleto || 'Consumidor Final',
        tipo: 'F', // Sempre pessoa física para genérico
        situacao: 'A', // A = Ativo (obrigatório para Bling API v3)
      };

      // Adicionar endereço mesmo para contato genérico
      if (endereco_entrega) {
        genericContatoData.endereco = {
          endereco: endereco_entrega.rua || '',
          numero: endereco_entrega.numero || 'S/N',
          complemento: endereco_entrega.complemento || '',
          bairro: endereco_entrega.bairro || '',
          cep: endereco_entrega.cep?.replace(/\D/g, '') || '',
          municipio: endereco_entrega.cidade || '',
          uf: endereco_entrega.estado || '',
          pais: 'Brasil',
        };
      }

      console.log('Tentando criar contato genérico:', JSON.stringify(genericContatoData, null, 2));

      const genericResponse = await fetch('https://www.bling.com.br/Api/v3/contatos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(genericContatoData),
      });

      const genericResult = await genericResponse.json();
      if (genericResponse.ok && genericResult.data?.id) {
        contatoId = genericResult.data.id;
        console.log('Contato genérico criado, ID:', contatoId);
      } else {
        console.error('Erro ao criar contato genérico:', genericResult);
        // NÃO travar aqui - continuar sem contato se necessário
        console.log('Continuando sem contato vinculado...');
      }
    }

    // Gerar identificadores únicos
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Calcular desconto total da venda
    let descontoTotalVenda = 0;
    
    // Helper: delay para respeitar rate limit do Bling (3 req/s)
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // Helper: fetch com retry automático para 429
    async function blingFetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const response = await fetch(url, options);
        if (response.status === 429) {
          const waitTime = attempt * 1000; // 1s, 2s, 3s
          console.log(`Rate limit atingido (429). Aguardando ${waitTime}ms antes de tentar novamente (tentativa ${attempt}/${maxRetries})...`);
          await delay(waitTime);
          continue;
        }
        return response;
      }
      // Última tentativa sem retry
      return fetch(url, options);
    }

    // Cache do depósito (para evitar chamar /depositos a cada pedido)
    type DepositoInfo = { id: number; descricao: string; padrao: boolean };

    let cachedDeposito: DepositoInfo | null = null;
    let cachedDepositos: DepositoInfo[] | null = null;

    // Listar depósitos via API (sem chute) + log completo para auditoria
    async function listDepositos(): Promise<DepositoInfo[]> {
      if (cachedDepositos) return cachedDepositos;

      console.log('[DEPOSITO] Buscando depósitos no Bling...');
      await delay(350);

      const resp = await blingFetchWithRetry('https://www.bling.com.br/Api/v3/depositos', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`[DEPOSITO] Falha ao listar depósitos no Bling: status=${resp.status} body=${body}`);
      }

      const json = await resp.json();
      const depositosRaw: any[] = Array.isArray(json?.data) ? json.data : [];

      // Log obrigatório (id + descricao + padrao)
      const audit = depositosRaw.map((d) => ({
        id: d?.id,
        descricao: d?.descricao ?? d?.nome,
        padrao: Boolean(d?.padrao) || Boolean(d?.isPadrao) || Boolean(d?.default),
      }));
      console.log('[DEPOSITO] Retorno /depositos (audit):', JSON.stringify(audit, null, 2));
      console.log('[DEPOSITO] Retorno /depositos (raw):', JSON.stringify(depositosRaw, null, 2));

      cachedDepositos = audit
        .filter((d) => d.id != null)
        .map((d) => ({ id: Number(d.id), descricao: String(d.descricao ?? '').trim(), padrao: Boolean(d.padrao) }));

      return cachedDepositos;
    }

    // Escolher depósito: preferir "Geral"; fallback para padrão
    async function getDepositoInfo(): Promise<DepositoInfo> {
      if (cachedDeposito) return cachedDeposito;

      const depositos = await listDepositos();

      const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();

      const geral = depositos.find((d) => {
        const descricao = normalize(d.descricao);
        return descricao === 'geral' || descricao.includes('geral');
      });

      const padrao = depositos.find((d) => d.padrao);

      const chosen = geral ?? padrao;
      if (!chosen) {
        throw new Error('[DEPOSITO] Não foi possível identificar o depósito "Geral" (nem um padrão) no Bling. Verifique o cadastro de depósitos.');
      }

      cachedDeposito = chosen;
      console.log(`[DEPOSITO] Depósito selecionado: id=${chosen.id} descricao=${chosen.descricao} padrao=${chosen.padrao}`);
      return chosen;
    }

    // Função auxiliar para buscar produto no Bling pelo código (SKU)
    async function findBlingProductBySku(sku: string): Promise<{ id: number; codigo: string } | null> {
      try {
        console.log(`Buscando produto no Bling pelo SKU/código: "${sku}"`);
        
        // Delay para respeitar rate limit
        await delay(350);
        
        // Buscar diretamente pelo código usando o endpoint de produtos
        const searchResponse = await blingFetchWithRetry(
          `https://www.bling.com.br/Api/v3/produtos?codigo=${encodeURIComponent(sku)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          }
        );

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.log(`Erro HTTP ao buscar produto por SKU: ${sku}. Status: ${searchResponse.status}. Body: ${errorText}`);
          return null;
        }

        const searchData = await searchResponse.json();
        const produtos = searchData.data || [];
        
        console.log(`Bling retornou ${produtos.length} produtos para SKU "${sku}"`);

        if (produtos.length > 0) {
          // Procurar match exato do código
          const exactMatch = produtos.find((p: any) => 
            String(p.codigo).trim().toLowerCase() === sku.trim().toLowerCase()
          );
          
          if (exactMatch) {
            console.log(`Produto encontrado por SKU exato: "${exactMatch.nome}" (código: ${exactMatch.codigo}) -> ID ${exactMatch.id}`);
            return { id: exactMatch.id, codigo: exactMatch.codigo };
          }
          
          // Se não houver match exato, usar o primeiro resultado
          const firstProduct = produtos[0];
          console.log(`Produto encontrado por SKU (primeiro resultado): "${firstProduct.nome}" (código: ${firstProduct.codigo}) -> ID ${firstProduct.id}`);
          return { id: firstProduct.id, codigo: firstProduct.codigo };
        }

        console.log(`Nenhum produto encontrado para SKU: ${sku}`);
        return null;
      } catch (error) {
        console.error(`Erro ao buscar produto por SKU: ${error}`);
        return null;
      }
    }

    // Função auxiliar para buscar produto no Bling pelo nome (fallback)
    async function findBlingProductByName(productName: string): Promise<number | null> {
      try {
        // Normalizar para comparação (remover acentos e case)
        const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        
        // Extrair informações importantes do nome do produto
        // Ex: "Revista EBD N08 Jovens e Adultos - O Cativeiro Babilônico ALUNO"
        // Partes importantes: N08 (número), "Jovens e Adultos" ou "Juniores" (faixa), ALUNO/PROFESSOR (tipo)
        const normalizedSearch = normalize(productName);
        
        // Detectar número da revista (N01, N02, N08, etc.)
        const numeroRevistaMatch = productName.match(/N(\d+)/i);
        const numeroRevista = numeroRevistaMatch ? numeroRevistaMatch[1].padStart(2, '0') : null;
        
        // Detectar tipo (ALUNO ou PROFESSOR)
        const isAluno = /aluno/i.test(productName);
        const isProfessor = /professor/i.test(productName);
        const tipo = isAluno ? 'aluno' : (isProfessor ? 'professor' : null);
        
        // Detectar faixa etária
        const faixaEtaria = normalizedSearch.includes('jovens e adultos') ? 'jovens e adultos' :
                           normalizedSearch.includes('adolescentes') || normalizedSearch.includes('adolecentes') ? 'adolescentes' :
                           normalizedSearch.includes('juniores') ? 'juniores' :
                           normalizedSearch.includes('jardim de infancia') || normalizedSearch.includes('jardim de infância') ? 'jardim de infancia' :
                           normalizedSearch.includes('discipulado') ? 'discipulado' :
                           normalizedSearch.includes('passo a passo') ? 'passo a passo' :
                           null;
        
        console.log(`Buscando produto por nome: "${productName}"`);
        console.log(`  -> Número: ${numeroRevista}, Tipo: ${tipo}, Faixa: ${faixaEtaria}`);
        
        const palavrasIgnorar = ['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'um', 'uma', 'uns', 'umas', '-', 'livro', 'revista', 'ebd'];
        const palavras = productName.split(/\s+/).filter(p => p.length > 0);
        const palavrasSignificativas = palavras.filter(p => !palavrasIgnorar.includes(p.toLowerCase()) && p.length > 2);
        
        // Diferentes termos de busca para tentar
        const searchAttempts: string[] = [];
        
        // 1. Buscar com número da revista + tipo se disponível
        if (numeroRevista && tipo) {
          searchAttempts.push(`N${numeroRevista} ${tipo}`);
        }
        
        // 2. Palavras significativas (max 4)
        if (palavrasSignificativas.length >= 2) {
          searchAttempts.push(palavrasSignificativas.slice(0, 4).join(' '));
        }
        
        // 3. Primeiras 6 palavras originais
        if (palavras.length >= 3) {
          searchAttempts.push(palavras.slice(0, 6).join(' '));
        }
        
        // 4. Primeiras 3 palavras
        searchAttempts.push(palavras.slice(0, 3).join(' '));
        
        // Remover duplicatas
        const uniqueAttempts = [...new Set(searchAttempts)];
        
        // Função para calcular score de match
        const calculateMatchScore = (produtoNome: string): number => {
          const normalizedProduto = normalize(produtoNome);
          let score = 0;
          
          // Match exato = 1000 pontos
          if (normalizedProduto === normalizedSearch) {
            return 1000;
          }
          
          // Match de número da revista (muito importante)
          if (numeroRevista) {
            const produtoNumero = produtoNome.match(/N(\d+)/i);
            if (produtoNumero && produtoNumero[1].padStart(2, '0') === numeroRevista) {
              score += 100;
            } else {
              // Se o número não bate, penalizar fortemente
              score -= 200;
            }
          }
          
          // Match de tipo (ALUNO/PROFESSOR)
          if (tipo) {
            if (tipo === 'aluno' && /aluno/i.test(produtoNome)) {
              score += 50;
            } else if (tipo === 'professor' && /professor/i.test(produtoNome)) {
              score += 50;
            } else if (tipo === 'aluno' && /professor/i.test(produtoNome)) {
              // Tipo diferente, penalizar muito
              score -= 100;
            } else if (tipo === 'professor' && /aluno/i.test(produtoNome)) {
              score -= 100;
            }
          }
          
          // Match de faixa etária
          if (faixaEtaria) {
            const normalizedProdutoCheck = normalizedProduto;
            if (faixaEtaria === 'jovens e adultos' && normalizedProdutoCheck.includes('jovens e adultos')) {
              score += 30;
            } else if (faixaEtaria === 'adolescentes' && (normalizedProdutoCheck.includes('adolescentes') || normalizedProdutoCheck.includes('adolecentes'))) {
              score += 30;
            } else if (faixaEtaria === 'juniores' && normalizedProdutoCheck.includes('juniores')) {
              score += 30;
            } else if (faixaEtaria === 'jardim de infancia' && normalizedProdutoCheck.includes('jardim')) {
              score += 30;
            } else if (faixaEtaria === 'discipulado' && normalizedProdutoCheck.includes('discipulado')) {
              score += 30;
            } else if (faixaEtaria === 'passo a passo' && normalizedProdutoCheck.includes('passo a passo')) {
              score += 30;
            }
          }
          
          // Match por inclusão
          if (normalizedSearch.includes(normalizedProduto) || normalizedProduto.includes(normalizedSearch)) {
            score += 20;
          }
          
          // Match de palavras significativas
          const matchedWords = palavrasSignificativas.filter(palavra => 
            normalizedProduto.includes(normalize(palavra))
          ).length;
          score += matchedWords * 5;
          
          return score;
        };
        
        for (const searchTerms of uniqueAttempts) {
          console.log(`Buscando produto no Bling com termo: "${searchTerms}"`);
          
          // Delay entre buscas para respeitar rate limit
          await delay(350);
          
          const searchResponse = await blingFetchWithRetry(
            `https://www.bling.com.br/Api/v3/produtos?pagina=1&limite=100&nome=${encodeURIComponent(searchTerms)}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
              },
            }
          );

          if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            console.log(`Erro HTTP ao buscar produto por nome: ${productName}. Status: ${searchResponse.status}. Body: ${errorText}`);
            continue; // Tentar próximo termo
          }

          const searchData = await searchResponse.json();
          const produtos = searchData.data || [];
          
          console.log(`Bling retornou ${produtos.length} produtos para busca "${searchTerms}"`);

          if (produtos.length > 0) {
            // Calcular score para cada produto
            const produtosComScore = produtos.map((p: any) => ({
              ...p,
              matchScore: calculateMatchScore(p.nome || '')
            }));
            
            // Ordenar por score descendente
            produtosComScore.sort((a: any, b: any) => b.matchScore - a.matchScore);
            
            const melhorMatch = produtosComScore[0];
            console.log(`Melhor match: "${melhorMatch.nome}" com score ${melhorMatch.matchScore}`);
            
            // Só aceitar se o score for positivo e razoável
            if (melhorMatch.matchScore >= 50) {
              console.log(`Produto encontrado (score ${melhorMatch.matchScore}): ${melhorMatch.nome} -> ID ${melhorMatch.id}`);
              return melhorMatch.id;
            }
            
            // Match exato
            const exactMatch = produtos.find((p: any) =>
              normalize(p.nome || '') === normalizedSearch
            );

            if (exactMatch) {
              console.log(`Produto encontrado (match exato): ${exactMatch.nome} -> ID ${exactMatch.id}`);
              return exactMatch.id;
            }
          }
        }

        // Fallback: listar produtos (paginação limitada) e fazer match local.
        // Isso resolve casos em que o filtro "nome" não retorna resultados por limitações do Bling.
        const MAX_PAGES = 3;
        const LIMIT = 100;

        for (let page = 1; page <= MAX_PAGES; page++) {
          console.log(`Fallback: listando produtos do Bling (página ${page}/${MAX_PAGES}) para match local...`);

          // Delay entre páginas para respeitar rate limit
          await delay(400);

          const listResponse = await blingFetchWithRetry(
            `https://www.bling.com.br/Api/v3/produtos?pagina=${page}&limite=${LIMIT}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
              },
            }
          );

          if (!listResponse.ok) {
            const errorText = await listResponse.text();
            console.log(`Fallback: erro HTTP ao listar produtos. Status: ${listResponse.status}. Body: ${errorText}`);
            break;
          }

          const listData = await listResponse.json();
          const produtos = listData.data || [];
          console.log(`Fallback: Bling retornou ${produtos.length} produtos na página ${page}`);

          if (!Array.isArray(produtos) || produtos.length === 0) break;

          // Calcular score para cada produto usando a mesma função
          const produtosComScore = produtos.map((p: any) => ({
            ...p,
            matchScore: calculateMatchScore(p.nome || '')
          }));
          
          // Ordenar por score descendente
          produtosComScore.sort((a: any, b: any) => b.matchScore - a.matchScore);
          
          const melhorMatch = produtosComScore[0];
          
          // Só aceitar se o score for muito alto (mais rigoroso no fallback)
          if (melhorMatch && melhorMatch.matchScore >= 80) {
            console.log(`Produto encontrado (fallback score ${melhorMatch.matchScore}): ${melhorMatch.nome} -> ID ${melhorMatch.id}`);
            return melhorMatch.id;
          }

          // Se veio menos que LIMIT, não há mais páginas.
          if (produtos.length < LIMIT) break;
        }

        console.log(`Nenhum produto encontrado para: ${productName}`);
        return null;
      } catch (error) {
        console.error(`Erro ao buscar produto por nome: ${error}`);
        return null;
      }
    }

    // Cache simples para não bater no endpoint de estoque repetidas vezes
    const estoqueCache = new Map<string, number>();

    // Busca saldo físico/virtual no Bling (quando disponível)
    // Observação: no painel do Bling geralmente aparece o **saldo físico**,
    // mas a validação da venda costuma considerar o **saldo virtual/disponível** (saldo físico - reservas).
    async function getBlingStock(
      produtoId: number,
      depositoId?: number
    ): Promise<{ saldoFisico: number | null; saldoVirtual: number | null } | null> {
      try {
        const cacheKey = `${produtoId}:${depositoId ?? 'all'}`;
        if (estoqueCache.has(cacheKey)) {
          const cachedVirtual = estoqueCache.get(cacheKey)!;
          return { saldoFisico: null, saldoVirtual: cachedVirtual };
        }

        // Rate limit: respeitar espaçamento entre chamadas
        await delay(350);

        const depositFilter = depositoId ? `&idsDepositos[]=${encodeURIComponent(String(depositoId))}` : '';
        const url = `https://www.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=${produtoId}${depositFilter}`;
        const resp = await blingFetchWithRetry(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!resp.ok) {
          const body = await resp.text();
          console.log(
            `[STOCK CHECK] Falha ao consultar saldo do produto ${produtoId} (deposito=${depositoId ?? 'all'}): status=${resp.status} body=${body}`
          );
          return null;
        }

        const json = await resp.json();
        const row = Array.isArray(json?.data) ? json.data.find((d: any) => Number(d?.id) === produtoId) : null;

        const saldoFisico = row?.saldoFisico != null ? Number(row.saldoFisico) : null;
        const saldoVirtual = row?.saldoVirtual != null ? Number(row.saldoVirtual) : null;

        // Cache apenas o saldo virtual (mais importante pra validação)
        if (saldoVirtual != null && !Number.isNaN(saldoVirtual)) {
          estoqueCache.set(cacheKey, saldoVirtual);
        }

        console.log(
          `[STOCK CHECK] produto=${produtoId} deposito=${depositoId ?? 'all'} saldoFisico=${saldoFisico ?? 'n/a'} saldoVirtual=${saldoVirtual ?? 'n/a'}`
        );
        return { saldoFisico, saldoVirtual };
      } catch (e) {
        console.log(`[STOCK CHECK] Erro ao consultar saldo do produto ${produtoId}: ${String(e)}`);
        return null;
      }
    }

    // Preparar itens (enviando o PREÇO LISTA + DESCONTO separados para exibição correta no Bling)
    const itensBling = [];

    // ⚠️ AJUSTE TEMPORÁRIO: NÃO enviar deposito.id no payload.
    // Deixar o Bling usar o depósito padrão configurado no painel (ex: "Geral").
    console.log('[DEPOSITO] Envio de deposito.id desativado: Bling usará o depósito padrão configurado.');

    // Em paralelo, mantemos a descoberta de depósitos via API (/depositos) apenas para auditoria
    // e para voltar a setar o depósito com ID real futuramente (sem chute).
    try {
      const depositos = await listDepositos();
      const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();
      const geral = depositos.find((d) => normalize(d.descricao) === 'geral' || normalize(d.descricao).includes('geral'));
      const padrao = depositos.find((d) => d.padrao);
      console.log('[DEPOSITO] Candidato "Geral" (não aplicado):', geral ? JSON.stringify(geral) : 'não encontrado');
      console.log('[DEPOSITO] Candidato Padrão (não aplicado):', padrao ? JSON.stringify(padrao) : 'não encontrado');
    } catch (e) {
      console.log('[DEPOSITO] Falha ao auditar depósitos (seguindo sem deposito.id):', String(e));
    }

    // Total real baseado nos itens que vamos enviar ao Bling (após desconto)
    let totalBrutoBling = 0;

    for (const item of itens as any[]) {
      let blingProdutoId: number | null = null;
      let blingProdutoCodigo: string | null = null;
      
      // Log obrigatório para confirmar payload real
      console.log("ITEM RECEBIDO:", JSON.stringify(item));
      console.log("SKU candidates:", {
        item_sku: (item as any).sku,
        item_codigo: (item as any).codigo,
        item_variantSku: (item as any).variantSku,
        item_variant_id: (item as any).variantId,
        item_produto_codigo: (item as any)?.produto?.codigo,
      });

      // Normalizar leitura do SKU/código (SKU é string; pode conter letras)
      const skuRecebido = String(
        (item as any).codigo ??
          (item as any).sku ??
          (item as any).variantSku ??
          (item as any)?.produto?.codigo ??
          ""
      ).trim();

      console.log(`Processando item: "${item.descricao}"`);
      console.log(`  SKU recebido: "${skuRecebido}"`);
      
      // SKU é obrigatório para criar pedido no Bling (sem fallback por nome)
      if (!skuRecebido) {
        throw new Error('Item sem SKU. Não é permitido criar pedido no Bling sem SKU.');
      }

      console.log(`Buscando produto SOMENTE por SKU: "${skuRecebido}"`);

      const produtoBySku = await findBlingProductBySku(skuRecebido);

      if (produtoBySku) {
        blingProdutoId = produtoBySku.id;
        blingProdutoCodigo = produtoBySku.codigo;
        console.log(`Produto encontrado por SKU! ID: ${blingProdutoId}, Código: ${blingProdutoCodigo}`);
      } else {
        console.error(`ERRO: SKU "${skuRecebido}" não encontrado no Bling`);
        throw new Error(`Produto não encontrado no Bling com SKU/código: "${skuRecebido}". Verifique se o código está cadastrado corretamente no Bling.`);
      }

      // preco_cheio = preço de tabela (sem desconto)
      // valor = preço com desconto aplicado
      const precoLista = Number(item.preco_cheio || item.valor);
      const precoComDesconto = Number(item.valor);
      const quantidade = Number(item.quantidade);

      // Checagem preventiva (SEM depósito): como não enviamos deposito.id, deixamos o Bling usar o padrão.
      // Aqui consultamos o saldo agregado (sem filtro) apenas para sinalização.
      const stock = await getBlingStock(blingProdutoId);
      if (stock?.saldoVirtual != null && !Number.isNaN(stock.saldoVirtual) && stock.saldoVirtual < quantidade) {
        const fisicoTxt = stock.saldoFisico == null || Number.isNaN(stock.saldoFisico)
          ? 'n/a'
          : stock.saldoFisico.toFixed(2);
        const virtualTxt = stock.saldoVirtual.toFixed(2);

        console.log(
          `[STOCK CHECK] Saldo agregado insuficiente (sem depósito): produto=${blingProdutoId} saldoVirtual=${virtualTxt} solicitado=${quantidade}`
        );

        throw new Error(
          `Estoque insuficiente no Bling para: ${item.descricao}. ` +
          `Saldo (agregado/sem depósito) insuficiente: saldo=${virtualTxt}, solicitado=${quantidade}. ` +
          `Saldo físico: ${fisicoTxt} • Saldo disponível (virtual): ${virtualTxt}.`
        );
      }

      // Calcular desconto percentual do item
      // desconto_percentual_item = ((precoLista - precoComDesconto) / precoLista) * 100
      let descontoPercentualItem = 0;
      if (precoLista > precoComDesconto && precoLista > 0) {
        descontoPercentualItem = Math.round(((precoLista - precoComDesconto) / precoLista) * 10000) / 100;
      }

      // IMPORTANTÍSSIMO: o Bling pode arredondar o desconto por UNIDADE antes de multiplicar.
      // Para que parcelas batam com o total calculado no Bling, simulamos o mesmo:
      // - calcula preço unitário líquido com 2 casas
      // - total do item = preço unitário líquido * quantidade
      const precoUnitarioLiquido = descontoPercentualItem > 0
        ? Math.round((precoLista * (1 - (descontoPercentualItem / 100))) * 100) / 100
        : Math.round(precoLista * 100) / 100;

      const totalItemLiquido = Math.round((precoUnitarioLiquido * quantidade) * 100) / 100;
      const totalItemBruto = Math.round((precoLista * quantidade) * 100) / 100;
      const descontoTotalItem = Math.max(0, Math.round((totalItemBruto - totalItemLiquido) * 100) / 100);

      // Total que o Bling deve computar via itens (após desconto)
      totalBrutoBling += totalItemLiquido;

      // Acumular desconto total (para exibição)
      descontoTotalVenda += descontoTotalItem;

      console.log(`Item: ${item.descricao}`);
      console.log(`  - SKU recebido: ${skuRecebido}`);
      console.log(`  - bling_produto_id: ${blingProdutoId}`);
      console.log(`  - bling_produto_codigo: ${blingProdutoCodigo || 'N/A'}`);
      console.log(`  - Preço Lista (enviado): R$ ${precoLista.toFixed(2)}`);
      console.log(`  - Desconto %: ${descontoPercentualItem.toFixed(2)}%`);
      console.log(`  - Preço Unit. Líquido (simulado): R$ ${precoUnitarioLiquido.toFixed(2)}`);
      console.log(`  - Total Líquido Item (simulado): R$ ${totalItemLiquido.toFixed(2)}`);
      console.log(`  - Desconto Total do Item (simulado): R$ ${descontoTotalItem.toFixed(2)}`);
      console.log(`  - Quantidade: ${quantidade}`);

      // IMPORTANTE (Bling): para exibir o PREÇO DE LISTA e o DESCONTO aplicado,
      // enviamos o preço cheio no campo 'valor' e o desconto em PORCENTAGEM no campo 'desconto'.
      // Observação: o Bling interpreta `desconto` numérico como %, então 40 = 40%.
      // O Bling calcula: valor * (1 - desconto/100) * quantidade.
      // Total da venda = soma dos itens líquidos + frete.
      console.log(`  - SKU: ${skuRecebido}`);
      console.log(`  - Quantidade solicitada: ${quantidade}`);

      const itemBling: any = {
        codigo: skuRecebido, // CAMPO OBRIGATÓRIO: código do produto no Bling
        descricao: item.descricao,
        unidade: item.unidade || 'UN',
        quantidade: quantidade,
        valor: precoLista, // Preço de lista (cheio)
        // VÍNCULO OBRIGATÓRIO com o produto cadastrado
        produto: {
          id: blingProdutoId,
        },
      };

      if (descontoPercentualItem > 0) {
        itemBling.desconto = Number(descontoPercentualItem.toFixed(2));
      }

      itensBling.push(itemBling);
    }

    // Calcular o total exato que Bling vai computar: itens + frete
    const valorFreteNum = Number(valor_frete || 0);
    const totalLiquidoBling = Math.round(totalBrutoBling * 100) / 100;
    const valorTotalBling = Math.round((totalLiquidoBling + valorFreteNum) * 100) / 100;

    console.log(`=== CÁLCULO BLING ===`);
    console.log(`Total Itens Bling (já com desconto): R$ ${totalLiquidoBling.toFixed(2)}`);
    console.log(`Total com Frete Bling: R$ ${valorTotalBling.toFixed(2)}`);

    console.log(`Desconto Total da Venda (info): R$ ${descontoTotalVenda.toFixed(2)}`);

    // Gerar número único para o pedido
    const numeroPedido = `${timestamp}-${randomSuffix}`;

    // Mapear tipo de frete para nome do transportador
    // Se for frete manual, usar o nome da transportadora fornecida
    let freteInfo: { nome: string; servico: string };
    if (frete_tipo === 'manual' && frete_transportadora) {
      freteInfo = { nome: frete_transportadora, servico: 'FRETE MANUAL' };
      console.log(`Frete manual: Transportadora = ${frete_transportadora}`);
      if (frete_observacao) {
        console.log(`Observação do frete: ${frete_observacao}`);
      }
    } else {
      const tipoFreteMap: { [key: string]: { nome: string; servico: string } } = {
        'pac': { nome: 'Correios', servico: 'PAC' },
        'sedex': { nome: 'Correios', servico: 'SEDEX' },
        'free': { nome: 'Frete Grátis', servico: 'FRETE GRATIS' },
        'retirada': { nome: 'Retirada na Matriz', servico: 'RETIRADA' },
      };
      freteInfo = tipoFreteMap[metodo_frete?.toLowerCase()] || { nome: 'Correios', servico: metodo_frete || 'A Combinar' };
    }

    // Mapear forma de pagamento
    const formaPagamentoMap: { [key: string]: string } = {
      'pix': 'PIX',
      'card': 'Cartão de Crédito',
      'boleto': 'Boleto Bancário',
      'faturamento': 'Faturamento 30/60/90',
    };
    const formaPagamentoDescricao = formaPagamentoMap[forma_pagamento?.toLowerCase()] || forma_pagamento || 'Outros';

    // Usar valores calculados diretamente dos itens Bling (não do request) para garantir consistência
    const valorProdutosNum = totalLiquidoBling;
    const valorTotalCorreto = valorTotalBling;

    console.log('=== RESUMO DO PEDIDO ===');
    console.log(`Valor Produtos (com desconto): R$ ${valorProdutosNum.toFixed(2)}`);
    console.log(`Valor Frete: R$ ${valorFreteNum.toFixed(2)}`);
    console.log(`Valor Total: R$ ${valorTotalCorreto.toFixed(2)}`);
    console.log(`Desconto Total: R$ ${descontoTotalVenda.toFixed(2)}`);
    console.log(`Transportador: ${freteInfo.nome} - ${freteInfo.servico}`);

    // Montar observações detalhadas
    const observacoes = [
      `Pedido EBD #${pedido_id}`,
      `Forma de Pagamento: ${formaPagamentoDescricao}`,
      `Transportador: ${freteInfo.nome}`,
      `Serviço: ${freteInfo.servico}`,
      `Valor Produtos: R$ ${valorProdutosNum.toFixed(2)}`,
      `Desconto Total: R$ ${descontoTotalVenda.toFixed(2)}`,
      `Valor Frete: R$ ${valorFreteNum.toFixed(2)}`,
      `Valor Total: R$ ${valorTotalCorreto.toFixed(2)}`,
      `Gerado em: ${new Date().toISOString()}`,
    ].join(' | ');

    // Gerar parcelas baseado na forma de pagamento
    let parcelas: any[] = [];
    const isFaturamento = forma_pagamento?.toLowerCase() === 'faturamento';

    if (isFaturamento && faturamento_prazo) {
      // Faturamento B2B: criar parcelas de 30, 60 ou 90 dias
      const prazo = parseInt(faturamento_prazo);
      const numParcelas = prazo === 30 ? 1 : prazo === 60 ? 2 : 3;

      // ✅ Parcelas precisam bater com o TOTAL DA VENDA no Bling.
      // Na prática, o Bling valida parcelas contra (itens líquidos + frete).
      const totalBaseParcelas = Math.round((totalLiquidoBling + valorFreteNum) * 100) / 100;

      // Calcular parcelas em centavos para evitar problemas de arredondamento
      const totalBaseCentavos = Math.round(totalBaseParcelas * 100);
      const parcelaBaseCentavos = Math.floor(totalBaseCentavos / numParcelas);
      const restoCentavos = totalBaseCentavos - parcelaBaseCentavos * numParcelas;

      const parcelasValoresCentavos: number[] = [];
      for (let i = 0; i < numParcelas; i++) {
        parcelasValoresCentavos.push(parcelaBaseCentavos);
      }

      // Ajustar a diferença (centavos) na ÚLTIMA parcela
      parcelasValoresCentavos[numParcelas - 1] += restoCentavos;

      const somaFinalCentavos = parcelasValoresCentavos.reduce((acc, v) => acc + v, 0);

      console.log(
        `Faturamento B2B: ${numParcelas} parcela(s) | base=${totalBaseParcelas.toFixed(2)} (itens=${totalLiquidoBling.toFixed(2)} + frete=${valorFreteNum.toFixed(2)}) | base_cent=${totalBaseCentavos} | base_unit_cent=${parcelaBaseCentavos} | diff_cent=${restoCentavos} | soma_final_cent=${somaFinalCentavos} | parcelas=${parcelasValoresCentavos
          .map((c) => (c / 100).toFixed(2))
          .join(', ')}`
      );

      for (let i = 1; i <= numParcelas; i++) {
        const dataVencimento = new Date();
        dataVencimento.setDate(dataVencimento.getDate() + 30 * i);

        const valorParcela = parcelasValoresCentavos[i - 1] / 100;

        parcelas.push({
          dataVencimento: dataVencimento.toISOString().split('T')[0],
          // Enviar com 2 casas; usamos centavos para garantir soma exata.
          valor: Number(valorParcela.toFixed(2)),
          observacoes: `Parcela ${i}/${numParcelas} - Faturamento ${prazo} dias`,
          formaPagamento: {
            descricao: 'Boleto parcelado',
          },
        });
      }
    } else {
      // Pagamento à vista
      // IMPORTANTE: O Bling valida parcelas apenas contra o total dos itens, sem frete.
      parcelas = [
        {
          dataVencimento: new Date().toISOString().split('T')[0],
          valor: Number((Math.round(Number(totalLiquidoBling) * 100) / 100).toFixed(2)),
          observacoes: `Pagamento via ${formaPagamentoDescricao}`,
          formaPagamento: {
            descricao: 'Boleto parcelado',
          },
        },
      ];
    }

    // Criar pedido no Bling com dados de transporte corretos
    const pedidoData: any = {
      numero: numeroPedido,
      data: new Date().toISOString().split('T')[0],
      loja: {
        id: config.loja_id || 205797806,
      },
      contato: {
        id: contatoId,
      },
      itens: itensBling,
      situacao: {
        // Usar status apropriado: 15 = Em Aberto, 9 = Atendido
        // Para faturamento B2B, usar Em Aberto para aguardar emissão dos boletos
        id: isFaturamento ? 15 : 15,
      },
      observacoes: observacoes + (isFaturamento ? ` | FATURAMENTO B2B ${faturamento_prazo} DIAS` : '') + (desconto_percentual ? ` | DESCONTO: ${desconto_percentual}%` : ''),
      parcelas,
      // Add vendedor (salesperson) if provided
      ...(vendedor_nome && { vendedor: { nome: vendedor_nome } }),
    };

    // IMPORTANTE: Já aplicamos desconto por item via `itens[].desconto`.
    // Enviar também `pedido.desconto` faz o Bling aplicar desconto em duplicidade,
    // causando erro de validação nas parcelas.
    // Portanto, não enviar desconto total no nível do pedido.


    // Adicionar transporte/endereço de entrega se disponível
    // Estrutura correta para Bling API v3:
    // - transportador.nome = nome da transportadora
    // - transportador.servico_logistico = PAC / SEDEX / FRETE GRATIS / FRETE MANUAL
    // - volumes = array com detalhes do frete
    if (endereco_entrega) {
      // Para manter o total da venda consistente com as parcelas, enviamos frete por conta do remetente ('R').
      const fretePorConta: 'R' | 'D' = 'R';

      // IMPORTANTE: Para frete manual, usar o nome da transportadora informada pelo vendedor
      // e NÃO usar o nome do cliente como fallback
      const isFreteManual = frete_tipo === 'manual';
      const transportadorNome = isFreteManual && frete_transportadora 
        ? frete_transportadora 
        : 'Correios';
      const servicoLogistico = isFreteManual 
        ? 'FRETE MANUAL' 
        : freteInfo.servico;

      pedidoData.transporte = {
        fretePorConta,
        transportador: {
          nome: transportadorNome,
          servico_logistico: servicoLogistico,
        },
        volumes: [
          {
            servico: freteInfo.servico, // PAC, SEDEX, FRETE GRATIS
            codigoRastreamento: '', // Será preenchido depois
          },
        ],
        frete: valorFreteNum, // Valor do frete
        contato: {
          nome: nomeCompleto,
          telefone: cliente.telefone?.replace(/\D/g, '') || '',
          // reforçar CPF/CNPJ também no contato de transporte
          ...(documento ? { numeroDocumento: documento } : {}),
        },
        endereco: {
          endereco: endereco_entrega.rua || '',
          numero: endereco_entrega.numero || 'S/N',
          complemento: endereco_entrega.complemento || '',
          bairro: endereco_entrega.bairro || '',
          cep: endereco_entrega.cep?.replace(/\D/g, '') || '',
          municipio: endereco_entrega.cidade || '',
          uf: endereco_entrega.estado || '',
        },
      };
    }

    console.log("PAYLOAD BLING FINAL:", JSON.stringify(pedidoData, null, 2));

    // Bling aplica rate-limit bem agressivo (ex: 3 req/seg). Como este fluxo pode fazer
    // múltiplas chamadas (contato, busca produto, etc.), fazemos um pequeno delay antes
    // de criar o pedido e tentamos novamente se vier TOO_MANY_REQUESTS.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await sleep(450);

    let orderResponse: Response | undefined;
    let responseData: any = null;

    // Resolver (1x) um possível ID de transportador no Bling para frete manual.
    // Observação: o Bling tende a tratar transportador como um contato cadastrado; enviar só "nome" pode ser ignorado.
    let manualTransportadorId: number | null = null;
    const resolveManualTransportadorId = async (): Promise<number | null> => {
      if (manualTransportadorId !== null) return manualTransportadorId;
      if (frete_tipo !== 'manual' || !frete_transportadora) return null;

      const name = String(frete_transportadora).trim();
      if (!name) return null;

      const tryUrls = [
        `https://www.bling.com.br/Api/v3/contatos?nome=${encodeURIComponent(name)}`,
        `https://www.bling.com.br/Api/v3/contatos?pesquisa=${encodeURIComponent(name)}`,
      ];

      for (const url of tryUrls) {
        try {
          await sleep(350);
          const resp = await blingFetchWithRetry(url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });

          const json = await resp.json().catch(() => null);
          const list: any[] = Array.isArray(json?.data) ? json.data : [];
          const found = list.find((c: any) => String(c?.nome ?? '').trim().toLowerCase() === name.toLowerCase());

          console.log('[BLING] Busca transportador (frete manual):', JSON.stringify({ url, count: list.length, foundId: found?.id ?? null }, null, 2));

          if (found?.id != null) {
            manualTransportadorId = Number(found.id);
            return manualTransportadorId;
          }
        } catch (e) {
          console.warn('[BLING] Falha ao buscar transportador por nome:', String(e));
        }
      }

      // Não achou; manter apenas o nome.
      manualTransportadorId = null;
      return null;
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      // ✅ REGRA DEFINITIVA (aplicar como última etapa antes do envio, em TODA tentativa)
      // - Para frete manual: transporte.contato.nome = nome do transportador (não cliente!)
      // - transportador.nome também deve ser o transportador
      if (frete_tipo === 'manual') {
        pedidoData.transporte = pedidoData.transporte || {};

        const transportadorId = await resolveManualTransportadorId();
        const nomeTransportador = String(frete_transportadora ?? '').trim();

        // Definir transportador
        pedidoData.transporte.transportador = transportadorId
          ? { id: transportadorId, nome: nomeTransportador }
          : { nome: nomeTransportador };

        // ✅ CORREÇÃO CRÍTICA: O Bling usa transporte.contato.nome como transportador!
        // Então precisamos colocar o nome do transportador aqui também
        pedidoData.transporte.contato = pedidoData.transporte.contato || {};
        pedidoData.transporte.contato.nome = nomeTransportador;

        // Alguns campos do Bling podem ler o serviço logístico no nível do transporte.
        pedidoData.transporte.servico_logistico = 'FRETE MANUAL';
      }

      // ✅ Log do payload FINAL COMPLETO que será enviado (por tentativa)
      console.log(`PAYLOAD BLING FINAL (PRE-SEND) [attempt ${attempt + 1}/3]:`, JSON.stringify(pedidoData, null, 2));

      orderResponse = await fetch('https://www.bling.com.br/Api/v3/pedidos/vendas', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(pedidoData),
      });

      responseData = await orderResponse.json();
      console.log('[BLING] Response /pedidos/vendas (raw):', JSON.stringify(responseData, null, 2));

      // Retry em rate limit
      if (!orderResponse.ok && responseData?.error?.type === 'TOO_MANY_REQUESTS' && attempt < 2) {
        const backoff = 800 * (attempt + 1);
        console.warn(`Bling rate limit (TOO_MANY_REQUESTS). Retry em ${backoff}ms...`);
        await sleep(backoff);
        continue;
      }

      break;
    }

    if (!orderResponse) {
      throw new Error('Falha ao criar pedido no Bling');
    }

    if (!orderResponse.ok) {
      console.error('Erro ao criar pedido:', JSON.stringify(responseData, null, 2));

      // Extract specific error message from Bling
      let errorMessage = 'Erro ao criar pedido no Bling';
      let errorType = 'UNKNOWN_ERROR';

      const fields = responseData?.error?.fields;

      // Bling pode retornar `fields` como ARRAY ou como OBJETO (ex: { "1": { msg: "..." } })
      if (fields) {
        const fieldErrors: any[] = Array.isArray(fields) ? fields : Object.values(fields);

        const errorMessages = fieldErrors
          .map((f: any) => f?.msg)
          .filter(Boolean)
          .map((m: string) => m.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());

        if (errorMessages.length > 0) {
          const stockError = errorMessages.find((m) =>
            m.toLowerCase().includes('estoque') && m.toLowerCase().includes('insuficiente')
          );

          if (stockError) {
            errorType = 'INSUFFICIENT_STOCK';
            const productMatch = stockError.match(/insuficiente[:\s]*(.+)/i);
            const products = productMatch ? productMatch[1].trim() : '';
            errorMessage = products
              ? `Estoque insuficiente no Bling para: ${products}`
              : 'Estoque insuficiente no Bling para um ou mais produtos';
          } else {
            errorMessage = errorMessages.join('; ');
          }
        }
      } else if (responseData?.error?.message) {
        errorMessage = responseData.error.message;
      }

      console.error('Erro processado:', errorMessage, errorType);

      // Retornar 400 para erros de validação (como estoque)
      return new Response(
        JSON.stringify({ error: errorMessage, errorType }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Pedido criado com sucesso:', responseData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        bling_order_id: responseData.data?.id,
        bling_order_number: responseData.data?.numero,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    // Se já identificamos um erro de estoque na checagem preventiva, devolver 400 (para o frontend tratar corretamente)
    const isInsufficientStock = errorMessage.toLowerCase().includes('estoque insuficiente');

    return new Response(
      JSON.stringify({
        error: errorMessage,
        ...(isInsufficientStock ? { errorType: 'INSUFFICIENT_STOCK' } : {}),
      }),
      {
        status: isInsufficientStock ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
