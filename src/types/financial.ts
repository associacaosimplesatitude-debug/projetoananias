export type MemberCargo = 
  | 'Membro' 
  | 'Obreiro' 
  | 'Obreira' 
  | 'Diácono' 
  | 'Presbítero' 
  | 'Diaconisa' 
  | 'Pastor'
  | 'Pastora'
  | 'Evangelista'
  | 'Missionário'
  | 'Missionária'
  | 'Apóstolo'
  | 'Bispo'
  | 'Bispa';

export type Gender = 'Masculino' | 'Feminino';

export interface Member {
  id: string;
  nomeCompleto: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  dataAniversario: string;
  sexo: Gender;
  whatsapp: string;
  email?: string;
  estadoCivil?: string;
  cargo: MemberCargo | string;
  avatarUrl?: string;
  createdAt: string;
}

export type EntryType = string;

export interface FinancialEntry {
  id: string;
  data: string;
  hora?: string;
  tipo: EntryType;
  valor: number;
  membroId?: string;
  membroNome?: string;
  descricao: string;
  createdAt: string;
}

export type ExpenseMainCategory = 
  | 'DESPESAS COM PESSOAL'
  | 'DESPESAS ADMINISTRATIVAS'
  | 'DESPESAS OPERACIONAIS'
  | 'DESPESAS FINANCEIRAS';

export interface ExpenseCategory {
  main: ExpenseMainCategory;
  sub: string;
}

export const expenseCategories: Record<ExpenseMainCategory, string[]> = {
  'DESPESAS COM PESSOAL': ['Salários e Ordenados', 'Encargos Sociais'],
  'DESPESAS ADMINISTRATIVAS': [
    'Aluguel',
    'Água e Esgoto',
    'Energia Elétrica',
    'Telefone e Internet',
    'Material de Escritório',
  ],
  'DESPESAS OPERACIONAIS': [
    'Manutenção do Templo',
    'Missões e Evangelismo',
    'Eventos e Congressos',
  ],
  'DESPESAS FINANCEIRAS': ['Juros e Multas', 'Tarifas Bancárias'],
};

export interface FinancialExpense {
  id: string;
  data: string;
  valor: number;
  categoria: ExpenseCategory;
  descricao: string;
  createdAt: string;
}
