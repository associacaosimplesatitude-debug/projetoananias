export interface ParsedQuestion {
  ordem: number;
  pergunta: string;
  opcao_a: string;
  opcao_b: string;
  opcao_c: string;
  opcao_d?: string;
  resposta_correta: 'A' | 'B' | 'C' | 'D';
}

export interface ParsedQuiz {
  titulo: string;
  nivel: string;
  contexto: string;
  descricao?: string;
  perguntas: ParsedQuestion[];
}

/**
 * Pré-processa o texto para normalizar formatos inline
 * Adiciona quebras de linha antes de padrões conhecidos
 */
function preprocessText(text: string): string {
  let processed = text;
  
  // Adicionar quebra de linha antes de opções A), B), C), D)
  // Usar lookbehind negativo para não quebrar se já estiver no início da linha
  processed = processed.replace(/\s+([ABCD]\))/g, '\n$1');
  
  // Adicionar quebra de linha antes de "Resposta Certa:" ou "Resposta certa:"
  processed = processed.replace(/\s+(Resposta\s*[Cc]erta:)/gi, '\n$1');
  
  // Adicionar quebra de linha antes de números de pergunta (1., 2., etc.)
  // Mas não quebrar datas ou números no meio de frases
  processed = processed.replace(/\s+(\d{1,2})\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g, '\n$1. ');
  
  // Separar título de "Nível:" se estiverem na mesma linha
  processed = processed.replace(/(Questionário:[^|]+?)\s*(Nível:)/gi, '$1\n$2');
  
  return processed;
}

export function parseQuizText(text: string): ParsedQuiz {
  // Pré-processar o texto para normalizar formatos inline
  const normalizedText = preprocessText(text);
  
  const lines = normalizedText.trim().split('\n').map(l => l.trim()).filter(l => l);
  
  let titulo = '';
  let nivel = 'Médio';
  let contexto = '';
  let descricao = '';
  const perguntas: ParsedQuestion[] = [];
  
  // Extrair título (linha que começa com "Questionário:")
  const tituloLine = lines.find(l => l.toLowerCase().startsWith('questionário:'));
  if (tituloLine) {
    // Remover "Questionário:" e qualquer coisa após "Nível:" se existir
    let tituloTemp = tituloLine.replace(/^questionário:\s*/i, '').trim();
    // Se tiver "Nível:" na mesma linha, pegar só o título antes
    const nivelIndex = tituloTemp.toLowerCase().indexOf('nível:');
    if (nivelIndex > 0) {
      tituloTemp = tituloTemp.substring(0, nivelIndex).trim();
    }
    titulo = tituloTemp;
  }
  
  // Extrair nível e contexto (linha com "Nível:" e "Contexto:")
  const nivelLine = lines.find(l => l.toLowerCase().includes('nível:'));
  if (nivelLine) {
    const nivelMatch = nivelLine.match(/nível:\s*([^|]+)/i);
    if (nivelMatch) {
      nivel = nivelMatch[1].trim();
    }
    const contextoMatch = nivelLine.match(/contexto:\s*(.+)/i);
    if (contextoMatch) {
      contexto = contextoMatch[1].trim();
    }
  }
  
  // Extrair descrição (parágrafo após nível/contexto, antes das perguntas)
  const descricaoLine = lines.find(l => 
    l.startsWith('Este questionário') || 
    l.startsWith('Este quiz') ||
    (l.length > 50 && !l.match(/^\d+\./) && !l.startsWith('A)') && !l.startsWith('B)') && !l.startsWith('C)'))
  );
  if (descricaoLine && !descricaoLine.toLowerCase().includes('nível:') && !descricaoLine.toLowerCase().includes('questionário:')) {
    descricao = descricaoLine;
  }
  
  // Processar perguntas
  let currentQuestion: Partial<ParsedQuestion> | null = null;
  let questionNumber = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detectar início de pergunta (número seguido de ponto)
    const questionMatch = line.match(/^(\d+)\.\s*(.+)/);
    if (questionMatch) {
      // Salvar pergunta anterior se existir
      if (currentQuestion && currentQuestion.pergunta && currentQuestion.resposta_correta) {
        perguntas.push(currentQuestion as ParsedQuestion);
      }
      
      questionNumber = parseInt(questionMatch[1]);
      currentQuestion = {
        ordem: questionNumber,
        pergunta: questionMatch[2].trim(),
        opcao_a: '',
        opcao_b: '',
        opcao_c: '',
        resposta_correta: 'A'
      };
      continue;
    }
    
    // Detectar opções A, B, C, D
    if (currentQuestion) {
      const optionAMatch = line.match(/^A\)\s*(.+)/);
      const optionBMatch = line.match(/^B\)\s*(.+)/);
      const optionCMatch = line.match(/^C\)\s*(.+)/);
      const optionDMatch = line.match(/^D\)\s*(.+)/);
      
      if (optionAMatch) {
        currentQuestion.opcao_a = optionAMatch[1].trim();
      } else if (optionBMatch) {
        currentQuestion.opcao_b = optionBMatch[1].trim();
      } else if (optionCMatch) {
        currentQuestion.opcao_c = optionCMatch[1].trim();
      } else if (optionDMatch) {
        currentQuestion.opcao_d = optionDMatch[1].trim();
      }
      
      // Detectar resposta correta
      const answerMatch = line.match(/resposta\s*certa:\s*([ABCD])/i);
      if (answerMatch) {
        currentQuestion.resposta_correta = answerMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      }
    }
  }
  
  // Adicionar última pergunta
  if (currentQuestion && currentQuestion.pergunta && currentQuestion.resposta_correta) {
    perguntas.push(currentQuestion as ParsedQuestion);
  }
  
  return {
    titulo,
    nivel,
    contexto,
    descricao,
    perguntas
  };
}

export function validateParsedQuiz(quiz: ParsedQuiz): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!quiz.titulo) {
    errors.push('Título do questionário não encontrado');
  }
  
  if (quiz.perguntas.length === 0) {
    errors.push('Nenhuma pergunta detectada');
  }
  
  quiz.perguntas.forEach((p, i) => {
    if (!p.pergunta) {
      errors.push(`Pergunta ${i + 1}: texto da pergunta vazio`);
    }
    if (!p.opcao_a) {
      errors.push(`Pergunta ${i + 1}: opção A não encontrada`);
    }
    if (!p.opcao_b) {
      errors.push(`Pergunta ${i + 1}: opção B não encontrada`);
    }
    if (!p.opcao_c) {
      errors.push(`Pergunta ${i + 1}: opção C não encontrada`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}
