export type SubTaskStatus = 'pending' | 'in_progress' | 'completed';

export type PaymentType = 'fixed' | 'variable' | 'none';

export interface SubTask {
  id: string;
  name: string;
  status: SubTaskStatus;
  paymentType?: PaymentType;
  paymentAmount?: number;
  requiresForm?: boolean;
}

export interface Stage {
  id: number;
  name: string;
  status: 'locked' | 'active' | 'completed';
  subTasks: SubTask[];
  info: string;
}

export interface DirectorData {
  cargo: string;
  nomeCompleto: string;
  rg: string;
  orgaoEmissor: string;
  cpf: string;
  endereco: string;
  cep: string;
  estadoCivil: string;
  profissao: string;
}

export interface ChurchData {
  nomeIgreja: string;
  emailPastor: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

export interface DirectoriaFormData {
  churchData: ChurchData;
  directors: DirectorData[];
}
