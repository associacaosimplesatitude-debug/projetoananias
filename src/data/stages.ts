import { Stage } from '@/types/church-opening';

export const initialStages: Stage[] = [
  {
    id: 1,
    name: 'CONTRATAÇÃO',
    status: 'active',
    info: 'Nesta etapa, realizamos a contratação dos serviços. Você precisará fornecer os dados do presidente, revisar e assinar o contrato, e efetuar o pagamento do primeiro boleto mensal.',
    subTasks: [
      { id: '1-1', name: 'Dados do Presidente', status: 'pending', actionType: 'send', actionLabel: 'Enviar' },
      { id: '1-2', name: 'Assinatura do Contrato', status: 'pending', actionType: 'sign', actionLabel: 'Assinar' },
      { id: '1-3', name: 'Pagar Mensalidade', status: 'pending', actionType: 'pay', actionLabel: 'Pagar Agora' },
    ],
  },
  {
    id: 2,
    name: 'CERTIFICADO DIGITAL',
    status: 'locked',
    info: 'O certificado digital é essencial para assinar documentos eletronicamente. O custo é de R$ 150,00 anual. Após o pagamento, coletaremos seus dados e agendaremos a certificação.',
    subTasks: [
      { id: '2-1', name: 'CNH', status: 'pending', actionType: 'upload', actionLabel: 'Enviar' },
      { id: '2-2', name: 'Certificado Digital', status: 'pending', paymentType: 'fixed', paymentAmount: 150 },
      { id: '2-3', name: 'Agendamento', status: 'pending', actionType: 'schedule', actionLabel: 'Agendar' },
      { id: '2-4', name: 'Status', status: 'pending' },
    ],
  },
  {
    id: 3,
    name: 'VIABILIDADE',
    status: 'locked',
    info: 'Nesta etapa, verificamos a viabilidade do endereço para funcionamento da igreja. Você precisará enviar uma cópia do IPTU do imóvel.',
    subTasks: [
      { id: '3-1', name: 'Envio do IPTU', status: 'pending' },
      { id: '3-2', name: 'Pedido Viabilidade', status: 'pending' },
      { id: '3-3', name: 'Emissão Viabilidade', status: 'pending' },
    ],
  },
  {
    id: 4,
    name: 'ELABORAÇÃO DOCUMENTOS',
    status: 'locked',
    info: 'Elaboramos todos os documentos necessários para o registro da igreja. Você precisará fornecer os dados completos da diretoria (7 pessoas) através de um formulário específico.',
    subTasks: [
      { id: '4-1', name: 'Dados da Diretoria', status: 'pending', requiresForm: true },
      { id: '4-2', name: 'Elaboração Docs', status: 'pending' },
      { id: '4-3', name: 'Envio PDF conferência', status: 'pending' },
      { id: '4-4', name: 'Envio Docs. Sedex ou Presencial', status: 'pending' },
      { id: '4-5', name: 'Assinatura Diretoria', status: 'pending' },
      { id: '4-6', name: 'Conferência Simples Atit...', status: 'pending' },
      { id: '4-7', name: 'Assinatura Advogado (R$ 150)', status: 'pending', paymentType: 'fixed', paymentAmount: 150 },
    ],
  },
  {
    id: 5,
    name: 'REGISTRO DOCUMENTOS',
    status: 'locked',
    info: 'Os documentos serão registrados em cartório. O valor das custas é variável de acordo com cada cartório e será informado após o orçamento.',
    subTasks: [
      { id: '5-1', name: 'Envio cartório', status: 'pending' },
      { id: '5-2', name: 'Orçamento Cartório', status: 'pending' },
      { id: '5-3', name: 'Pagamento das Custas Cartório', status: 'pending', paymentType: 'variable' },
      { id: '5-4', name: 'Registro dos Documentos', status: 'pending' },
    ],
  },
  {
    id: 6,
    name: 'PEDIDO CNPJ',
    status: 'locked',
    info: 'Etapa final! Realizamos o pedido do CNPJ junto à Receita Federal. Após a emissão, você receberá todos os documentos e poderá abrir conta bancária em nome da igreja.',
    subTasks: [
      { id: '6-1', name: 'Emissão DBE', status: 'pending' },
      { id: '6-2', name: 'Envio do pedido', status: 'pending' },
      { id: '6-3', name: 'Emissão CNPJ', status: 'pending' },
      { id: '6-4', name: 'Entrega do CNPJ e Documentos', status: 'pending' },
      { id: '6-5', name: 'Abertura de Conta Bancária', status: 'pending' },
    ],
  },
];
