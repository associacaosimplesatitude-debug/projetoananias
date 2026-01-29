/**
 * Utilitários de validação de CPF e CNPJ para o módulo de Royalties
 */

/**
 * Remove todos os caracteres não numéricos
 */
export function cleanDocument(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Valida um CPF matematicamente
 */
export function validateCPF(cpf: string): boolean {
  const cleaned = cleanDocument(cpf);
  
  // CPF deve ter 11 dígitos
  if (cleaned.length !== 11) return false;
  
  // Rejeita CPFs com todos os dígitos iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Calcula o primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;
  
  // Calcula o segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[10])) return false;
  
  return true;
}

/**
 * Valida um CNPJ matematicamente
 */
export function validateCNPJ(cnpj: string): boolean {
  const cleaned = cleanDocument(cnpj);
  
  // CNPJ deve ter 14 dígitos
  if (cleaned.length !== 14) return false;
  
  // Rejeita CNPJs com todos os dígitos iguais
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  // Multiplicadores para o primeiro dígito verificador
  const mult1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  // Multiplicadores para o segundo dígito verificador
  const mult2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  // Calcula o primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * mult1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleaned[12])) return false;
  
  // Calcula o segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * mult2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleaned[13])) return false;
  
  return true;
}

/**
 * Valida se é um CPF ou CNPJ válido
 */
export function validateCPFOrCNPJ(value: string): { valid: boolean; type: 'cpf' | 'cnpj' | null } {
  const cleaned = cleanDocument(value);
  
  if (cleaned.length === 11) {
    return { valid: validateCPF(cleaned), type: 'cpf' };
  } else if (cleaned.length === 14) {
    return { valid: validateCNPJ(cleaned), type: 'cnpj' };
  }
  
  return { valid: false, type: null };
}

/**
 * Formata um CPF ou CNPJ
 */
export function formatCPFCNPJ(value: string): string {
  const cleaned = cleanDocument(value);
  
  if (cleaned.length <= 11) {
    // Formato CPF: 000.000.000-00
    return cleaned
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // Formato CNPJ: 00.000.000/0000-00
    return cleaned
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
}

/**
 * Retorna mensagem de erro para documento inválido
 */
export function getDocumentError(value: string): string | null {
  const cleaned = cleanDocument(value);
  
  if (!cleaned) return null; // Campo vazio não é erro (é opcional)
  
  if (cleaned.length < 11) {
    return 'Documento incompleto';
  } else if (cleaned.length === 11) {
    return validateCPF(cleaned) ? null : 'CPF inválido';
  } else if (cleaned.length === 14) {
    return validateCNPJ(cleaned) ? null : 'CNPJ inválido';
  } else if (cleaned.length > 11 && cleaned.length < 14) {
    return 'Documento incompleto';
  } else {
    return 'Documento com muitos dígitos';
  }
}
